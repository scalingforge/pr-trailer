# Public launch prep — design

Date: 2026-08-27

## Context

`pr-trailer-ghaction` is currently a private GitHub repo. The goal is to
prepare it for a future public launch with a full GitHub Marketplace
listing. The actual visibility flip to public, and the Marketplace
submission itself, are gated on a separate, out-of-scope project: a real
signup flow for the `pr-trailer-api` hosted SaaS backend (the README
currently has a `TODO-replace-with-pr-trailer-signup-url` placeholder for
this).

This spec covers the repo-hygiene and release-mechanics work that can and
should happen now, ahead of that flip.

## Decisions (confirmed with the repo owner)

- `docs/superpowers/` and `docs/architecture/` are both untracked from git
  going forward — the public repo should carry only user-facing docs
  (README, CONTRIBUTING, LICENSE, SECURITY, RELEASING).
- `pr-trailer-api` access will be a public hosted SaaS (not self-hosted) —
  external users get their own `api-key`/`api-url` against a service the
  repo owner operates.
- A full GitHub Marketplace listing is wanted (not just a bare public
  repo).
- Release tagging should be set up now, since the README already promises
  `@v1` and no tags exist yet.

## Scope

### 1. Untrack `docs/`

- Add `docs/` to `.gitignore`.
- `git rm -r --cached docs/` to stop tracking it. Files remain on disk —
  nothing is deleted locally.
- **Caveat, not actioned here:** this does not erase `docs/` from git
  history. Nothing sensitive was found in it (specs/plans only, no
  secrets or keys), so leaving history as-is is safe. But because history
  becomes fully visible the moment the repo goes public, the repo owner
  should explicitly decide — right before that flip, not now — whether to
  squash history into a clean "initial public release" commit or leave it
  as-is.

### 2. `LICENSE`

- Add a standard MIT license file, matching `"license": "MIT"` already
  declared in `package.json`. Required for a Marketplace listing.

### 3. `action.yml` branding

- Add a `branding:` block (`icon`, `color`) — required by GitHub
  Marketplace for any listed action. Use a reasonable default (e.g. an
  icon evoking review/PRs, a blue color) that's trivially changed later.
- Note (not actioned, informational only): Marketplace name uniqueness
  for `pr-trailer` can only be confirmed at actual submission time via
  GitHub's listing flow — flagged for the repo owner to check then.

### 4. CI: replace auto-commit of `dist/` with a verification check

- Current `ci.yml` rebuilds `dist/` and, if it changed, commits and
  pushes it back to the PR branch using `contents: write` permission.
- Problem: for a public repo accepting outside contributions, GitHub
  issues fork-PR workflow runs a read-only `GITHUB_TOKEN` regardless of
  requested permissions, so this push silently no-ops for external
  contributors — while also being a permissions pattern worth avoiding on
  a public repo.
- Replace with: rebuild `dist/`, then fail the job (`git diff --exit-code
  -- dist/` or equivalent) if the rebuilt output doesn't match what's
  committed, with a clear failure message telling the contributor to run
  `npm run build` and include the result in their PR. This is the
  standard pattern used by published JS actions.

### 5. Release process

- Add `RELEASING.md` documenting the manual release steps: bump
  `package.json` version → run the release workflow (or run steps
  manually) → tag `vX.Y.Z` → force-move the floating major tag (`vX`) to
  point at it → push tags → `gh release create`.
- Add a `workflow_dispatch`-triggered `.github/workflows/release.yml`
  that automates the tag creation and major-tag move, so cutting a
  release is a deliberate, one-click action rather than automatic on
  every merge to `main` (avoids surprise releases).
- Cut the first real release as part of this work: `v1.0.0` tag +
  floating `v1` tag, matching what the README already documents.

### 6. `SECURITY.md`

- Add a minimal vulnerability-reporting policy. Expected/standard for a
  public action that accepts an API key as an input, and for Marketplace
  trust signals generally.

### 7. README cleanup

- Remove the dead `TODO-replace-with-pr-trailer-signup-url` link. Replace
  with a "sign-up coming soon" note rather than a broken URL, since
  building the actual signup/billing flow for `pr-trailer-api` is a
  separate, out-of-scope project.

## Explicitly out of scope

Sequenced after this work, each blocked on external readiness:

- Flipping the repo's GitHub visibility to public (blocked on the real
  `pr-trailer-api` signup URL existing).
- Submitting the action to GitHub Marketplace (requires the repo to
  already be public and a release to exist).
- Building the actual signup/billing flow for `pr-trailer-api`.
- The git-history squash decision from §1 (revisit immediately before the
  public flip).

## Testing / verification

- `npm run build` output matches committed `dist/` (verifies the new CI
  check logic locally before relying on it in CI).
- `npm run lint`, `npm run typecheck`, `npm run test` still pass after
  `action.yml` and workflow edits.
- Render `LICENSE`, `SECURITY.md`, `RELEASING.md` and proofread for
  placeholder text.
- Confirm `.gitignore` change plus `git rm -r --cached docs/` leaves
  `docs/` present on disk but absent from `git status`/`git ls-files`.
