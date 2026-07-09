# Vertical MVP: PR Context Extraction, API Client, and Audio-Link Comment — Implementation Plan (pr-trailer-ghaction)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current stub `/brief` ping in `index.ts` with the real vertical slice: extract full PR context (title/body/commits/per-file diffs), submit it to `pr-trailer-api`'s `POST /v1/jobs`, poll `GET /v1/jobs/:id` to completion, render the returned brief into markdown, and post it as the PR comment — prefixed with an audio link when TTS succeeded.

**Architecture:** Three new, independently-testable modules plug into the existing `index.ts` orchestration: `src/github/extract-context.ts` (revives the previously-unimplemented SCA-110 design, unchanged from its own spec), `src/api/jobs-client.ts` (submit + backoff-polling client, replacing the stub ping), and `src/render/render-brief.ts` (turns the structured `brief` JSON into the markdown body `upsertPrComment` already knows how to wrap). `index.ts` becomes the thin glue that wires these together and decides `setFailed` vs `warning` vs posting a comment, matching the design doc's error-handling table exactly. `upsertPrComment` itself is untouched.

**Tech Stack:** TypeScript, `@actions/core`, `@actions/github` (Octokit), native `fetch` (Node 24), `vitest`. No new npm dependencies.

## Global Constraints

- `action.yml` gains two inputs: `exclude-files` (optional, default `'package-lock.json,yarn.lock,pnpm-lock.yaml,Cargo.lock,poetry.lock'`) and `api-url` (required — no default).
- Job submission: `POST {api-url}/v1/jobs` with header `X-Api-Key`, body `{pr, files}`. `401` → `core.setFailed` (setup problem). Any other non-2xx → `core.setFailed`.
- Job polling: `GET {api-url}/v1/jobs/:id` with header `X-Api-Key`, backoff starting at 2s, ×1.5 each attempt, capped at 10s between polls, overall ceiling of 6 minutes.
- `status: "error"` from the job, or the polling ceiling reached without a terminal status → **no comment is posted**, and the workflow does **not** fail (`core.warning`, exit 0).
- `status: "done"` → `upsertPrComment` with the rendered brief text, prefixed with the audio link line (`🔊 [Listen to the PR trailer](<url>) (~<duration>s)`) only when `audio` is present.
- `upsertPrComment` (`src/github/upsert-comment.ts`) is **not modified** by this plan — only the body string `index.ts` passes to it changes.
- Public-facing communication (README) is English-only, per project convention already established in the existing README.
- Conventional Commits (`feat`, `fix`, `chore`, `build`, `ci`, `docs`, `refactor`, `test`), small scoped commits, per `CONTRIBUTING.md`.
- Test files are co-located next to their source file (`foo.ts` / `foo.test.ts`), matching the existing `src/github/upsert-comment.ts` / `upsert-comment.test.ts` pattern — no separate `test/` directory, no `vitest.config.ts` needed.

---

## Task 1: PR context extraction

**Files:**
- Create: `src/github/extract-context.ts`
- Test: `src/github/extract-context.test.ts`
- Modify: `action.yml`

**Interfaces:**
- Produces: `Octokit` type alias, `PrFileStatus` union, `PrFile` interface, `PrContext` interface, `extractPrContext(octokit: Octokit, params: {owner: string; repo: string; pullNumber: number; title: string; body: string | null}, excludeFiles: string[]): Promise<PrContext>`. Consumed by `src/index.ts` (Task 4).

- [ ] **Step 1: Add the `exclude-files` input to `action.yml`**

```yaml
name: 'pr-trailer'
description: 'Analyzes a pull request and posts a risk-prioritized review brief as a comment.'
inputs:
  api-key:
    description: 'pr-trailer-api key used to authenticate requests to the analysis service.'
    required: true
  github-token:
    description: 'Token used to read PR data and post the comment.'
    required: false
    default: ${{ github.token }}
  exclude-files:
    description: 'Comma-separated list of filenames to exclude from diff extraction, overriding the default lockfile exclusions.'
    required: false
    default: 'package-lock.json,yarn.lock,pnpm-lock.yaml,Cargo.lock,poetry.lock'
runs:
  using: 'node24'
  main: 'dist/index.js'
```

