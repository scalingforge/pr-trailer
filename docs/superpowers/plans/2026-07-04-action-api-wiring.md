# Action/API Wiring Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewire `pr-trailer-ghaction` from a self-contained Action into a thin client that authenticates to a separate `pr-trailer-api` service (Hono) via an API key and posts whatever the service returns — proving the two-repo path works end-to-end before SPEC-01 builds real PR context extraction on top of it.

**Architecture:** `pr-trailer-api` gains a `POST /brief` route that validates an `X-API-Key` header against `process.env.API_KEY` and returns a fixed test message, plus a `hono/aws-lambda` handler alongside its existing local dev server. `pr-trailer-ghaction`'s `action.yml` drops `anthropic-api-key` in favor of `api-key` + `api-url` inputs, and `src/index.ts` calls `{api-url}/brief` with Node 24's native `fetch`, posting the returned `message` as the PR comment.

**Tech Stack:** TypeScript, Node 24 (both repos), Hono (`pr-trailer-api`), `@actions/core`/`@actions/github` (`pr-trailer-ghaction`), native `fetch`, `hono/aws-lambda`. No unit test framework in either repo — verification is via manual local runs (deterministic env-var-driven checks), consistent with the design spec.

## Global Constraints

- Two repos involved, both on disk as sibling directories:
  - `pr-trailer-ghaction` — this repo (plan lives here).
  - `pr-trailer-api` — sibling repo at `../pr-trailer-api` relative to this repo's root.
- Auth header: `X-API-Key` on both sides. Single fixed key via `process.env.API_KEY` (server) / `api-key` input (client) — no per-client key storage yet.
- `pr-trailer-ghaction`'s `anthropic-api-key` input is removed entirely and replaced by `api-key` (required) + `api-url` (required, no default).
- No new HTTP client dependency — use Node 24's global `fetch`.
- No new dependency for the Lambda adapter — `hono/aws-lambda` is a subpath of the already-installed `hono` package.
- No unit test framework introduced in either repo (per design spec) — verification steps below use manual local runs instead.
- Out of scope: real PR context extraction, prompt construction, Claude calls, CDK/Provisioned Concurrency/CloudFront/WAF (all deferred, see design spec).

---

### Task 1: `pr-trailer-api` — `POST /brief` route with API-key auth

**Files:**
- Modify: `../pr-trailer-api/src/index.ts`

**Interfaces:**
- Consumes: existing `Hono` `app` instance (already exported as `default`).
- Produces: a `/brief` route on that same `app` — consumed locally by Task 5's verification (via `npm run dev`) and, once deployed, by `pr-trailer-ghaction`'s runtime calls.

- [ ] **Step 1: Add the route**

Replace the contents of `../pr-trailer-api/src/index.ts` with:

```typescript
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

app.post('/brief', (c) => {
  const apiKey = c.req.header('X-API-Key');
  const expectedKey = process.env.API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return c.json({ message: 'pr-trailer-api scaffold is alive' });
});

if (require.main === module) {
  const port = Number(process.env.PORT ?? 8787);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`pr-trailer-api scaffold listening on http://localhost:${info.port}`);
  });
}

export default app;
```

- [ ] **Step 2: Typecheck**

Run (from `../pr-trailer-api`): `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 3: Lint**

Run (from `../pr-trailer-api`): `npm run lint`
Expected: exits 0, no errors.

- [ ] **Step 4: Manually verify both the 401 and 200 paths**

Run (from `../pr-trailer-api`), in one terminal:
```bash
API_KEY=test123 npm run dev
```
Expected: prints `pr-trailer-api scaffold listening on http://localhost:8787`.

In another shell:
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8787/brief
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8787/brief -H 'X-API-Key: wrong'
curl -s -X POST http://localhost:8787/brief -H 'X-API-Key: test123'
```
Expected: first two print `401`; the third prints `{"message":"pr-trailer-api scaffold is alive"}`.

Stop the dev server (Ctrl-C) before continuing.

- [ ] **Step 5: Commit**

```bash
cd ../pr-trailer-api
git add src/index.ts
git commit -m "feat: add POST /brief route with X-API-Key auth"
```

---

### Task 2: `pr-trailer-api` — Lambda handler adapter

**Files:**
- Create: `../pr-trailer-api/src/lambda.ts`

**Interfaces:**
- Consumes: default-exported `app` from `./index` (Task 1).
- Produces: named export `handler` — the entrypoint Task 7's manual Lambda deploy points at (`dist/lambda.handler` after `npm run build`).

- [ ] **Step 1: Write `../pr-trailer-api/src/lambda.ts`**

```typescript
import { handle } from 'hono/aws-lambda';
import app from './index';

