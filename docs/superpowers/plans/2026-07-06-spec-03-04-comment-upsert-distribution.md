# SPEC-03 & SPEC-04: Comment upsert and Action distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `pr-trailer` from posting a duplicate PR comment on every run, and make the Action self-serve installable via a README.

**Architecture:** A new `src/github/upsert-comment.ts` module scans existing PR comments for a hidden marker and either updates the tracked comment or creates it; `src/index.ts` calls it instead of `octokit.rest.issues.createComment` directly. `README.md` documents the existing `action.yml` inputs with a quickstart workflow and a self-serve API key section.

**Tech Stack:** TypeScript, `@actions/core`, `@actions/github` (Octokit), vitest (new), `@vercel/ncc`.

## Global Constraints

- Marker string is exactly `<!-- pr-trailer:v1 -->` (spec AC, verbatim).
- Footer signature: `🤖 *Posted by [pr-trailer](https://github.com/yasel-scf/pr-trailer-ghaction)*`.
- Comment body order: marker, then content, then footer — always in that order.
- `action.yml` inputs do not change: `api-key` (required), `github-token` (optional, default `${{ github.token }}`).
- README is written in English only (public-facing copy convention for this project).
- README documents only the inputs that exist in `action.yml` today — no `exclude-files` or other SPEC-01 inputs.
- Node engine is `24.x`; `tsc --noEmit` runs in `strict` mode — new code must satisfy it.
- Commits follow Conventional Commits (`CONTRIBUTING.md`): `type(scope): description`, small and scoped.
- `dist/index.js` is committed and must be rebuilt (`npm run build`) after any `src/` change — CI fails the build if `dist/` is stale relative to `src/`.

---

## Task 1: `upsert-comment` module with vitest test coverage

**Files:**
- Modify: `package.json` (add `vitest` devDependency, add `test` script)
- Modify: `.github/workflows/ci.yml` (add a `Test` step)
- Create: `src/github/upsert-comment.ts`
- Test: `src/github/upsert-comment.test.ts`

**Interfaces:**
- Produces: `PR_TRAILER_MARKER: string`, `type Octokit = ReturnType<typeof github.getOctokit>`, `upsertPrComment(octokit: Octokit, params: { owner: string; repo: string; pullNumber: number }, body: string): Promise<void>` — consumed by Task 2.

- [ ] **Step 1: Install vitest**

Run: `npm install --save-dev vitest`

Expected: `vitest` added to `package.json` devDependencies and `package-lock.json` updated.

- [ ] **Step 2: Add the `test` script to `package.json`**

In `package.json`, change:

```json
  "scripts": {
    "build": "ncc build src/index.ts -o dist",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
```

to:

```json
  "scripts": {
    "build": "ncc build src/index.ts -o dist",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Write the failing tests**

Create `src/github/upsert-comment.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { PR_TRAILER_MARKER, upsertPrComment, type Octokit } from './upsert-comment';

function createFakeOctokit(comments: Array<{ id: number; body?: string }>) {
  const listComments = vi.fn();
  const createComment = vi.fn();
  const updateComment = vi.fn();
  const paginate = vi.fn().mockResolvedValue(comments);

  const octokit = {
    paginate,
    rest: {
      issues: {
        listComments,
        createComment,
        updateComment,
      },
    },
  } as unknown as Octokit;

  return { octokit, paginate, listComments, createComment, updateComment };
}

const params = { owner: 'acme', repo: 'widgets', pullNumber: 42 };