- [ ] **Step 2: Write the failing tests**

Create `src/github/extract-context.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { extractPrContext, type Octokit } from './extract-context';

function createFakeOctokit(files: unknown[], commits: unknown[]) {
  const listFiles = vi.fn();
  const listCommits = vi.fn();
  const paginate = vi.fn().mockImplementation((fn: unknown) => {
    if (fn === listFiles) return Promise.resolve(files);
    if (fn === listCommits) return Promise.resolve(commits);
    throw new Error('unexpected paginate call');
  });

  const octokit = {
    paginate,
    rest: {
      pulls: { listFiles, listCommits },
    },
  } as unknown as Octokit;

  return { octokit, paginate, listFiles, listCommits };
}

const baseParams = { owner: 'acme', repo: 'widgets', pullNumber: 42, title: 'Add feature', body: 'desc' };

describe('extractPrContext', () => {
  it('excludes files matching the default lockfile list, including a nested path', async () => {
    const { octokit } = createFakeOctokit(
      [
        { filename: 'package-lock.json', patch: 'p', additions: 1, deletions: 0, status: 'modified' },
        { filename: 'packages/foo/package-lock.json', patch: 'p', additions: 1, deletions: 0, status: 'modified' },
        { filename: 'src/index.ts', patch: 'p', additions: 1, deletions: 0, status: 'modified' },
      ],
      [],
    );

    const result = await extractPrContext(
      octokit,
      baseParams,
      ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock', 'poetry.lock'],
    );

    expect(result.files.map((f) => f.path)).toEqual(['src/index.ts']);
  });

  it('excludes nothing when excludeFiles is empty', async () => {
    const { octokit } = createFakeOctokit(
      [{ filename: 'package-lock.json', patch: 'p', additions: 1, deletions: 0, status: 'modified' }],
      [],
    );

    const result = await extractPrContext(octokit, baseParams, []);

    expect(result.files.map((f) => f.path)).toEqual(['package-lock.json']);
  });

  it('falls back to an empty string when patch is missing', async () => {
    const { octokit } = createFakeOctokit(
      [{ filename: 'binary.png', additions: 0, deletions: 0, status: 'added' }],
      [],
    );

    const result = await extractPrContext(octokit, baseParams, []);

    expect(result.files[0].patch).toBe('');
  });

  it('falls back to an empty string when body is null', async () => {
    const { octokit } = createFakeOctokit([], []);

    const result = await extractPrContext(octokit, { ...baseParams, body: null }, []);

    expect(result.body).toBe('');
  });

  it('passes through every documented PrFileStatus value', async () => {
    const statuses = ['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged'];
    const { octokit } = createFakeOctokit(
      statuses.map((status, i) => ({ filename: `f${i}.ts`, patch: 'p', additions: 1, deletions: 0, status })),
      [],
    );

    const result = await extractPrContext(octokit, baseParams, []);

    expect(result.files.map((f) => f.status)).toEqual(statuses);
  });

  it('includes every commit message, not just the PR title', async () => {
    const { octokit } = createFakeOctokit(
      [],
      [{ commit: { message: 'feat: a' } }, { commit: { message: 'fix: b' } }, { commit: { message: 'chore: c' } }],
    );

    const result = await extractPrContext(octokit, baseParams, []);

    expect(result.commitMessages).toEqual(['feat: a', 'fix: b', 'chore: c']);
  });

  it('fetches files and commits via octokit.paginate with per_page 100', async () => {
    const { octokit, paginate, listFiles, listCommits } = createFakeOctokit([], []);

    await extractPrContext(octokit, baseParams, []);

    expect(paginate).toHaveBeenCalledWith(listFiles, {
      owner: 'acme',
      repo: 'widgets',
      pull_number: 42,
      per_page: 100,
    });
    expect(paginate).toHaveBeenCalledWith(listCommits, {
      owner: 'acme',
      repo: 'widgets',
      pull_number: 42,
      per_page: 100,
    });
  });

  it('carries the title and body straight through from params', async () => {
    const { octokit } = createFakeOctokit([], []);

    const result = await extractPrContext(octokit, baseParams, []);

    expect(result.title).toBe('Add feature');
    expect(result.body).toBe('desc');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/github/extract-context.test.ts`
