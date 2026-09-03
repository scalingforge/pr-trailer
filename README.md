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
  pull-requests: write

jobs:
  run-pr-trailer:
    runs-on: ubuntu-latest
    steps:
      - name: Run pr-trailer
        uses: scalingforge/pr-trailer@v1
        with:
          api-key: ${{ secrets.PR_TRAILER_API_KEY }}
          api-url: ${{ vars.PR_TRAILER_API_URL }}
          github-token: ${{ github.token }}
```

No other changes to your codebase are needed.

## Getting an API key

`pr-trailer` is a hosted service. Self-serve sign-up is coming soon — until
then, email support@scalingforge.com to request access.

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
| `verbosity` | No | `info` | Logs verbosity: `error`, `warn`, `notice`, `info`, `debug` |

## Required permissions

`pr-trailer` asks for exactly one permission: `pull-requests: write`. That
single scope covers everything it does with your `github-token` — nothing
more is requested, and no other `permissions` entry (`contents`, `issues`,
`checks`, etc.) is needed.

**What it reads**, via the GitHub API: the PR's title, body, commit
messages, and changed files (diff). None of this comes from checking out
your repository — `pr-trailer` never clones it, so it has no filesystem
access to your source code.

**What it writes**: exactly one PR comment — the review brief — created
once and updated in place on every subsequent push. It never creates a
second comment.

**What it never does**: modify, create, or delete any file, branch, or
commit; approve, merge, or close a pull request; or read/write anything
outside the pull request it's running on. It cannot do any of this because
`pull-requests: write` doesn't grant that access — not because of an
internal check.

## Example output

> **Risk Score:** 🔴 High
>
> **PR trailer Audio:** 🔊 [Listen PR trailer](https://cdn.example.com/audio.mp3) (open a new tab, ~42s)
>
> **Intent Brief:** Add a login feature
>
> <details>
> <summary>Intent Description</summary>
>
> Adds a login feature with token-based session handling and a new /login route.
> </details>
>
> ---
> 🤖 *Posted by [pr-trailer](https://github.com/scalingforge/pr-trailer)*

The comment is always exactly these four sections, in this order, each
separated by a blank line. When text-to-speech is unavailable, the audio
section reads `🔇 Not generated for this run` — it is never omitted and no
error is surfaced. GitHub strips `target="_blank"` from PR comments, so the
link opens in the same tab by default — the "(open a new tab)" text is a
hint for readers who want to middle-click/cmd-click it instead.

Intent Description is collapsed by default: the first three sections
(Risk Score, Audio, Intent Brief) are what a reviewer sees at a glance —
the fuller description is one click away, not forced into the initial
read.

## Support

- **Bugs and feature requests:** [open an issue](https://github.com/scalingforge/pr-trailer/issues)
- **Account, billing, or API keys:** support@scalingforge.com
- **Security vulnerabilities:** see [SECURITY.md](./SECURITY.md) — please don't file a public issue

## Licensing

`pr-trailer` is proprietary software, published publicly for transparency
but **not open source**. You may run it in your own workflows to use the
hosted service; redistribution and modification are not permitted. See
[LICENSE](./LICENSE) for the full terms and
[CONTRIBUTING.md](./CONTRIBUTING.md) for how to report bugs.

© 2026 ScalingForge. All rights reserved.