describe('upsertPrComment', () => {
  it('creates a new comment when none has the marker', async () => {
    const { octokit, paginate, listComments, createComment, updateComment } = createFakeOctokit([
      { id: 1, body: 'unrelated comment' },
    ]);

    await upsertPrComment(octokit, params, 'brief content');

    expect(paginate).toHaveBeenCalledWith(listComments, {
      owner: 'acme',
      repo: 'widgets',
      issue_number: 42,
      per_page: 100,
    });
    expect(createComment).toHaveBeenCalledTimes(1);
    expect(updateComment).not.toHaveBeenCalled();
  });

  it('updates the existing tracked comment when the marker is present', async () => {
    const { octokit, createComment, updateComment } = createFakeOctokit([
      { id: 1, body: 'unrelated comment' },
      { id: 2, body: `${PR_TRAILER_MARKER}\n\nold brief` },
    ]);

    await upsertPrComment(octokit, params, 'new brief content');

    expect(updateComment).toHaveBeenCalledTimes(1);
    expect(updateComment.mock.calls[0][0]).toMatchObject({
      owner: 'acme',
      repo: 'widgets',
      comment_id: 2,
    });
    expect(createComment).not.toHaveBeenCalled();
  });

  it('ignores comments from other users that do not contain the marker', async () => {
    const { octokit, createComment } = createFakeOctokit([
      { id: 1, body: 'a bot comment with no marker' },
      { id: 2, body: undefined },
    ]);

    await upsertPrComment(octokit, params, 'brief content');

    expect(createComment).toHaveBeenCalledTimes(1);
  });

  it('composes the body as marker, then content, then footer signature', async () => {
    const { octokit, createComment } = createFakeOctokit([]);

    await upsertPrComment(octokit, params, 'brief content');

    const body = createComment.mock.calls[0][0].body as string;
    const markerIndex = body.indexOf(PR_TRAILER_MARKER);
    const contentIndex = body.indexOf('brief content');
    const footerIndex = body.indexOf('Posted by [pr-trailer]');

    expect(markerIndex).toBe(0);
    expect(contentIndex).toBeGreaterThan(markerIndex);
    expect(footerIndex).toBeGreaterThan(contentIndex);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module './upsert-comment'` (the module doesn't exist yet).

- [ ] **Step 5: Implement `upsert-comment.ts`**

Create `src/github/upsert-comment.ts`:

```ts
import * as github from '@actions/github';

export type Octokit = ReturnType<typeof github.getOctokit>;

export const PR_TRAILER_MARKER = '<!-- pr-trailer:v1 -->';

const FOOTER = '🤖 *Posted by [pr-trailer](https://github.com/yasel-scf/pr-trailer-ghaction)*';

function composeBody(body: string): string {
  return `${PR_TRAILER_MARKER}\n\n${body}\n\n---\n${FOOTER}`;
}

export async function upsertPrComment(
  octokit: Octokit,
  params: { owner: string; repo: string; pullNumber: number },
  body: string,
): Promise<void> {
  const { owner, repo, pullNumber } = params;
  const composedBody = composeBody(body);

  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pullNumber,
    per_page: 100,
  });

  const existing = comments.find((comment) => comment.body?.includes(PR_TRAILER_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: composedBody,
    });
    return;
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body: composedBody,
  });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS — all 4 tests in `upsert-comment.test.ts` green.

- [ ] **Step 7: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0, no errors.

- [ ] **Step 8: Add the `Test` step to CI**

In `.github/workflows/ci.yml`, change:

```yaml
      - name: Lint
        run: npm run lint

      - name: Rebuild dist
        run: npm run build
```

to:

```yaml
      - name: Lint
        run: npm run lint

      - name: Test
        run: npm run test

      - name: Rebuild dist
        run: npm run build
```

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .github/workflows/ci.yml src/github/upsert-comment.ts src/github/upsert-comment.test.ts
git commit -m "feat(github): add upsertPrComment to create-or-update the tracked PR comment"
```

---

## Task 2: Wire `upsertPrComment` into `index.ts`

**Files:**
- Modify: `src/index.ts`
- Modify: `dist/index.js` (rebuilt output, not hand-edited)

**Interfaces:**
- Consumes: `upsertPrComment(octokit: Octokit, params: { owner: string; repo: string; pullNumber: number }, body: string): Promise<void>` from `./github/upsert-comment` (Task 1).

- [ ] **Step 1: Replace the direct `createComment` call**

In `src/index.ts`, change the import block:

```ts
import * as core from '@actions/core';
import * as github from '@actions/github';
```

to:

```ts
import * as core from '@actions/core';
import * as github from '@actions/github';
import { upsertPrComment } from './github/upsert-comment';
```

Then change:

```ts
  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: pullRequest.number,
    body: message,
  });

  core.info(`Posted comment on PR #${pullRequest.number}`);
