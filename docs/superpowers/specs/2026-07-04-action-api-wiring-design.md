# Action ↔ pr-trailer-api wiring — Design

Linear: none yet (architecture/infra decision, not yet tracked as a Linear spec issue)
Precedes: SCA-110 (SPEC-01) and the rest of the M0/M1 roadmap
Repos affected: `pr-trailer-ghaction` (this repo) and `pr-trailer-api` (sibling repo)

## Purpose

Every spec from SPEC-01 onward was originally scoped to run entirely inside
the GitHub Action, including prompt construction and direct Anthropic API
calls. That plan changes here: the Action becomes a thin client, and the
actual analysis (prompt construction, Claude calls, and later the audio
pipeline) moves to a separate hosted service, `pr-trailer-api` (Hono),
authenticated via an API key. This spec covers only the wiring between the
two — the minimal end-to-end path that proves the Action can reach the API,
authenticate, and use the response — before SPEC-01 builds real PR context
extraction on top of it.

## Out of scope

- Real PR context extraction (diff/commits/title/body) — still SPEC-01.
- Prompt construction and Claude calls — still SPEC-02, now living in
  `pr-trailer-api` instead of the Action.
- Multi-client / per-customer API keys — single fixed key for now.
- Permanent infrastructure (CDK, Lambda Provisioned Concurrency, CloudFront,
  WAF) as described in `pr-trailer-api`'s
  `docs/architecture/aws-hono-api-architecture.md` — deferred to a dedicated
  deploy spec. This spec only needs a temporary, unauthenticated-at-the-edge
  Lambda Function URL to prove connectivity.

## Architecture

```
pr-trailer-ghaction (Action, thin client)
  1. Reads pull_request event
  2. POST {api-url}/brief   Header: X-API-Key: {api-key}   Body: { ping: true }
  3. Receives { message } (200) or an error (401/network failure)
  4. Posts `message` as a PR comment, or core.setFailed on error

pr-trailer-api (Hono, server)
  POST /brief
    - Validates X-API-Key against env var API_KEY
    - 401 if missing/mismatched
    - 200 { message: 'pr-trailer-api scaffold is alive' } if valid
    - Never talks to GitHub or Claude in this spec
```

## Components

### `pr-trailer-ghaction`

- **`action.yml`**: removes the `anthropic-api-key` input entirely (the
  Anthropic key now lives only server-side in `pr-trailer-api`, never passed
  through the Action). Adds:
  - `api-key` (required): the `pr-trailer-api` authentication key.
  - `api-url` (required, no default): base URL of the deployed
    `pr-trailer-api` instance.
  - `github-token` stays as-is (still needed to post the comment).
- **`src/index.ts`**: replaces the fixed test-comment logic with a call to
  `{api-url}/brief` using Node 24's native `fetch` (no new HTTP dependency),
  sending the `X-API-Key` header. Posts the returned `message` as the PR
  comment. A non-2xx response or network failure calls `core.setFailed` with
  a clear message distinguishing auth failure from network/connectivity
  failure — same pattern SPEC-00 already established for error handling.

### `pr-trailer-api`

- **`src/index.ts`**: adds a `POST /brief` route on the existing (currently
  empty) Hono `app`. Middleware validates `X-API-Key` against
  `process.env.API_KEY`; returns 401 on failure, otherwise
  `{ message: 'pr-trailer-api scaffold is alive' }`.
- **Lambda adapter**: adds `hono/aws-lambda`'s `handle(app)` as the Lambda
  entrypoint, alongside (not replacing) the existing `@hono/node-server`
  entrypoint used for local `npm run dev`. Both wrap the same exported `app`,
  so the route logic is never duplicated.

## Auth model

- Single fixed API key for the MVP/dogfooding phase — no per-client key
  issuance or storage yet (that's a later concern if/when this backs a
  multi-tenant SaaS offering, per the existing architecture doc's open
  items).
- Header name: `X-API-Key`, on both sides.
- `pr-trailer-api` reads the expected key from `process.env.API_KEY` at
  request time — no hardcoded value in source.

## Deploy (temporary)

- A manually-created AWS Lambda + Function URL (no CDK, no Provisioned
  Concurrency, no CloudFront, no WAF — those remain deferred to the
  dedicated deploy spec described in
  `pr-trailer-api/docs/architecture/aws-hono-api-architecture.md`).
- `API_KEY` set as a Lambda environment variable.
- The resulting Function URL is used as the `api-url` input (and a matching
  secret for `api-key`) in `pr-trailer-ghaction`'s e2e workflow.
- This deploy is explicitly throwaway: it will be replaced by the real
  Lambda + Provisioned Concurrency + CloudFront + WAF stack without any
  change to the HTTP contract (`POST /brief`, `X-API-Key` header) once the
  deploy spec lands.

## Error handling

- **Action side**: any non-2xx response or thrown error from `fetch` is
  caught and passed to `core.setFailed`, distinguishing a 401 (bad
  `api-key`) from other failures (network, 5xx) in the message, so workflow
  runs never fail silently — consistent with SPEC-00's error-handling
  approach.
- **API side**: missing/invalid `X-API-Key` returns 401 with no leakage of
  the expected key value. No retry logic needed yet (this is a stateless
  ping, not the eventual Claude-backed call).

## Testing

- **Automated**: no new unit tests in either repo yet — neither has a test
  framework, and there's no real logic to unit-test in a wiring-only change.
- **Manual/e2e acceptance**: `pr-trailer-ghaction`'s existing
  `pr-trailer.yml` e2e workflow (from SPEC-00) is updated to pass `api-key`
  and `api-url`, pointed at the temporary Lambda deploy. Opening a PR against
  `pr-trailer-ghaction` and seeing the API-sourced message posted as a
  comment is the concrete acceptance criterion for this spec — the same
  self-referential e2e pattern SPEC-00 established.

## Decisions log

| Decision | Choice | Rationale |
|---|---|---|
| Extraction location | Stays in the Action | Action already holds `github-token` from the event context; keeps the API GitHub-agnostic |
| `anthropic-api-key` input | Removed, replaced by `api-key` | Anthropic key becomes a server-side secret in `pr-trailer-api`; the Action never sees it |
| API key scope | Single fixed key (env var) | MVP/dogfooding phase, no multi-tenant need yet |
| Refactor scope | Wiring only, no real extraction | Keeps this change small and independently verifiable before SPEC-01 lands on top |
| Temporary deploy target | Bare AWS Lambda Function URL | Closer to the final architecture than an unrelated PaaS, without paying the CDK/CloudFront/WAF cost yet |
| HTTP client | Native `fetch` (Node 24) | No new dependency needed |
| Lambda handler | `hono/aws-lambda` alongside existing `@hono/node-server` entry | Single `app` export serves both local dev and Lambda without duplicating route logic |
