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
