# SPEC-01: Extracción de contexto del PR — Design

Linear: [SCA-110](https://linear.app/scalingforge/issue/SCA-110/spec-01-extraccion-de-contexto-del-pr)
Milestone: GitHub Action + Text Brief MVP (M0)

## Purpose

Given a PR event, fetch all the raw context SPEC-02 needs to build a review
brief: per-file diffs, all commit messages, PR title, and PR body — as a
single typed object, with no risk classification or prioritization applied.

## Out of scope

Any risk classification or file prioritization (deferred post-MVP). Prompt
construction and Claude API calls (SPEC-02). Comment update/marker logic
(SPEC-03).

## Architecture

A new module, `src/github/extract-context.ts`, exports one function:

```ts
export type PrFileStatus =
  | 'added'
  | 'removed'
  | 'modified'
  | 'renamed'
  | 'copied'
  | 'changed'
  | 'unchanged';

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
): Promise<PrContext>;
```

`status` is typed as GitHub's full file-status union (not just the 4 named in
the AC), since the API can return `copied`/`changed`/`unchanged` too and
there's no reason to throw on values the AC didn't enumerate.

`index.ts` calls this function and logs the result via
`core.info(JSON.stringify(context))`, replacing the SPEC-00 fixed test
comment entirely — the comment was scaffolding-only per SPEC-00's own design
doc, and real comment posting with markers is SPEC-03's job.

## Data flow

1. `index.ts` reads inputs: `anthropic-api-key` (still unused), `github-token`,
   and the new `exclude-files` input (see below).
2. Guards on `context.payload.pull_request` existing (unchanged from
   SPEC-00) — logs and returns early if absent.
3. Calls `extractPrContext(octokit, { owner, repo, pullNumber, title, body }, excludeFiles)`:
   - `octokit.paginate(octokit.rest.pulls.listFiles, { owner, repo, pull_number, per_page: 100 })`
     fetches every file across all pages.
   - Files whose basename is in the exclude set are filtered out.
   - Remaining files are mapped to `PrFile`: `patch: file.patch ?? ''` (GitHub
     omits `patch` for binary/oversized diffs — falls back to `''`, mirroring
     the empty-body rule so SPEC-02 never has to null-check).
   - `octokit.paginate(octokit.rest.pulls.listCommits, { owner, repo, pull_number, per_page: 100 })`
     fetches every commit; mapped to `commit.commit.message` strings.
   - `title` and `body` come directly from the event payload (`body ?? ''`)
     — no extra API call, since the payload is guaranteed fresh for the
     `opened`/`synchronize`/`reopened` triggers wired in `pr-trailer.yml`.
4. `index.ts` logs the resulting `PrContext`.
5. Errors bubble to the existing `run().catch()` → `core.setFailed`. No new
   error handling — same minimal approach as SPEC-00.

## Exclude-list handling

`action.yml` gains a new optional input:

```yaml
exclude-files:
  description: 'Comma-separated list of filenames to exclude from diff extraction, overriding the default lockfile exclusions.'
  required: false
  default: 'package-lock.json,yarn.lock,pnpm-lock.yaml,Cargo.lock,poetry.lock'
```

Parsed by splitting on `,`, trimming entries, and dropping empty ones, into a
`Set<string>`. Matching is against each file's **basename**
(`path.basename(file.filename)`), not the full path, so a nested
`packages/foo/package-lock.json` is still excluded by default.

Because `action.yml`'s `default` only applies when the input is entirely
absent from the workflow file, an explicit `exclude-files: ''` is
distinguishable from omitting the input and means "exclude nothing" — this
is the override semantics the AC calls for: when supplied, the input
*replaces* the default list rather than adding to it.

## Testing

- Introduces `vitest` (`npm install --save-dev vitest`, `"test": "vitest run"`
  script), per SPEC-00's note that a test framework lands starting with
  SPEC-01.
- `extractPrContext` takes an octokit-shaped object as a parameter, so tests
  pass a hand-rolled fake (`{ paginate: vi.fn(), rest: { pulls: { listFiles, listCommits } } }`)
  — no HTTP-mocking library needed.
- Pagination is delegated to octokit's own `paginate` helper rather than
  hand-rolled. Tests assert our code calls `octokit.paginate(octokit.rest.pulls.listFiles, ...)`
  (the paginating form, not the raw single-page method) and correctly
  aggregates/maps/filters a mocked 150-item result — this is what verifies
  the ">100 files" AC without re-testing octokit's own library code.
- Test cases:
  - Default lockfile exclusion, including a nested path.
  - Override input replacing the defaults.
  - Empty-string override → no exclusion.
  - Missing `patch` field → falls back to `''`.
  - Empty PR body → `''`, never `null`.
  - Each `PrFileStatus` value passes through correctly.
  - Commit messages include every commit, not just the PR title.
- `.github/workflows/ci.yml` gains a `Test` step (`npm run test`) alongside
  the existing typecheck/lint/build steps.

## Decisions log

| Decision | Choice | Rationale |
|---|---|---|
| Wiring | Extraction wired into `index.ts`, result logged | Gives an end-to-end smoke test on a real PR; keeps SPEC-02 easy to plug in next |
| Override semantics | Replace, not additive | Matches the literal word "override" in the AC; simplest to reason about |
| Missing `patch` | Falls back to `''` | Mirrors the existing empty-PR-body rule; SPEC-02 never null-checks |
| Fixed test comment | Removed | Was scaffolding-only per SPEC-00's design doc; real comment posting is SPEC-03's job |
| Title/body source | Event payload, not a `pulls.get` re-fetch | Payload is already fresh for the only wired trigger types; avoids a speculative extra API call |
| Exclude matching | By basename | Catches lockfiles nested in workspace subdirectories, which the AC's flat filename list implies but doesn't rule out |
| Pagination | Delegated to `octokit.paginate` | Well-tested library behavior; hand-rolling page-following logic would be redundant and untested-by-us risk |
| Test framework | vitest | Per SPEC-00's own deferred decision |
