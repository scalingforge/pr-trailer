# pr-trailer

**Know what a pull request changed before you start reading it.**

`pr-trailer` analyzes each pull request and posts a single, risk-prioritized
review brief as a comment — which files are risky, why, and what order to
read them in. The comment updates in place on every push, so it never
clutters the thread.

Built and operated by [ScalingForge](https://scalingforge.com).

## What you get

- **A risk ranking per file** — so you spend review time where it matters.
- **A suggested reading order** — the dependency-aware path through the diff.
- **An audio trailer** — a short spoken summary of the PR, when available.
- **One comment, always current** — updated in place, never duplicated.

## Quickstart

Add this workflow to your repository at `.github/workflows/pr-trailer.yml`:

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
        uses: yasel-scf/pr-trailer@v1
        with:
          api-key: ${{ secrets.PR_TRAILER_API_KEY }}
          api-url: ${{ vars.PR_TRAILER_API_URL }}
          github-token: ${{ github.token }}
```

No other changes to your codebase are needed.

## Getting an API key

`pr-trailer` is a hosted service. Self-serve sign-up is coming soon — until
then, email yasel@scalingforge.com to request access.

Once you have a key:

1. Add it as a repository secret named `PR_TRAILER_API_KEY`
   (**Settings → Secrets and variables → Actions → New repository secret**).
2. Add the service URL you were given as a repository variable named
   `PR_TRAILER_API_URL` (same screen, **Variables** tab).

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `api-key` | Yes | — | Authenticates requests to the pr-trailer service. |
| `api-url` | Yes | — | Base URL of the pr-trailer service. |
| `github-token` | No | `${{ github.token }}` | Used to read PR data and post/update the review comment. |
| `exclude-files` | No | `package-lock.json,yarn.lock,pnpm-lock.yaml,Cargo.lock,poetry.lock` | Comma-separated filenames excluded from diff extraction. An empty string excludes nothing. |

## Required permissions

The workflow needs `contents: read` to read the diff and
`pull-requests: write` to post the review comment. `pr-trailer` never
writes to your source code.

## Example output

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
> 🤖 *Posted by [pr-trailer](https://github.com/yasel-scf/pr-trailer)*

The audio link is omitted entirely when text-to-speech is unavailable — the
comment falls back to text-only with no visible error.

## Support

- **Bugs and feature requests:** [open an issue](https://github.com/yasel-scf/pr-trailer/issues)
- **Account, billing, or API keys:** yasel@scalingforge.com
- **Security vulnerabilities:** see [SECURITY.md](./SECURITY.md) — please don't file a public issue

## Licensing

`pr-trailer` is proprietary software, published publicly for transparency
but **not open source**. You may run it in your own workflows to use the
hosted service; redistribution and modification are not permitted. See
[LICENSE](./LICENSE) for the full terms and
[CONTRIBUTING.md](./CONTRIBUTING.md) for how to report bugs.

© 2026 ScalingForge. All rights reserved.