Expected: FAIL — `Cannot find module './extract-context'`

- [ ] **Step 4: Implement `src/github/extract-context.ts`**

```ts
import { basename } from 'node:path';
import type * as github from '@actions/github';

export type Octokit = ReturnType<typeof github.getOctokit>;

export type PrFileStatus = 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';

export interface PrFile {
  path: string;
  patch: string;
  additions: number;
  deletions: number;
  status: PrFileStatus;
}

export interface PrContext {
  title: string;
  body: string;
  commitMessages: string[];
  files: PrFile[];
}

export async function extractPrContext(
  octokit: Octokit,
  params: {
    owner: string;
    repo: string;
    pullNumber: number;
    title: string;
    body: string | null;
  },
  excludeFiles: string[],
): Promise<PrContext> {
  const { owner, repo, pullNumber, title, body } = params;
  const excludeSet = new Set(excludeFiles);

  const rawFiles = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  const files: PrFile[] = rawFiles
    .filter((file) => !excludeSet.has(basename(file.filename)))
    .map((file) => ({
      path: file.filename,
      patch: file.patch ?? '',
      additions: file.additions,
      deletions: file.deletions,
      status: file.status as PrFileStatus,
    }));

  const rawCommits = await octokit.paginate(octokit.rest.pulls.listCommits, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });
  const commitMessages = rawCommits.map((commit) => commit.commit.message);

  return {
    title,
    body: body ?? '',
    commitMessages,
    files,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/github/extract-context.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add action.yml src/github/extract-context.ts src/github/extract-context.test.ts
git commit -m "feat(github): implement PR context extraction (revives SCA-110)"
```

---

## Task 2: Job submission and polling API client

**Files:**
- Create: `src/api/jobs-client.ts`
- Test: `src/api/jobs-client.test.ts`

