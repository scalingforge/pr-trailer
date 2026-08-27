# Public launch prep — design

Date: 2026-08-27
Status: revised (v2) — supersedes the open-source framing of v1

## Context

`pr-trailer` (repo: `yasel-scf/pr-trailer`, formerly `pr-trailer-ghaction`)
is a GitHub Action that analyzes a pull request and posts a
risk-prioritized review brief as a PR comment. It is a thin client: the
analysis work happens in `pr-trailer-api`, a separately-operated backend
service the Action calls with a customer-supplied `api-key` and `api-url`.

The business model is a commercial SaaS. The Action is the **front door**:
publicly visible, listed on GitHub Marketplace, free to discover and read
— but **proprietary and privately maintained**, not open source and not
open to outside code contributions. Customers sign up on a dashboard,
receive an API key, and add it to their repo as a secret.

### Current repo state (verified 2026-08-27)

- Repository is **already public** and **already renamed** to
  `yasel-scf/pr-trailer`. The v1 spec's "flip to public" step is moot.
- No `LICENSE` file exists, so the repo currently defaults to
  all-rights-reserved. This happens to align with the proprietary intent,
  but is not explicit enough to ship commercially.
- `package.json` declares `"license": "MIT"` — **wrong** under this model
  and must change.
- `README.md` documents `uses: yasel-scf/pr-trailer-ghaction@v1` — a
  **stale repo name**. GitHub redirects renamed repos, but the canonical
  name belongs in customer-facing docs.
- `README.md` contains a dead placeholder link,
  `https://TODO-replace-with-pr-trailer-signup-url`.
- No git tags exist, yet the README already promises `@v1`.
- `dist/index.js` is committed (correct and required for JS actions).
- `docs/` (Claude Code specs and plans) is tracked. Scanned for secrets —
  none found.
- `pr-trailer-dashboard` is an empty scaffold (one initial commit).

## Competitive research (conducted 2026-08-27)

**CodeRabbit and Greptile are GitHub *Apps*, not GitHub Actions.** Both
onboard through OAuth: sign in with GitHub, authorize the app, select
repositories, done. No API key is issued, and nothing is committed to the
customer's repository. This is a materially different architecture from
the one specified here, and the difference is a conversion-funnel
difference: their flow is ~2 clicks; an Action + API key flow is four
steps (sign up → copy key → add repo secret → commit a workflow file).

**The Action-as-front-door + API-key pattern is nonetheless common and
legitimate.** Its exemplars are Chromatic, Codecov, Snyk, SonarQube, and
Genymotion. Notably, `chromaui/action` and `codecov/codecov-action` are
both **MIT licensed** — the industry norm is to keep the thin Action
wrapper open source precisely because the defensible IP is the backend,
not the client.

**Implication accepted by the repo owner:** because `dist/index.js` is
committed and the repository is already public, the entire Action is
readable by anyone today. A proprietary license therefore buys *legal
restriction, not secrecy*, and introduces some friction with enterprise
license scanners. This trade-off was raised and the proprietary model was
confirmed as the intended choice.

**GitHub Marketplace requirements (verified against GitHub docs):** there
is **no open-source license requirement**. Actions publish immediately
without GitHub review provided: the repository is public; it contains a
single `action.yml`/`action.yaml` at the root; the `name` in that file is
unique across Marketplace and does not collide with an existing user or
org name; and the publishing account has two-factor authentication
enabled. A `branding` block (Feather icon + one of GitHub's allowed
colors) supplies the listing badge.

**Name availability:** a Marketplace search for `pr-trailer` returned zero
results, so the name appears free. This must be re-confirmed at
submission time.

## Decisions (confirmed with the repo owner)

- The Action is **proprietary, source-available, use-only**. Customers may
  read it and run it in their workflows; redistribution, modification,
  derivative works, and reverse engineering are not permitted.
- Copyright holder: **ScalingForge**.
- **No external code contributions.** Issues for bug reports and feature
  requests are welcome; pull requests from outside the company are not.
- A **full GitHub Marketplace listing** is the goal.
- Semantic version tags (`vX.Y.Z` plus a floating `vX`) are set up now.
- `docs/` is untracked from git going forward.
- The customer **signup/dashboard URL is undecided and out of scope**.
  All deliverables must read coherently without one, and its absence is
  the explicit blocker on Marketplace publication.

## Scope

### 1. Untrack `docs/`

Add `docs/` to `.gitignore` and `git rm -r --cached docs/`. Files remain on
disk; nothing is deleted.

Caveat, not actioned: this does not erase `docs/` from git history, and the
repo is *already public*, so that history is already exposed. Nothing
sensitive was found in it (planning documents only), so no remediation is
proposed — but the owner should be aware that history rewriting is no
longer a purely private decision, as the old objects may already be
mirrored or cached.

