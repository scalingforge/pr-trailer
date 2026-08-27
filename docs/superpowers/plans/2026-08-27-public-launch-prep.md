# Public Launch Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the already-public `yasel-scf/pr-trailer` Action for a GitHub Marketplace listing as the proprietary commercial front door to the ScalingForge `pr-trailer` service — correct licensing, contribution posture, branding, CI hardening, release tagging, and customer-facing docs.

**Architecture:** No application code changes. This plan touches only repo metadata, CI workflows, and customer-facing documentation: `.gitignore`, `LICENSE`, `package.json`, `CONTRIBUTING.md`, `action.yml`, `.github/workflows/*.yml`, `SECURITY.md`, `RELEASING.md`, `README.md`, plus GitHub repo settings and release tags.

**Tech Stack:** GitHub Actions (YAML), Node 24.x / npm, `@vercel/ncc` build (`npm run build`), `git`, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-08-27-public-launch-prep-design.md` (v2 — proprietary framing)

## Global Constraints

- **The Action is proprietary, source-available, use-only.** It is NOT open source. Never introduce MIT/Apache/GPL text or open-source contribution language into any file in this repo.
- Copyright holder is exactly **ScalingForge**; copyright year is **2026**.
- Support/security contact email is **yasel@scalingforge.com**.
- The canonical repo slug is **`yasel-scf/pr-trailer`**. The old name `pr-trailer-ghaction` is stale and must not appear in any customer-facing file.
- **No customer signup URL exists yet.** Never write a placeholder, dead, or invented URL into any file. Where a signup link would go, write a "coming soon" sentence instead.
- `package.json`'s `"private": true` stays as-is (prevents accidental `npm publish`; unrelated to GitHub repo visibility).
- Commit messages follow Conventional Commits (`docs:`, `feat:`, `chore:`, `ci:`, `build:`).
- Do not add a `Co-Authored-By: Claude` trailer to any commit in this repo.
- Node engine is `24.x` (`package.json` `engines`).
- Do NOT press publish on the Marketplace listing (Task 11 prepares only).

---

## File Structure

| File | Change |
|---|---|
| `.gitignore` | Modify — add `docs/` |
| `docs/**` | Untrack (`git rm -r --cached`); files stay on disk |
| `LICENSE` | Create — proprietary source-available license |
| `package.json` | Modify — `"license": "UNLICENSED"` |
| `CONTRIBUTING.md` | Rewrite — no external contributions |
| `action.yml` | Modify — add `branding:` block |
| `.github/workflows/ci.yml` | Modify — fail-fast dist check, drop `contents: write` |
| `RELEASING.md` | Create — release steps |
| `.github/workflows/release.yml` | Create — `workflow_dispatch` release automation |
| `SECURITY.md` | Create — vulnerability reporting policy |
| `README.md` | Rewrite — commercial front door, fix stale name, remove dead link |
| repo settings | Modify — description + topics (via `gh`) |
| git tags `v1.0.0`, `v1` | Create — first release |

---

## Task 1: Untrack `docs/` from git

**Files:**
- Modify: `.gitignore`

**Interfaces:** None (no code).

- [ ] **Step 1: Add `docs/` to `.gitignore`**

Edit `.gitignore` so it reads exactly:

```
node_modules/
*.log
.DS_Store
docs/
```

- [ ] **Step 2: Untrack the folder**

Run: `git rm -r --cached docs/`

Expected: output lists every file under `docs/` as `rm 'docs/...'`. This removes them from git's index only — nothing is deleted from disk.

- [ ] **Step 3: Verify files stay on disk but drop from tracking**

Run: `ls docs/architecture docs/superpowers/specs docs/superpowers/plans` — expected: files still listed on disk.

Run: `git status --short | head -5` — expected: staged deletions (`D  docs/...`).

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git add -u docs/
git commit -m "chore: stop tracking docs/ ahead of Marketplace launch"
```

Run: `git ls-files docs/` — expected: empty output.

---

## Task 2: Add proprietary `LICENSE` and fix `package.json`

**Files:**
- Create: `LICENSE`
- Modify: `package.json`

**Interfaces:** None (no code).

- [ ] **Step 1: Write the proprietary license**

Create `LICENSE` with exactly this content:

```
pr-trailer License Agreement

Copyright (c) 2026 ScalingForge. All rights reserved.

This software (the "Action") is proprietary and confidential to
ScalingForge. It is made publicly readable for transparency and for use
with the hosted pr-trailer service. It is not open source software.

1. GRANT OF LICENSE

Subject to the terms below, ScalingForge grants you a limited,
non-exclusive, non-transferable, revocable license to download and execute
the Action within your own continuous integration workflows, solely for
the purpose of interacting with the hosted pr-trailer service operated by
ScalingForge.

2. RESTRICTIONS

You may not:

  (a) redistribute, sublicense, sell, rent, lease, or otherwise transfer
      the Action or any portion of it;
  (b) modify the Action or create derivative works based on it;
  (c) reverse engineer, decompile, or disassemble the Action, except to
      the extent such restriction is prohibited by applicable law;
  (d) remove, obscure, or alter any copyright, trademark, or other
      proprietary notice contained in the Action;
  (e) use the Action, or any information derived from it, to develop,
      market, or operate a product or service that competes with
      pr-trailer or the services of ScalingForge.

3. RESERVATION OF RIGHTS

All rights not expressly granted in Section 1 are reserved by
ScalingForge. No rights are granted by implication, estoppel, or
otherwise.

4. SERVICE TERMS

Use of the hosted pr-trailer service that the Action communicates with is
governed separately by the pr-trailer terms of service. This license
covers only the Action itself.

5. TERMINATION

This license terminates automatically if you breach any of its terms. Upon
termination you must cease all use of the Action.

6. DISCLAIMER OF WARRANTY

THE ACTION IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT.

7. LIMITATION OF LIABILITY

IN NO EVENT SHALL SCALINGFORGE BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING
FROM, OUT OF, OR IN CONNECTION WITH THE ACTION OR THE USE OR OTHER
DEALINGS IN THE ACTION.

For licensing enquiries, contact yasel@scalingforge.com.
```

- [ ] **Step 2: Update `package.json`'s license field**

In `package.json`, change the line:

```json
  "license": "MIT",
```

to:

```json
  "license": "UNLICENSED",
```

Leave every other field, including `"private": true`, unchanged.

- [ ] **Step 3: Verify**

Run:

```bash
node -e "
const p = require('./package.json');
if (p.license !== 'UNLICENSED') throw new Error('license is ' + p.license);
if (p.private !== true) throw new Error('private flag changed');
console.log('package.json OK:', p.license, 'private:', p.private);
"
grep -c "MIT" LICENSE package.json
```

Expected: `package.json OK: UNLICENSED private: true`, and the `grep -c` reports `0` for both files (no MIT text anywhere).

- [ ] **Step 4: Commit**

```bash
git add LICENSE package.json
git commit -m "docs: add proprietary license, drop MIT declaration"
```

---

## Task 3: Rewrite `CONTRIBUTING.md` for a proprietary repo

**Files:**
- Modify: `CONTRIBUTING.md` (full rewrite)

**Interfaces:** None (no code).

- [ ] **Step 1: Replace the file contents**

Overwrite `CONTRIBUTING.md` with exactly:

```markdown
# Contributing

`pr-trailer` is a proprietary product operated by ScalingForge. The source
is published for transparency, but this is **not an open source project**
and we do not accept external pull requests.

## Found a bug? Want a feature?

Please [open an issue](https://github.com/yasel-scf/pr-trailer/issues). Bug
reports and feature requests are genuinely welcome and are the most useful
way to contribute.

When reporting a bug, include:

- the version of the Action you're using (e.g. `v1`)
- the relevant workflow run log, with any secrets redacted
- what you expected to happen, and what happened instead

## Account, billing, or API key issues

Email yasel@scalingforge.com — please don't open a public issue for
anything account-specific.

## Security vulnerabilities

Do not open a public issue. See [SECURITY.md](./SECURITY.md) for the
private reporting process.

## Pull requests

We don't accept pull requests from outside ScalingForge. Any PR opened
against this repository will be closed with a pointer to this document. If
you've found a bug, an issue describing it is more valuable to us than a
patch, since we can't merge external code.

---

## For ScalingForge maintainers

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

Format: `type(scope): description`

| Type | Use for |
|---|---|
| `feat` | New functionality (a new source file, a new input, new behavior) |
| `fix` | Bug fixes |
| `chore` | Tooling/config/dependency setup with no behavior change |
| `build` | Build system or bundling changes (e.g. ncc, tsconfig) |
| `ci` | CI/CD workflow changes (`.github/workflows/**`) |
| `docs` | Documentation only (README, this file) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |

Scope is optional and should name the affected area (e.g. `feat(github): ...`).

Keep commits small and scoped to one logical change — prefer several small
commits over one large one.

Releases are cut manually — see [RELEASING.md](./RELEASING.md).
```

- [ ] **Step 2: Verify no open-source contribution language remains**

Run:

```bash
grep -ciE "pull request" CONTRIBUTING.md
grep -q "not an open source project" CONTRIBUTING.md && echo "proprietary framing OK"
grep -q "pr-trailer-ghaction" CONTRIBUTING.md && echo "STALE NAME FOUND" || echo "no stale name"
```

Expected: the "proprietary framing OK" and "no stale name" lines print. (The `pull request` count is non-zero by design — the file explicitly declines them.)

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: rewrite CONTRIBUTING for proprietary repo"
```

---

## Task 4: Add `branding` block to `action.yml`

**Files:**
- Modify: `action.yml`

**Interfaces:** None (no code) — `action.yml` is metadata read by GitHub Actions and Marketplace.

- [ ] **Step 1: Add the branding block**

Edit `action.yml` to insert a top-level `branding:` key between `description:` and `inputs:`, leaving everything else untouched:

```yaml
name: 'pr-trailer'
description: 'Analyzes a pull request and posts a risk-prioritized review brief as a comment.'
branding:
  icon: 'git-pull-request'
  color: 'purple'
inputs:
```

(`git-pull-request` is a valid Feather icon; `purple` is one of GitHub's allowed badge colors: white, black, yellow, blue, green, orange, red, purple, gray-dark.)

- [ ] **Step 2: Verify the YAML parses and has the expected keys**

Run:

```bash
python3 -c "
import yaml
data = yaml.safe_load(open('action.yml'))
assert data['branding'] == {'icon': 'git-pull-request', 'color': 'purple'}, data.get('branding')
assert data['name'] == 'pr-trailer'
assert set(data['inputs']) == {'api-key', 'api-url', 'github-token', 'exclude-files'}, set(data['inputs'])
assert data['runs']['main'] == 'dist/index.js'
print('action.yml OK:', data['branding'])
"
```

Expected: `action.yml OK: {'icon': 'git-pull-request', 'color': 'purple'}`.

- [ ] **Step 3: Commit**

```bash
git add action.yml
git commit -m "feat: add branding block for Marketplace listing"
```

---

## Task 5: Replace CI's auto-commit-dist step with a fail-fast check

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:** None (no code) — CI workflow only.

- [ ] **Step 1: Install dependencies so `npm run build` can run locally**

Run: `npm ci`

Expected: completes without error (installs into gitignored `node_modules/`).

- [ ] **Step 2: Remove the job's write permission**

In `.github/workflows/ci.yml`, delete these three lines:

```yaml
permissions:
  contents: write

```

so that `on:` is followed directly by `jobs:`.

- [ ] **Step 3: Replace the final step**

Replace this step:

```yaml
      - name: Commit rebuilt dist/ if it changed
        run: |
          if ! git diff --quiet -- dist/; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add dist/
            git commit -m "build: rebuild dist/index.js [skip ci]"
            git push origin HEAD:${{ github.head_ref || github.ref_name }}
          fi
```

with:

```yaml
      - name: Verify dist/ is up to date
        run: |
          if ! git diff --quiet -- dist/; then
            echo "::error::dist/ is out of date. Run 'npm run build' locally and commit the result."
            git diff --stat -- dist/
            exit 1
          fi
```

- [ ] **Step 4: Verify the check passes in the current, in-sync state**

Run: `npm run build && git diff --exit-code -- dist/ && echo "dist in sync"`

Expected: `dist in sync` printed, exit code 0.

- [ ] **Step 5: Verify the check actually catches drift**

Run:

```bash
echo "// tmp-drift-check" >> dist/index.js
git diff --quiet -- dist/ ; echo "drift detected exit code: $?"
git checkout -- dist/index.js
git diff --exit-code -- dist/ && echo "restored cleanly"
```

Expected: `drift detected exit code: 1`, then `restored cleanly`.

- [ ] **Step 6: Verify the workflow still parses and no longer requests write access**

Run:

```bash
python3 -c "
import yaml
data = yaml.safe_load(open('.github/workflows/ci.yml'))
assert 'permissions' not in data, 'top-level permissions should be gone'
steps = data['jobs']['build-and-check']['steps']
names = [s.get('name') for s in steps]
assert 'Verify dist/ is up to date' in names, names
assert not any('Commit rebuilt' in (n or '') for n in names), names
print('ci.yml OK:', names)
"
```

Expected: prints the step list ending with `Verify dist/ is up to date`, with no `Commit rebuilt dist/ if it changed` step and no top-level `permissions`.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: fail instead of auto-pushing when dist/ is stale"
```

---

## Task 6: Add `RELEASING.md` and the release workflow

**Files:**
- Create: `RELEASING.md`
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Produces: a `workflow_dispatch` workflow with one required input, `version`, formatted `X.Y.Z` with no leading `v`. Invoked from the Actions UI or via `gh workflow run release.yml -f version=X.Y.Z`.

- [ ] **Step 1: Write `RELEASING.md`**

Create `RELEASING.md`:

```markdown
# Releasing

`pr-trailer` is versioned with semantic version tags (`vX.Y.Z`) plus a
floating major-version tag (`vX`) that always points at the latest release
in that major line. This is the standard pattern for GitHub Actions:
customers pin `uses: yasel-scf/pr-trailer@v1` and receive non-breaking
updates automatically.

## Cutting a release

1. Bump the `version` field in `package.json` to the new `X.Y.Z`.
2. Commit: `git commit -am "chore: bump version to X.Y.Z"`.
3. Merge to `main` through a reviewed PR, as with any other change.
4. From the Actions tab, run the **Release** workflow via "Run workflow",
   entering the new version (e.g. `1.2.0` — no leading `v`).
5. The workflow tags `vX.Y.Z`, force-moves the floating `vX` tag to the
   same commit, pushes both, and creates a GitHub Release.

## Before releasing

- CI must be green on `main` — in particular the `Verify dist/ is up to
  date` step, since customers execute `dist/index.js` directly.
- If `dist/` drifted, run `npm run build` and commit the result before
  tagging. A release whose `dist/` is stale ships the wrong code.

## First release

The first release is `v1.0.0` (floating tag `v1`), matching the `uses:`
line documented in the README.

## Marketplace

Once a release exists, it can be published to the GitHub Marketplace from
the release page ("Publish this Action to the GitHub Marketplace").
Publishing requires two-factor authentication on the publishing account
and acceptance of the GitHub Marketplace Developer Agreement.
```

- [ ] **Step 2: Write `.github/workflows/release.yml`**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release, without leading v (e.g. 1.2.0)'
        required: true

jobs:
  tag-and-release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Validate version format
        env:
          VERSION: ${{ inputs.version }}
        run: |
          if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "::error::version must be X.Y.Z with no leading v, got '$VERSION'"
            exit 1
          fi

      - name: Configure git identity
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Create version tag
        env:
          VERSION: ${{ inputs.version }}
        run: |
          git tag -a "v$VERSION" -m "Release v$VERSION"
          git push origin "v$VERSION"

      - name: Move floating major tag
        env:
          VERSION: ${{ inputs.version }}
        run: |
          MAJOR="v${VERSION%%.*}"
          git tag -fa "$MAJOR" -m "Update $MAJOR to v$VERSION"
          git push origin "$MAJOR" --force

      - name: Create GitHub Release
        env:
          VERSION: ${{ inputs.version }}
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release create "v$VERSION" \
            --title "v$VERSION" \
            --generate-notes
```

Note: the version input is passed through `env:` rather than interpolated directly into the shell script. Interpolating `${{ inputs.version }}` inline would allow a maliciously-crafted input to inject shell commands; reading it as `"$VERSION"` does not.

- [ ] **Step 3: Verify both files**

Run:

```bash
python3 -c "
import yaml
data = yaml.safe_load(open('.github/workflows/release.yml'))
job = data['jobs']['tag-and-release']
assert job['permissions']['contents'] == 'write'
names = [s.get('name') for s in job['steps']]
assert 'Validate version format' in names, names
print('release.yml OK:', names)
"
grep -q "First release" RELEASING.md && echo "RELEASING.md OK"
```

Expected: the step list prints, followed by `RELEASING.md OK`.

- [ ] **Step 4: Verify no inline interpolation into shell bodies**

Every `${{ inputs.version }}` must appear in an `env:` assignment, never inside a `run:` script body. Write the check to a temp file (a quoted heredoc, so no shell escaping is applied to the Python) and run it:

```bash
cat > /tmp/check-release-yml.py <<'PYEOF'
import yaml, re, sys

raw = open('.github/workflows/release.yml').read()
total = len(re.findall(r'\$\{\{\s*inputs\.version\s*\}\}', raw))
data = yaml.safe_load(raw)
steps = data['jobs']['tag-and-release']['steps']
in_env = sum(
    1
    for s in steps
    for v in (s.get('env') or {}).values()
    if re.search(r'\$\{\{\s*inputs\.version\s*\}\}', str(v))
)
in_run = sum(1 for s in steps if re.search(r'\$\{\{', s.get('run', '')))
print(f'total={total} in_env={in_env} in_run={in_run}')
assert total == in_env, 'some inputs.version interpolations are outside env:'
assert in_run == 0, 'a run: body interpolates ${{ }} directly - shell injection risk'
print('no shell injection risk')
PYEOF
python3 /tmp/check-release-yml.py
```

Expected: `total=4 in_env=4 in_run=0` followed by `no shell injection risk`.

(This exact check, the `v${VERSION%%.*}` major-tag expansion, and the version regex were all verified working while writing this plan: the regex accepts `1.0.0` and rejects `v1.0.0`, `1.0`, and `1.0.0; echo pwned`.)

- [ ] **Step 5: Commit**

```bash
git add RELEASING.md .github/workflows/release.yml
git commit -m "ci: add release workflow and RELEASING.md"
```

---

## Task 7: Add `SECURITY.md`

**Files:**
- Create: `SECURITY.md`

**Interfaces:** None (no code).

- [ ] **Step 1: Write `SECURITY.md`**

Create `SECURITY.md`:

```markdown
# Security Policy

## Reporting a vulnerability

If you find a security vulnerability in the `pr-trailer` Action, please do
**not** open a public GitHub issue.

Report it privately through GitHub's
[private vulnerability reporting](https://github.com/yasel-scf/pr-trailer/security/advisories/new)
for this repository, or email yasel@scalingforge.com.

Please include enough detail to reproduce the issue — the affected version,
the conditions required, and the impact you observed.

We aim to acknowledge reports within 5 business days and will keep you
updated as we investigate.

## Scope

This policy covers the `pr-trailer` GitHub Action published from this
repository.

It does **not** cover the `pr-trailer` backend service (`pr-trailer-api`),
which is operated separately. For vulnerabilities in the hosted service,
email yasel@scalingforge.com directly.

## Handling your credentials

The Action requires a `pr-trailer` API key, supplied as a GitHub Actions
secret. Never commit an API key to your repository or paste one into an
issue. If you believe a key has been exposed, email yasel@scalingforge.com
and we will rotate it.

## Supported versions

Only the latest major version (currently `v1`) receives security fixes.
```

- [ ] **Step 2: Verify**

Run:

```bash
grep -q "Reporting a vulnerability" SECURITY.md && grep -q "yasel@scalingforge.com" SECURITY.md && echo "SECURITY.md OK"
grep -c "pr-trailer-ghaction" SECURITY.md
```

Expected: `SECURITY.md OK`, then `0` (no stale repo name).

- [ ] **Step 3: Commit**

```bash
git add SECURITY.md
git commit -m "docs: add SECURITY.md"
```

---

## Task 8: Rewrite `README.md` as the commercial front door

**Files:**
- Modify: `README.md` (full rewrite)

**Interfaces:** None (no code). This file is the body of the Marketplace listing.

- [ ] **Step 1: Overwrite `README.md`**

Replace the entire file with:

````markdown
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
````

- [ ] **Step 2: Verify no dead links, stale names, or placeholders remain**

Run:

```bash
grep -ci "TODO" README.md
grep -ci "pr-trailer-ghaction" README.md
grep -c "yasel-scf/pr-trailer@v1" README.md
grep -qi "not open source" README.md && echo "licensing framing OK"
```

Expected: `0` (no TODO), `0` (no stale name), `1` (correct `uses:` line present), then `licensing framing OK`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README as commercial front door"
```

---

## Task 9: Full verification pass

**Files:** None — verification only.

**Interfaces:** None.

- [ ] **Step 1: Run the full check suite**

Run:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Expected: all four succeed. (No source files were modified by this plan, so any failure here indicates a pre-existing problem — investigate before continuing.)

- [ ] **Step 2: Confirm `dist/` is still in sync after the build**

Run: `git diff --exit-code -- dist/ && echo "dist in sync"`

Expected: `dist in sync`.

- [ ] **Step 3: Repo-wide sweep for stale names and placeholders in tracked files**

Run:

```bash
git ls-files | xargs grep -lI "pr-trailer-ghaction" 2>/dev/null || echo "no stale repo name in tracked files"
git ls-files -- '*.md' | xargs grep -lI "TODO-replace" 2>/dev/null || echo "no placeholder URLs"
git ls-files | xargs grep -lI "MIT License" 2>/dev/null || echo "no MIT license text"
```

Expected: all three fallback messages print.

- [ ] **Step 4: Confirm the expected files exist and `docs/` is untracked**

Run:

```bash
ls LICENSE SECURITY.md RELEASING.md CONTRIBUTING.md README.md action.yml
git ls-files docs/ | wc -l
```

Expected: all six files listed, and `0` tracked files under `docs/`.

- [ ] **Step 5: Commit any incidental changes**

If `git status --short` shows anything unexpected, investigate rather than committing blindly. If it is clean, no commit is needed.

---

## Task 10: Set repo description and topics

This task changes settings on the live public GitHub repository. It is
reversible and low-risk, but it is outward-facing — **confirm with the user
before running Step 1.**

**Files:** None — GitHub repo settings via `gh`.

**Interfaces:** None.

- [ ] **Step 1: Set the description and topics**

```bash
gh repo edit yasel-scf/pr-trailer \
  --description "AI PR review briefs — risk-ranked files, suggested reading order, posted as a single PR comment." \
  --add-topic github-actions \
  --add-topic code-review \
  --add-topic pull-request \
  --add-topic ai \
  --add-topic developer-tools
```

- [ ] **Step 2: Verify**

Run: `gh repo view yasel-scf/pr-trailer --json description,repositoryTopics`

Expected: the description is set and all five topics are present.

---

## Task 11: Cut the `v1.0.0` / `v1` release

This task pushes real tags to the public `origin` and creates a
public-facing GitHub Release. It is outward-facing and awkward to undo —
**pause and get explicit user confirmation before Step 2.**

**Files:** None — creates git tags and a GitHub Release.

**Interfaces:** None.

- [ ] **Step 1: Confirm prerequisites**

Run: `git status --short` (expected: clean) and `git log --oneline -12` (expected: Tasks 1–8's commits present).

Releases are cut from `main`. If this plan was executed on a feature branch, that branch must be merged to `main` before this task runs. Confirm CI is green on `main` — the `Verify dist/ is up to date` step in particular, since customers execute `dist/index.js` directly.

- [ ] **Step 2: Get explicit user confirmation, then trigger the release**

Once the user confirms, run:

```bash
gh workflow run release.yml -f version=1.0.0
```

Or from the GitHub UI: Actions tab → "Release" → "Run workflow" → enter `1.0.0` → Run.

- [ ] **Step 3: Verify the release**

Run:

```bash
gh run list --workflow=release.yml --limit 1
git fetch --tags && git tag -l 'v1*'
gh release view v1.0.0
```

Expected: the workflow run succeeded; both `v1.0.0` and `v1` tags exist; the release shows with generated notes.

(No commit — this task creates tags and a release, not file changes.)

---

## Task 12: Prepare the Marketplace listing (do NOT publish)

**Blocked on:** a live customer signup URL, which is explicitly out of
scope for this plan. Listing a product customers cannot obtain a key for
would be a poor launch. This task therefore ends with a readiness report,
**not** a published listing.

**Files:** None.

**Interfaces:** None.

- [ ] **Step 1: Verify every Marketplace prerequisite is met**

Confirm and report each item:

```bash
gh repo view yasel-scf/pr-trailer --json visibility,description
ls action.yml && ls action.yaml 2>/dev/null || echo "single metadata file at root: OK"
python3 -c "
import yaml
d = yaml.safe_load(open('action.yml'))
print('name:', d['name'])
print('branding:', d['branding'])
"
gh release view v1.0.0 --json tagName,isDraft 2>&1 | head -3
```

Checklist to report:
- Repository is public — expected `PUBLIC`.
- Exactly one `action.yml` at the repo root, no `action.yaml`.
- `name: pr-trailer` is unique on Marketplace (re-check at
  https://github.com/marketplace?type=actions&query=pr-trailer — it was
  free as of 2026-08-27) and does not collide with an existing GitHub user
  or organization.
- `branding` block present with a valid Feather icon and allowed color.
- Repo description set.
- A published (non-draft) release exists.
- Two-factor authentication is enabled on the publishing account —
  **the user must confirm this manually**; it cannot be checked from here.

- [ ] **Step 2: Report readiness and stop**

Report to the user: which prerequisites pass, that 2FA needs manual
confirmation, and that publishing is deliberately deferred until a customer
signup URL exists. Do **not** press publish.

When the signup URL does exist, the remaining work is: update the "Getting
an API key" section of `README.md` with the real link, cut a `v1.0.1`
release, then publish from the release page via "Publish this Action to the
GitHub Marketplace" and accept the Marketplace Developer Agreement.

---

## Self-Review Notes

- **Spec coverage:** §1 untrack docs → Task 1. §2 LICENSE → Task 2. §3 package.json → Task 2. §4 CONTRIBUTING → Task 3. §5 branding → Task 4. §6 CI → Task 5. §7 release process → Task 6 (mechanism) + Task 11 (first cut). §8 SECURITY.md → Task 7. §9 README → Task 8. §10 description/topics → Task 10. §11 Marketplace (gated) → Task 12. Task 9 is a cross-cutting verification pass. Out-of-scope items (signup dashboard, pressing publish, history rewrite, GitHub App migration) correctly have no tasks.
- **Placeholder scan:** no TBD/TODO/"handle appropriately" language. Every step carries literal file content or literal runnable commands. No invented URLs — the signup link is deliberately absent per the global constraints, and `cdn.example.com` appears only inside an illustrative example-output block.
- **Consistency:** copyright reads "ScalingForge" and year 2026 in LICENSE, README, and the spec. Contact is `yasel@scalingforge.com` in CONTRIBUTING, SECURITY, and README. The repo slug is `yasel-scf/pr-trailer` everywhere; Task 9 Step 3 sweeps for the stale `pr-trailer-ghaction` name repo-wide. `release.yml`'s `version` input format (`X.Y.Z`, no `v`) matches RELEASING.md and Task 11's `-f version=1.0.0`. Branding values `git-pull-request`/`purple` match between Task 4's edit and its verification assertion.
- **Ordering note:** Task 5 (CI fail-fast on stale `dist/`) lands before Task 11 (release), so the release is gated on a `dist/` that provably matches source.