**Interfaces:**
- Produces: `RiskLevel`, `BriefFile`, `Brief`, `AudioInfo`, `JobResponse`, `PrInput`, `PrFile`/`PrFileStatus` (wire types matching `pr-trailer-api`'s contract), `JobSubmissionError` (class, `kind: 'unauthorized' | 'rejected'`), `submitJob(apiUrl: string, apiKey: string, pr: PrInput, files: PrFile[], fetchFn?: typeof fetch): Promise<string>`, `pollJob(apiUrl: string, apiKey: string, jobId: string, deps?: PollDeps): Promise<PollResult>` where `PollResult = {outcome: 'done'; job: JobResponse & {brief: Brief}} | {outcome: 'error'} | {outcome: 'timeout'}` and `PollDeps = {fetchFn?: typeof fetch; sleepFn?: (ms: number) => Promise<void>; now?: () => number}`. Consumed by `src/index.ts` (Task 4) and `src/render/render-brief.ts` (Task 3, imports the `Brief`/`AudioInfo` types).

- [ ] **Step 1: Write the failing tests**

Create `src/api/jobs-client.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { JobSubmissionError, pollJob, submitJob, type JobResponse } from './jobs-client';

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
}

const pr = { title: 't', body: 'b', commitMessages: ['c'] };
const files = [{ path: 'a.ts', patch: 'p', additions: 1, deletions: 0, status: 'modified' as const }];

describe('submitJob', () => {
  it('returns the jobId on a 202 response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(202, { jobId: 'job-1' }));

    const jobId = await submitJob('https://api.example', 'key-1', pr, files, fetchFn);

    expect(jobId).toBe('job-1');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.example/v1/jobs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Api-Key': 'key-1' }),
        body: JSON.stringify({ pr, files }),
      }),
    );
  });

  it('throws a JobSubmissionError with kind "unauthorized" on 401', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(401, {}));

    await expect(submitJob('https://api.example', 'bad-key', pr, files, fetchFn)).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });

  it('throws a JobSubmissionError with kind "rejected" on any other non-2xx', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, {}));

    await expect(submitJob('https://api.example', 'key-1', pr, files, fetchFn)).rejects.toMatchObject({
      kind: 'rejected',
    });
  });

  it('JobSubmissionError is an instance of Error', () => {
    const err = new JobSubmissionError('rejected', 'message');
    expect(err).toBeInstanceOf(Error);
  });
});

const doneJob: JobResponse = {
  status: 'done',
  brief: { summary: 's', intent: 'i', riskLevel: 'low', files: [], readOrder: [], openQuestions: [] },
  audio: { url: 'https://cdn/a.mp3', expiresAt: '2026-08-01T00:00:00.000Z', durationSeconds: 42 },
  error: null,
};

describe('pollJob', () => {
  it('returns done immediately when the first poll is already done', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, doneJob));
    const sleepFn = vi.fn();

    const result = await pollJob('https://api.example', 'key-1', 'job-1', { fetchFn, sleepFn, now: () => 0 });

    expect(result).toEqual({ outcome: 'done', job: doneJob });
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it('polls with 2s, then 3s (×1.5) backoff before eventually succeeding', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, doneJob));
    let elapsed = 0;
    const sleepFn = vi.fn(async (ms: number) => {
      elapsed += ms;
    });

    const result = await pollJob('https://api.example', 'key-1', 'job-1', {
      fetchFn,
      sleepFn,
      now: () => elapsed,
    });

    expect(result).toEqual({ outcome: 'done', job: doneJob });
    expect(sleepFn).toHaveBeenNthCalledWith(1, 2000);
    expect(sleepFn).toHaveBeenNthCalledWith(2, 3000);
  });

  it('caps the backoff delay at 10s', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }))
      .mockResolvedValueOnce(jsonResponse(200, doneJob));
    let elapsed = 0;
    const sleepFn = vi.fn(async (ms: number) => {
      elapsed += ms;
    });

    await pollJob('https://api.example', 'key-1', 'job-1', { fetchFn, sleepFn, now: () => elapsed });

    // 2000, 3000, 4500, 6750 — all under the 10s cap so far; assert the cap itself
    // by checking no call ever exceeds it.
    for (const call of sleepFn.mock.calls) {
      expect(call[0]).toBeLessThanOrEqual(10000);
    }
  });

  it('returns error outcome when the job reports status "error"', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'error', brief: null, audio: null, error: 'boom' }));

    const result = await pollJob('https://api.example', 'key-1', 'job-1', { fetchFn, sleepFn: vi.fn(), now: () => 0 });

    expect(result).toEqual({ outcome: 'error' });
  });

  it('returns timeout when the 6-minute ceiling is reached without a terminal status', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'processing', brief: null, audio: null, error: null }));
    let elapsed = 0;
    const sleepFn = vi.fn(async (ms: number) => {
      elapsed += ms;
    });

    const result = await pollJob('https://api.example', 'key-1', 'job-1', {
      fetchFn,
      sleepFn,
      now: () => elapsed,
    });

    expect(result).toEqual({ outcome: 'timeout' });
  });

  it('throws if the job reports status "done" with no brief', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { status: 'done', brief: null, audio: null, error: null }));

    await expect(
      pollJob('https://api.example', 'key-1', 'job-1', { fetchFn, sleepFn: vi.fn(), now: () => 0 }),
    ).rejects.toThrow(/job-1/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/api/jobs-client.test.ts`
Expected: FAIL — `Cannot find module './jobs-client'`

- [ ] **Step 3: Implement `src/api/jobs-client.ts`**

```ts
export type RiskLevel = 'low' | 'medium' | 'high';

export interface BriefFile {
  path: string;
  risk: RiskLevel;
  reason: string;
}

export interface Brief {
  summary: string;
  intent: string;
  riskLevel: RiskLevel;
  files: BriefFile[];
  readOrder: string[];
  openQuestions: string[];
}

export interface AudioInfo {
  url: string;
  expiresAt: string;
  durationSeconds: number;
}

export interface JobResponse {
  status: 'queued' | 'processing' | 'done' | 'error';
  brief: Brief | null;
  audio: AudioInfo | null;
  error: string | null;
}

export interface PrInput {
  title: string;
  body: string;
  commitMessages: string[];
}

export type PrFileStatus = 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';

export interface PrFile {
  path: string;
  patch: string;
  additions: number;
  deletions: number;
  status: PrFileStatus;
}

export class JobSubmissionError extends Error {
  constructor(
    public readonly kind: 'unauthorized' | 'rejected',
    message: string,
  ) {
    super(message);
    this.name = 'JobSubmissionError';
  }
}

export async function submitJob(
  apiUrl: string,
  apiKey: string,
  pr: PrInput,
  files: PrFile[],
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchFn(`${apiUrl}/v1/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ pr, files }),
  });

  if (response.status === 401) {
    throw new JobSubmissionError('unauthorized', 'pr-trailer-api rejected the request: invalid api-key.');
  }
  if (!response.ok) {
    throw new JobSubmissionError('rejected', `pr-trailer-api job submission failed with status ${response.status}.`);
  }

  const body = (await response.json()) as { jobId: string };
  return body.jobId;
}

