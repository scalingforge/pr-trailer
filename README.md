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
          api-url: ${{ vars.PR_TRAILER_API_URL }}
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
| `api-url` | Yes | — | Base URL of the deployed `pr-trailer-api` service. |
| `github-token` | No | `${{ github.token }}` | Used to read PR data and post/update the review comment. |
| `exclude-files` | No | `package-lock.json,yarn.lock,pnpm-lock.yaml,Cargo.lock,poetry.lock` | Comma-separated filenames excluded from diff extraction. An empty string excludes nothing. |

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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