```

to:

```ts
  await upsertPrComment(
    octokit,
    { owner: context.repo.owner, repo: context.repo.repo, pullNumber: pullRequest.number },
    message,
  );

  core.info(`Posted comment on PR #${pullRequest.number}`);
```

- [ ] **Step 2: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0, no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: PASS — `upsert-comment.test.ts` still green (unaffected by this change).

- [ ] **Step 4: Rebuild `dist/`**

Run: `npm run build`
Expected: `dist/index.js` is rewritten to bundle the new import.

- [ ] **Step 5: Verify `dist/` is committed clean**

Run: `git status --porcelain dist/`
Expected: shows `dist/index.js` as modified (about to be committed in the next step, not stale).

- [ ] **Step 6: Commit**

```bash
git add src/index.ts dist/index.js
git commit -m "feat: post PR comments through upsertPrComment instead of always creating a new one"
```

---

## Task 3: README for self-serve installation

**Files:**
- Create: `README.md`

**Interfaces:**
- None — this task only produces documentation. It reflects `action.yml`'s current inputs (`api-key`, `github-token`) and the SPEC-03 comment format (marker + footer from Task 1), but adds no code.

- [ ] **Step 1: Write `README.md`**

Create `README.md`:

```markdown
# pr-trailer

A GitHub Action that analyzes a pull request and posts a risk-prioritized
review brief as a PR comment — updated in place on every push, never
duplicated.

## Quickstart

Add this workflow file to your repo at `.github/workflows/pr-trailer.yml`:

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
        uses: yasel-scf/pr-trailer-ghaction@v1
        with:
          api-key: ${{ secrets.PR_TRAILER_API_KEY }}
          github-token: ${{ github.token }}
```

That's it — no other code changes are needed in your repo.

## Getting an API key

Request an API key at https://TODO-replace-with-pr-trailer-signup-url, then
add it as a secret in your repo (**Settings → Secrets and variables →
Actions**) named `PR_TRAILER_API_KEY`.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `api-key` | Yes | — | Authenticates requests to the pr-trailer analysis service. |
| `github-token` | No | `${{ github.token }}` | Used to read PR data and post/update the review comment. |

## Example output

Once installed, `pr-trailer` posts a single comment on each PR and keeps it
up to date as you push new commits — you'll never see duplicate comments.

_Illustrative — final format lands as SPEC-02 completes:_

> ## 🚦 Review Brief
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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
```

- [ ] **Step 2: Verify the quickstart YAML is valid**

Run: `python3 -c "import yaml, re; text=open('README.md').read(); block=re.search(r'\`\`\`yaml\n(.*?)\`\`\`', text, re.S).group(1); yaml.safe_load(block); print('OK')"`
Expected: prints `OK` (parses as valid YAML; catches indentation/syntax mistakes before merge).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with quickstart, API key setup, and inputs reference"
```

---

## Self-Review Notes

- **Spec coverage:** SPEC-03's marker/upsert/footer/testing requirements → Task 1. `index.ts` wiring → Task 2. SPEC-04's `action.yml` (no change needed, confirmed in Global Constraints), quickstart workflow, API key section, inputs table, illustrative output → Task 3.
- **Type consistency:** `Octokit` type, `PR_TRAILER_MARKER`, and `upsertPrComment`'s signature are defined once in Task 1 and reused verbatim (same param names: `owner`, `repo`, `pullNumber`) in Task 2.
- **No placeholders** in code or config steps. The one literal placeholder (`https://TODO-replace-with-pr-trailer-signup-url`) is a deliberate, spec-approved README placeholder — not a plan gap — and is called out explicitly in the design doc's decisions log.