export interface PollDeps {
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  now?: () => number;
}

export type PollResult =
  | { outcome: 'done'; job: JobResponse & { brief: Brief } }
  | { outcome: 'error' }
  | { outcome: 'timeout' };

const POLL_CEILING_MS = 6 * 60 * 1000;
const POLL_START_DELAY_MS = 2000;
const POLL_MAX_DELAY_MS = 10000;
const POLL_BACKOFF_FACTOR = 1.5;

export async function pollJob(
  apiUrl: string,
  apiKey: string,
  jobId: string,
  deps: PollDeps = {},
): Promise<PollResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const sleepFn = deps.sleepFn ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? Date.now;

  const startedAt = now();
  let delayMs = POLL_START_DELAY_MS;

  for (;;) {
    const response = await fetchFn(`${apiUrl}/v1/jobs/${jobId}`, {
      headers: { 'X-Api-Key': apiKey },
    });
    const job = (await response.json()) as JobResponse;

    if (job.status === 'done') {
      if (!job.brief) {
        throw new Error(`Job ${jobId} reported status "done" without a brief.`);
      }
      return { outcome: 'done', job: job as JobResponse & { brief: Brief } };
    }
    if (job.status === 'error') {
      return { outcome: 'error' };
    }
    if (now() - startedAt >= POLL_CEILING_MS) {
      return { outcome: 'timeout' };
    }

    await sleepFn(delayMs);
    delayMs = Math.min(delayMs * POLL_BACKOFF_FACTOR, POLL_MAX_DELAY_MS);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/api/jobs-client.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/api/jobs-client.ts src/api/jobs-client.test.ts
git commit -m "feat(api): add job submission and backoff-polling client"
```

---

## Task 3: Brief renderer and comment body composition

**Files:**
- Create: `src/render/render-brief.ts`
- Test: `src/render/render-brief.test.ts`

**Interfaces:**
- Consumes: `Brief`, `BriefFile`, `RiskLevel`, `AudioInfo` types from `src/api/jobs-client.ts` (Task 2).
- Produces: `renderBrief(brief: Brief): string` (markdown: summary, intent, overall risk, a risk table, a reading-order list, open questions — sections with empty arrays are omitted), `composeCommentBody(brief: Brief, audio: AudioInfo | null): string` (prefixes the rendered brief with the audio link line when `audio` is present; this is the "body string `index.ts` builds" the design doc's testing section calls out). Consumed by `src/index.ts` (Task 4).

- [ ] **Step 1: Write the failing tests**

Create `src/render/render-brief.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { composeCommentBody, renderBrief } from './render-brief';
import type { Brief } from '../api/jobs-client';

const fullBrief: Brief = {
  summary: 'Adds a login feature.',
  intent: 'Add a login feature',
  riskLevel: 'high',
  files: [
    { path: 'src/auth/session.ts', risk: 'high', reason: 'Touches token expiry logic' },
    { path: 'README.md', risk: 'low', reason: 'Docs only' },
  ],
  readOrder: ['src/auth/session.ts', 'README.md'],
  openQuestions: ['Is the token TTL configurable?'],
};

const emptyBrief: Brief = {
  summary: 'Trivial change.',
  intent: 'Fix a typo',
  riskLevel: 'low',
  files: [],
  readOrder: [],
  openQuestions: [],
};

describe('renderBrief', () => {
  it('includes the summary, intent, and overall risk', () => {
    const markdown = renderBrief(fullBrief);

    expect(markdown).toContain('Adds a login feature.');
    expect(markdown).toContain('Add a login feature');
    expect(markdown).toContain('High');
  });

  it('renders a risk table row per file', () => {
    const markdown = renderBrief(fullBrief);

    expect(markdown).toContain('`src/auth/session.ts`');
    expect(markdown).toContain('Touches token expiry logic');
    expect(markdown).toContain('`README.md`');
  });

  it('renders the suggested reading order as a numbered list', () => {
    const markdown = renderBrief(fullBrief);

    expect(markdown).toContain('1. `src/auth/session.ts`');
    expect(markdown).toContain('2. `README.md`');
  });

  it('renders open questions as a bullet list', () => {
    const markdown = renderBrief(fullBrief);

    expect(markdown).toContain('Is the token TTL configurable?');
  });

  it('omits the risk table, reading order, and open-questions sections when empty', () => {
    const markdown = renderBrief(emptyBrief);

    expect(markdown).not.toContain('| File | Risk | Why |');
    expect(markdown).not.toContain('Suggested reading order');
    expect(markdown).not.toContain('Open questions');
  });
});

describe('composeCommentBody', () => {
  it('prefixes the audio link line, with duration, when audio is present', () => {
    const body = composeCommentBody(fullBrief, {
      url: 'https://cdn.example/audio.mp3',
      expiresAt: '2026-08-01T00:00:00.000Z',
      durationSeconds: 42,
    });

    expect(body.startsWith('🔊 [Listen to the PR trailer](https://cdn.example/audio.mp3) (~42s)')).toBe(true);
    expect(body).toContain(renderBrief(fullBrief));
  });

  it('omits the audio line entirely when audio is null', () => {
    const body = composeCommentBody(fullBrief, null);

    expect(body).not.toContain('Listen to the PR trailer');
    expect(body).toBe(renderBrief(fullBrief));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/render/render-brief.test.ts`
Expected: FAIL — `Cannot find module './render-brief'`

- [ ] **Step 3: Implement `src/render/render-brief.ts`**

```ts
import type { AudioInfo, Brief, RiskLevel } from '../api/jobs-client';

const RISK_EMOJI: Record<RiskLevel, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🔴',
};

export function renderBrief(brief: Brief): string {
  const lines: string[] = [];

  lines.push('## 🚦 Review Brief');
  lines.push('');
  lines.push(brief.summary);
  lines.push('');
  lines.push(`**Intent:** ${brief.intent}`);
  lines.push(`**Overall risk:** ${RISK_EMOJI[brief.riskLevel]} ${capitalize(brief.riskLevel)}`);

  if (brief.files.length > 0) {
    lines.push('');
    lines.push('| File | Risk | Why |');
    lines.push('|---|---|---|');
    for (const file of brief.files) {
      lines.push(`| \`${file.path}\` | ${RISK_EMOJI[file.risk]} ${capitalize(file.risk)} | ${file.reason} |`);
    }
  }

  if (brief.readOrder.length > 0) {
    lines.push('');
    lines.push('### Suggested reading order');
    brief.readOrder.forEach((path, i) => {
      lines.push(`${i + 1}. \`${path}\``);
    });
  }

  if (brief.openQuestions.length > 0) {
    lines.push('');
    lines.push('### Open questions');
    for (const question of brief.openQuestions) {
      lines.push(`- ${question}`);
    }
  }

  return lines.join('\n');
}

export function composeCommentBody(brief: Brief, audio: AudioInfo | null): string {
  const parts: string[] = [];
  if (audio) {
    parts.push(`🔊 [Listen to the PR trailer](${audio.url}) (~${audio.durationSeconds}s)`);
  }
  parts.push(renderBrief(brief));
  return parts.join('\n\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/render/render-brief.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/render/render-brief.ts src/render/render-brief.test.ts
git commit -m "feat(render): render the structured brief into markdown, with audio-link prefix"
```

---

## Task 4: Wire `index.ts` to the full pipeline

**Files:**
- Modify: `src/index.ts`
- Modify: `action.yml`
- Modify: `.github/workflows/pr-trailer.yml`

**Interfaces:**
- Consumes: `extractPrContext` (Task 1), `submitJob`/`pollJob`/`JobSubmissionError` (Task 2), `composeCommentBody` (Task 3), `upsertPrComment` (existing, unchanged).
- Produces: the Action's `run()` entrypoint — no new exports (matches the existing convention that `index.ts` itself has no dedicated unit test; its branching is covered indirectly through the tested modules above, and end-to-end via a real PR per the design doc's "End-to-end acceptance" section).

- [ ] **Step 1: Add the `api-url` input to `action.yml`**

```yaml
name: 'pr-trailer'
description: 'Analyzes a pull request and posts a risk-prioritized review brief as a comment.'
inputs:
  api-key:
    description: 'pr-trailer-api key used to authenticate requests to the analysis service.'
    required: true
  api-url:
    description: 'Base URL of the deployed pr-trailer-api service.'
    required: true
  github-token:
    description: 'Token used to read PR data and post the comment.'
    required: false
    default: ${{ github.token }}
  exclude-files:
    description: 'Comma-separated list of filenames to exclude from diff extraction, overriding the default lockfile exclusions.'
    required: false
    default: 'package-lock.json,yarn.lock,pnpm-lock.yaml,Cargo.lock,poetry.lock'
runs:
  using: 'node24'
  main: 'dist/index.js'
```

- [ ] **Step 2: Rewrite `src/index.ts`**

```ts
import * as core from '@actions/core';
import * as github from '@actions/github';
import { extractPrContext } from './github/extract-context';
import { upsertPrComment } from './github/upsert-comment';
import { JobSubmissionError, pollJob, submitJob } from './api/jobs-client';
import { composeCommentBody } from './render/render-brief';

function parseExcludeFiles(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function run(): Promise<void> {
  const apiKey = core.getInput('api-key', { required: true });
  const apiUrl = core.getInput('api-url', { required: true });
  const githubToken = core.getInput('github-token', { required: true });
  const excludeFiles = parseExcludeFiles(core.getInput('exclude-files'));

  const octokit = github.getOctokit(githubToken);
  const { context } = github;

  const pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    core.info('No pull_request in event payload; skipping comment.');
    return;
  }

  const prContext = await extractPrContext(
    octokit,
    {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pullNumber: pullRequest.number,
      title: pullRequest.title as string,
      body: (pullRequest.body as string | null) ?? null,
    },
    excludeFiles,
  );

  let jobId: string;
  try {
    jobId = await submitJob(
      apiUrl,
      apiKey,
      { title: prContext.title, body: prContext.body, commitMessages: prContext.commitMessages },
      prContext.files,
    );
  } catch (err) {
    if (err instanceof JobSubmissionError) {
      core.setFailed(err.message);
      return;
    }
    throw err;
  }

  const result = await pollJob(apiUrl, apiKey, jobId);

  if (result.outcome === 'error') {
    core.warning('pr-trailer-api reported a job error; skipping comment.');
    return;
  }
  if (result.outcome === 'timeout') {
    core.warning('pr-trailer-api job did not finish before the polling ceiling; skipping comment.');
    return;
  }

  const commentBody = composeCommentBody(result.job.brief, result.job.audio);

  await upsertPrComment(
    octokit,
    { owner: context.repo.owner, repo: context.repo.repo, pullNumber: pullRequest.number },
    commentBody,
  );

  core.info(`Posted comment on PR #${pullRequest.number}`);
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  core.setFailed(message);
});
```

- [ ] **Step 3: Update `.github/workflows/pr-trailer.yml` to pass the new required `api-url` input**

```yaml
name: pr-trailer

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  run-pr-trailer:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run pr-trailer
        uses: ./
        with:
          api-key: ${{ secrets.PR_TRAILER_API_KEY }}
          api-url: ${{ vars.PR_TRAILER_API_URL }}
          github-token: ${{ github.token }}
```

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all pass — this repo's existing tests (`upsert-comment.test.ts`) plus every test from Tasks 1-3 pass unchanged, and the new `index.ts` compiles cleanly against the new module signatures.

- [ ] **Step 5: Build and verify the committed `dist/` stays in sync (matches CI's own check)**

Run: `npm run build && git diff --exit-code dist/`
Expected: `npm run build` succeeds; `git diff --exit-code dist/` reports no diff is only meaningful after committing — for this step, just confirm the build succeeds without error. The `dist/` diff will be committed together with the source in the next step.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts action.yml .github/workflows/pr-trailer.yml dist/
git commit -m "feat: wire index.ts to real context extraction, job submission/polling, and audio-link comments"
```

---

## Task 5: Documentation

**Files:**
- Modify: `README.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Update the Quickstart workflow block to include `api-url`**

In the "Quickstart" section's YAML block, add the new required input:

```yaml
      - name: Run pr-trailer
        uses: yasel-scf/pr-trailer-ghaction@v1
        with:
          api-key: ${{ secrets.PR_TRAILER_API_KEY }}
          api-url: ${{ vars.PR_TRAILER_API_URL }}
          github-token: ${{ github.token }}
```

- [ ] **Step 2: Update the Inputs table**

Replace the existing table with:

```markdown
| Input | Required | Default | Description |
|---|---|---|---|
| `api-key` | Yes | — | Authenticates requests to the pr-trailer analysis service. |
| `api-url` | Yes | — | Base URL of the deployed `pr-trailer-api` service. |
| `github-token` | No | `${{ github.token }}` | Used to read PR data and post/update the review comment. |
| `exclude-files` | No | `package-lock.json,yarn.lock,pnpm-lock.yaml,Cargo.lock,poetry.lock` | Comma-separated filenames excluded from diff extraction. An empty string excludes nothing. |
```

- [ ] **Step 3: Update the "Example output" section**

Replace the "_Illustrative — final format lands as SPEC-02 completes:_" caveat and example with a real one reflecting the shipped renderer, including the audio line:

```markdown
## Example output

Once installed, `pr-trailer` posts a single comment on each PR and keeps it
up to date as you push new commits — you'll never see duplicate comments.

> 🔊 [Listen to the PR trailer](https://cdn.example.com/audio.mp3) (~42s)
>
> ## 🚦 Review Brief
>
> Adds a login feature with token-based session handling.
>
> **Intent:** Add a login feature
> **Overall risk:** 🔴 High
>
> | File | Risk | Why |
> |---|---|---|
> | `src/auth/session.ts` | 🔴 High | Touches token expiry logic |
> | `src/api/users.ts` | 🟡 Medium | New endpoint, no auth changes |
> | `README.md` | 🟢 Low | Docs only |
>
> ### Suggested reading order
> 1. `src/auth/session.ts` — the core logic change
> 2. `src/api/users.ts` — depends on the above
> 3. `README.md` — no review needed, informational
>
> ---
> 🤖 *Posted by [pr-trailer](https://github.com/yasel-scf/pr-trailer-ghaction)*

The audio link is omitted entirely when text-to-speech fails or degrades —
the comment falls back to text-only with no visible error.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document api-url input and real (non-illustrative) example output"
```

---

## Final verification

- [ ] Run the full suite one more time end-to-end: `npm run typecheck && npm run lint && npm run test && npm run build && git diff --exit-code dist/`
- [ ] Expected: all green, and the committed `dist/` matches a fresh build — this is exactly what CI checks.
- [ ] Manual/end-to-end acceptance (per the design doc, not automatable here): once `pr-trailer-api` from the companion plan is deployed and its secrets are filled in, open a real PR against a repo running this updated Action with a valid `api-key`/`api-url` and confirm the comment shows a text brief and, when TTS succeeds, a working "Listen to the PR trailer" link that plays audio when clicked.