export const handler = handle(app);
```

- [ ] **Step 2: Typecheck**

Run (from `../pr-trailer-api`): `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 3: Build and confirm the handler is exported as a function**

Run (from `../pr-trailer-api`):
```bash
npm run build
node -e "console.log(typeof require('./dist/lambda.js').handler)"
```
Expected: build exits 0; the `node -e` command prints `function`.

- [ ] **Step 4: Commit**

```bash
cd ../pr-trailer-api
git add src/lambda.ts
git commit -m "feat: add hono/aws-lambda handler for Lambda Function URL deploy"
```

---

### Task 3: `pr-trailer-ghaction` — `action.yml` inputs

**Files:**
- Modify: `action.yml`

**Interfaces:**
- Produces: `api-key` and `api-url` inputs, consumed by `src/index.ts` (Task 4) and by the e2e workflow (Task 6). Replaces `anthropic-api-key`, which no longer exists after this task.

- [ ] **Step 1: Rewrite `action.yml`**

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
runs:
  using: 'node24'
  main: 'dist/index.js'
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('action.yml'))" && echo OK`
Expected: prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add action.yml
git commit -m "feat: replace anthropic-api-key with api-key and api-url inputs"
```

---

### Task 4: `pr-trailer-ghaction` — call `pr-trailer-api` from `src/index.ts`

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `api-key`/`api-url` inputs (Task 3); `POST /brief` contract from Task 1 (`{ message: string }` on 200, 401 on bad key).
- Produces: the entrypoint Task 5 rebuilds into `dist/index.js`.

- [ ] **Step 1: Rewrite `src/index.ts`**

```typescript
import * as core from '@actions/core';
import * as github from '@actions/github';

interface BriefResponse {
  message: string;
}

async function run(): Promise<void> {
  const apiKey = core.getInput('api-key', { required: true });
  const apiUrl = core.getInput('api-url', { required: true });
  const githubToken = core.getInput('github-token', { required: true });

  const octokit = github.getOctokit(githubToken);
  const { context } = github;

  const pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    core.info('No pull_request in event payload; skipping comment.');
    return;
  }

  const response = await fetch(`${apiUrl}/brief`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ ping: true }),
  });

  if (response.status === 401) {
    throw new Error('pr-trailer-api rejected the request: invalid api-key.');
  }
  if (!response.ok) {
    throw new Error(`pr-trailer-api request failed with status ${response.status}.`);
  }

  const { message } = (await response.json()) as BriefResponse;

  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: pullRequest.number,
    body: message,
  });

  core.info(`Posted comment on PR #${pullRequest.number}`);
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  core.setFailed(message);
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: call pr-trailer-api /brief instead of posting a fixed comment"
```

---

### Task 5: `pr-trailer-ghaction` — rebuild `dist/` and verify against a local API

**Files:**
- Create/update: `dist/index.js` (and accompanying files ncc emits)

**Interfaces:**
- Consumes: `src/index.ts` (Task 4), a locally running `pr-trailer-api` (Task 1).
- Produces: the exact bundle `action.yml` (Task 3) points `main` at, and what CI's dist-freshness check diffs against.

- [ ] **Step 1: Rebuild the bundle**

Run: `npm run build`
Expected: exits 0, `dist/index.js` updated.

- [ ] **Step 2: Start `pr-trailer-api` locally**

Run (from `../pr-trailer-api`, separate terminal):
```bash
API_KEY=test123 npm run dev
```
Expected: listening on `http://localhost:8787`.

- [ ] **Step 3: Verify the wrong-key path fails deterministically before any GitHub call**

Run (from this repo):
```bash
env \
  'INPUT_API-KEY=wrongkey' \
  'INPUT_API-URL=http://localhost:8787' \
  'INPUT_GITHUB-TOKEN=fake-token' \
  GITHUB_EVENT_PATH=/tmp/pr-trailer-fake-event.json \
  GITHUB_REPOSITORY=octocat/hello-world \
  node dist/index.js; echo "exit: $?"
```

First create the fake event file used above:
```bash
cat > /tmp/pr-trailer-fake-event.json <<'EOF'
{"pull_request": {"number": 1}}
EOF
```
(Run this once before the `env ... node dist/index.js` command above.)

