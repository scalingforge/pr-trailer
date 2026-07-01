# SPEC-00: Setup inicial del Action — Design

Linear: [SCA-109](https://linear.app/scalingforge/issue/SCA-109/spec-00-setup-inicial-del-action)
Milestone: GitHub Action + Text Brief MVP (M0)

## Purpose

Scaffold the `pr-trailer` GitHub Action project so that a real, installable
Action runs end-to-end on a real PR — build tooling, folder structure, and a
"hello world" comment, with no business logic yet. Nothing else in M0 can be
validated without this running.

## Out of scope

Any PR-context extraction, prompt construction, or brief generation logic.
Those land in SPEC-01/02. Comment update/marker logic lands in SPEC-03.

## Project structure

```
pr-trailer/
├── action.yml
├── package.json
├── tsconfig.json
├── eslint.config.js
├── .prettierrc
├── src/
│   ├── index.ts          # entrypoint: reads inputs, posts fixed comment
│   ├── github/.gitkeep
│   ├── prompt/.gitkeep
│   ├── claude/.gitkeep
│   └── render/.gitkeep
├── dist/
│   └── index.js          # committed, built by ncc
└── .github/workflows/
    ├── ci.yml             # build, typecheck, lint, dist-freshness check
    └── pr-trailer.yml     # uses: ./ on pull_request → posts test comment
```

## Components

- **`action.yml`**: `runs: { using: node20, main: dist/index.js }`.
  Inputs: `anthropic-api-key` (required, unused this spec — declared only),
  `github-token` (default `${{ github.token }}`).
- **`src/index.ts`**: uses `@actions/core` to read inputs and
  `@actions/github` (octokit) to post a single fixed comment (e.g. "🤖
  pr-trailer scaffold is alive") on the current PR. No comment-update/marker
  logic — that's SPEC-03. All logic lives inline in this file for now.
- **Placeholder dirs**: `src/github/`, `src/prompt/`, `src/claude/`,
  `src/render/` are empty except for `.gitkeep`, establishing the module
  boundaries future specs will fill: `github/` = API calls, `prompt/` =
  prompt construction, `claude/` = Claude API calls, `render/` = brief
  formatting.

## Build & tooling

- **npm** as package manager; `engines.node` set to `20.x` in `package.json`.
- **@vercel/ncc** bundles `src/index.ts` → `dist/index.js` as a single
  committed file — no `node_modules` installed at Action runtime.
- **ESLint + Prettier** (`typescript-eslint` recommended config) for lint;
  `tsc --noEmit` for type-checking.
- No unit test framework in this spec — nothing meaningful to unit-test yet.
  Introduce one (e.g. vitest) starting with SPEC-01 once real logic exists.

## CI / e2e

- **`.github/workflows/ci.yml`** (on push / pull_request): `npm ci` →
  `tsc --noEmit` → `eslint` → rebuild via `ncc` → `git diff --exit-code
  dist/` to fail the build if the committed `dist/` is stale relative to
  `src/`.
- **`.github/workflows/pr-trailer.yml`** (on `pull_request`): runs the
  action against this same repo via `uses: ./`, posting the fixed test
  comment. This is the literal e2e acceptance test for this spec, and it
  doubles as the permanent trigger workflow that later specs build real
  logic behind — no separate throwaway test repo.

## Error handling

Minimal for this spec: if posting the comment fails, call
`core.setFailed(err.message)` so the workflow run surfaces a failure
instead of swallowing the exception silently. No retry/backoff — deferred
until real business logic exists to protect.

## Testing

- **Automated**: `ci.yml` covers type-check, lint, and dist-freshness on
  every push.
- **Manual/e2e acceptance**: open a PR against this repo and confirm
  `pr-trailer.yml` runs and posts the fixed comment. This is the concrete
  acceptance criterion from SCA-109 ("instalado en un repo real, se ejecuta
  al abrir un PR y publica un comentario fijo de prueba").

## Decisions log

| Decision | Choice | Rationale |
|---|---|---|
| E2E target | This repo, self-referential (`uses: ./`) | No throwaway repo to maintain; the workflow becomes permanent product infrastructure |
| Bundler | @vercel/ncc | De-facto standard for JS/TS GitHub Actions |
| Package manager | npm | Zero extra CI setup |
| Lint/format | ESLint + Prettier | Mature TS ecosystem support |
| Unit tests | None yet | No real logic to test until SPEC-01+ |
| Placeholder folders | Empty + `.gitkeep`, logic inline in `index.ts` | Keeps this spec pure scaffolding |
| CI/e2e workflows | Two separate files | Separates code-health gate from product-behavior check |