### 2. Proprietary `LICENSE`

Replace the absent/MIT licensing with an explicit proprietary
source-available license granting: the right to use the Action in the
customer's own CI workflows, solely to interact with the hosted
`pr-trailer` service. Reserving: redistribution, modification, derivative
works, reverse engineering, and any use to build a competing service.
Include a warranty disclaimer and liability limitation.

### 3. `package.json` licensing metadata

Change `"license": "MIT"` to `"license": "UNLICENSED"` (the npm convention
for proprietary packages) and add `"licenseFile": "LICENSE"` semantics via
a `files`-adjacent note if useful. Keep `"private": true` — it prevents
accidental `npm publish` and is unrelated to GitHub repo visibility.

### 4. Rewrite `CONTRIBUTING.md`

The current file is an open-source-style commit-convention guide. Rewrite
it to state plainly that this is a proprietary repository operated by
ScalingForge, that external pull requests are not accepted, and to direct
users to GitHub Issues for bugs and feature requests and to a support
contact for account/API issues. Retain the Conventional Commits section as
internal guidance, clearly marked as applying to ScalingForge maintainers.

### 5. `action.yml` branding

Add a `branding:` block (`icon`, `color`) — required for the Marketplace
badge. Values chosen for a review/PR product; trivially changed later.

### 6. CI: replace auto-commit of `dist/` with a verification check

Current `ci.yml` rebuilds `dist/` and pushes it back to the PR branch under
`contents: write`. Replace with a fail-fast check that rebuilds and fails
the job when the committed `dist/` is stale, and drop the now-unneeded
`contents: write` permission. On a public repo, a workflow holding write
permission is a needlessly broad posture, and the auto-push silently
no-ops for fork PRs regardless.

### 7. Release process

Add `RELEASING.md` documenting the release steps, and a
`workflow_dispatch`-triggered `.github/workflows/release.yml` that tags
`vX.Y.Z`, force-moves the floating `vX` tag, and creates a GitHub Release.
Deliberate and manual, so releases are never a surprise side effect of a
merge. Cut `v1.0.0` / `v1` as the first release.

### 8. `SECURITY.md`

Add a vulnerability-reporting policy directing reporters to GitHub private
vulnerability reporting or a support email, scoped to the Action itself and
explicitly excluding the separately-operated `pr-trailer-api` backend.

### 9. Rewrite `README.md` as a commercial front door

The README is the product's primary marketing surface and the body of the
Marketplace listing. Rewrite to lead with the value proposition, then
quickstart, inputs reference, example output, and support/legal pointers.
Concrete fixes required:

- Correct the stale `yasel-scf/pr-trailer-ghaction` reference to
  `yasel-scf/pr-trailer`.
- Remove the dead `TODO-replace-with-pr-trailer-signup-url` link, replacing
  it with a "sign-up coming soon" note rather than a broken URL.
- State plainly that the Action is proprietary and requires a
  `pr-trailer` account.

### 10. Repository description and topics

Set the currently-empty GitHub repo description and add discovery topics
(e.g. `github-actions`, `code-review`, `pull-request`, `ai`). The
description is shown on the Marketplace listing and in search results.

### 11. Marketplace publication (gated)

Publish via the repo's Releases UI ("Publish this Action to the GitHub
Marketplace"), which requires 2FA on the publishing account and acceptance
of the Marketplace Developer Agreement. **Gated on the signup URL
existing** — listing a product that customers cannot obtain a key for
would be a poor launch. Preparation is in scope; pressing publish is not.

## Explicitly out of scope

- Building the customer signup/billing dashboard and choosing its URL.
- Pressing publish on the Marketplace listing (§11 prepares only).
- Rewriting git history to remove `docs/` (see §1 caveat).
- Migrating to a GitHub App architecture. Worth revisiting later given the
  research above — the OAuth onboarding flow is materially shorter than an
  API-key flow — but it is a different product surface, not a licensing or
  packaging change, and does not belong in this launch.

## Testing / verification

- `npm run lint`, `npm run typecheck`, `npm run test` pass after all edits.
- `npm run build` output matches committed `dist/`, confirming the new CI
  check passes in the current state; and an artificially dirtied `dist/`
  makes it fail, confirming the check actually detects drift.
- `action.yml` parses as YAML and contains the expected `branding` keys.
- `.github/workflows/release.yml` parses as YAML.
- No occurrence of `TODO` or the stale `pr-trailer-ghaction` name remains
  in `README.md`.
- `package.json` no longer declares MIT.
- `docs/` is absent from `git ls-files` but still present on disk.