Expected: stderr contains `::error::pr-trailer-api rejected the request: invalid api-key.` and `exit: 1`. This confirms the error surfaces from the API call, not from GitHub — no GitHub call is reached with a bad key.

- [ ] **Step 4: Verify the correct-key path reaches the API successfully**

Run:
```bash
env \
  'INPUT_API-KEY=test123' \
  'INPUT_API-URL=http://localhost:8787' \
  'INPUT_GITHUB-TOKEN=fake-token' \
  GITHUB_EVENT_PATH=/tmp/pr-trailer-fake-event.json \
  GITHUB_REPOSITORY=octocat/hello-world \
  node dist/index.js; echo "exit: $?"
```
Expected: the process fails at the GitHub comment call (fake token / non-existent PR), **not** with the "invalid api-key" or "pr-trailer-api request failed" message — e.g. an error mentioning `Bad credentials` or `Not Found` from the GitHub API. This confirms the fetch to `pr-trailer-api` succeeded (status 200, `message` parsed) before the (expected, unavoidable without a real PR) GitHub failure.

Stop the local `pr-trailer-api` dev server (Ctrl-C) once done.

- [ ] **Step 5: Commit the rebuilt bundle**

```bash
git add dist/
git commit -m "build: rebuild dist/index.js for the api-key/api-url wiring"
```

---

### Task 6: `pr-trailer-ghaction` — update the e2e workflow

**Files:**
- Modify: `.github/workflows/pr-trailer.yml`

**Interfaces:**
- Consumes: `action.yml` inputs `api-key`/`api-url` (Task 3).
- Produces: the workflow that becomes the real e2e acceptance check once Task 7's deploy exists.

- [ ] **Step 1: Update the workflow's `with:` block**

Replace the `Run pr-trailer` step in `.github/workflows/pr-trailer.yml` with:

```yaml
      - name: Run pr-trailer
        uses: ./
        with:
          api-key: ${{ secrets.PR_TRAILER_API_KEY }}
          api-url: ${{ vars.PR_TRAILER_API_URL }}
          github-token: ${{ github.token }}
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/pr-trailer.yml'))" && echo OK`
Expected: prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pr-trailer.yml
git commit -m "ci: pass api-key/api-url to pr-trailer in the e2e workflow"
```

---

### Task 7: Manual deploy step (cannot be done from this environment)

**Files:** none — infrastructure/configuration only.

This task requires AWS console/CLI access and GitHub repo admin access that this environment does not have. Whoever picks this up needs to:

1. Build `pr-trailer-api` (`npm run build` in `../pr-trailer-api`) and deploy `dist/lambda.js`'s `handler` export to a new AWS Lambda function (Node 24 runtime, ARM64), with a Function URL enabled (auth type `NONE` is acceptable for this throwaway deploy — the real origin-lockdown/WAF work is a separate deploy spec).
2. Set the Lambda's `API_KEY` environment variable to a real generated key (not `test123`).
3. In the `pr-trailer-ghaction` GitHub repo settings, add:
   - Secret `PR_TRAILER_API_KEY` = the same value as the Lambda's `API_KEY`.
   - Variable `PR_TRAILER_API_URL` = the Lambda Function URL.
4. Open a PR against `pr-trailer-ghaction` and confirm the `pr-trailer` workflow posts `pr-trailer-api scaffold is alive` as a comment — this is the concrete end-to-end acceptance criterion for this spec.

No commit for this task.

---

### Task 8: Final verification pass (both repos)

**Files:** none created; this task only runs checks across both repos.

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: confidence that both repos build/lint/typecheck clean and `dist/` in both is fresh, ready for the report back to the user.

- [ ] **Step 1: `pr-trailer-api` — fresh install and checks**

Run (from `../pr-trailer-api`):
```bash
rm -rf node_modules && npm ci
npm run typecheck
npm run lint
npm run build
```
Expected: every command exits 0.

- [ ] **Step 2: `pr-trailer-ghaction` — fresh install and checks**

Run (from this repo):
```bash
rm -rf node_modules && npm ci
npm run typecheck
npm run lint
npm run build
git status --porcelain dist/
```
Expected: every command exits 0; `git status --porcelain dist/` prints nothing (the committed bundle from Task 5 matches a fresh build).

- [ ] **Step 3: Confirm commit history in both repos**

Run:
```bash
git log --oneline -8
git -C ../pr-trailer-api log --oneline -5
```
Expected: shows the new commits from Tasks 1–6 in each repo.

No commit for this task — it is verification-only. If any step fails, fix the underlying task and re-run this whole task before reporting completion.
