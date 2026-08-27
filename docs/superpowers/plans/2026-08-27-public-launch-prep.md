# Public Launch Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare `pr-trailer-ghaction` for a future public GitHub Marketplace launch — repo hygiene, licensing, branding, CI hardening, and release tagging — without flipping visibility to public or submitting to Marketplace yet.

**Architecture:** No application code changes. This plan only touches repo metadata and CI: `.gitignore`/tracked files, `action.yml`, `.github/workflows/*.yml`, and new top-level docs (`LICENSE`, `SECURITY.md`, `RELEASING.md`, `README.md` edit).

**Tech Stack:** GitHub Actions (YAML), Node 24.x / npm, `@vercel/ncc` build (`npm run build`), `git`.

**Spec:** `docs/superpowers/specs/2026-08-27-public-launch-prep-design.md`

## Global Constraints

- License is MIT (already declared in `package.json`'s `"license": "MIT"` field) — the `LICENSE` file must match.
- `package.json`'s `"private": true` stays as-is (prevents accidental `npm publish`; unrelated to the GitHub repo's public/private visibility).
- Commit messages follow Conventional Commits per `CONTRIBUTING.md` (`docs:`, `feat:`, `chore:`, `ci:`, `build:`).
- Do not add a `Co-Authored-By: Claude` trailer to any commit in this repo.
- Do not flip the GitHub repo's visibility to public, and do not submit to GitHub Marketplace — both are explicitly out of scope per the spec.
- Node engine is `24.x` (see `package.json` `engines`) — any local verification commands assume this Node version.
- Copyright holder for `LICENSE`: "Yasel Febles", year 2026.

---

## File Structure

| File | Change |
|---|---|
| `.gitignore` | Modify — add `docs/` |
| `docs/**` | Untrack from git (`git rm -r --cached`); files stay on disk |
| `LICENSE` | Create — MIT license text |
| `action.yml` | Modify — add `branding:` block |
| `.github/workflows/ci.yml` | Modify — replace auto-commit-dist step with a fail-fast verify step |
| `RELEASING.md` | Create — manual release steps |
| `.github/workflows/release.yml` | Create — `workflow_dispatch` release automation |
| `SECURITY.md` | Create — vulnerability reporting policy |
| `README.md` | Modify — remove dead TODO signup URL |
| git tags `v1.0.0`, `v1` | Create — first release, pushed to `origin` |

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

Run: `git status --short | head -5` — expected: lines like `D  docs/architecture/...` (staged deletions from the index).

Run: `ls docs/architecture docs/superpowers/specs docs/superpowers/plans` — expected: the files are still listed (still present on disk).

Run: `git ls-files docs/` — expected: empty output (nothing under `docs/` remains tracked once committed).

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git add -u docs/
git commit -m "chore: stop tracking docs/ ahead of public launch"
```

---

## Task 2: Add `LICENSE`

**Files:**
- Create: `LICENSE`

**Interfaces:** None (no code).

- [ ] **Step 1: Write the license file**

Create `LICENSE` with exactly this content:

```
MIT License

Copyright (c) 2026 Yasel Febles

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Verify it matches `package.json`'s declared license**

Run: `grep -c '"license": "MIT"' package.json` — expected: `1`.

Run: `head -1 LICENSE` — expected: `MIT License`.

- [ ] **Step 3: Commit**

```bash
git add LICENSE
git commit -m "docs: add MIT LICENSE file"
```

---

## Task 3: Add `branding` block to `action.yml`

**Files:**
- Modify: `action.yml`

**Interfaces:** None (no code) — `action.yml` is metadata read by GitHub Actions/Marketplace.

- [ ] **Step 1: Add the branding block**

Edit `action.yml` to add a top-level `branding:` key (order among top-level keys doesn't matter to GitHub, but keep it near the top for readability, right after `description`):

```yaml
name: 'pr-trailer'
description: 'Analyzes a pull request and posts a risk-prioritized review brief as a comment.'
branding:
  icon: 'git-pull-request'
  color: 'blue'
inputs:
```

(Everything from `inputs:` onward is unchanged — this only inserts the `branding:` block between `description:` and `inputs:`.)

- [ ] **Step 2: Verify the YAML is well-formed and has the expected keys**

Run:

```bash
python3 -c "
import yaml
with open('action.yml') as f:
    data = yaml.safe_load(f)
assert data['branding'] == {'icon': 'git-pull-request', 'color': 'blue'}, data.get('branding')
assert data['name'] == 'pr-trailer'
assert 'inputs' in data
print('OK:', data['branding'])
"
```

Expected: `OK: {'icon': 'git-pull-request', 'color': 'blue'}`.

- [ ] **Step 3: Commit**

```bash
git add action.yml
git commit -m "feat: add branding block for Marketplace listing"
```

---

## Task 4: Replace CI's auto-commit-dist step with a fail-fast check

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:** None (no code) — CI workflow only.

- [ ] **Step 1: Install dependencies (needed to exercise `npm run build` locally in later steps)**

Run: `npm ci`

Expected: completes without error (installs into `node_modules/`, which is gitignored).

- [ ] **Step 2: Replace the last step of `ci.yml`**

In `.github/workflows/ci.yml`, replace this step:

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
            echo "::error::dist/ is out of date. Run 'npm run build' locally and commit the result as part of this PR."
            git diff --stat -- dist/
            exit 1
          fi
```

Also remove the now-unused `permissions: contents: write` block at the top of the job (the verify-only step needs no write access) — change:

```yaml
permissions:
  contents: write

jobs:
```

to:

```yaml
jobs:
```

- [ ] **Step 3: Verify the check passes in the current (in-sync) state**

Run: `npm run build && git diff --exit-code -- dist/`

Expected: exit code `0`, no output (the committed `dist/` already matches a fresh build, since it was rebuilt as recently as commit `986311b`).

- [ ] **Step 4: Verify the check fails when `dist/` is stale**

Run:

```bash
echo "// tmp-drift-check" >> dist/index.js
git diff --exit-code -- dist/ ; echo "exit code: $?"
git checkout -- dist/index.js
```

Expected: `git diff --exit-code` prints a diff and the echoed exit code is non-zero (`1`); the final `git checkout` restores `dist/index.js` to its committed state.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: fail instead of auto-pushing when dist/ is stale"
```

---

## Task 5: Add `RELEASING.md` and a release automation workflow

**Files:**
- Create: `RELEASING.md`
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Produces: a `workflow_dispatch` workflow with one required input, `version` (format `X.Y.Z`, no leading `v`), used manually from the GitHub Actions UI or `gh workflow run release.yml -f version=X.Y.Z`.

- [ ] **Step 1: Write `RELEASING.md`**

Create `RELEASING.md`:

```markdown
# Releasing

`pr-trailer-ghaction` is versioned with semantic version tags (`vX.Y.Z`)
plus a floating major-version tag (`vX`) that always points at the latest
release in that major line — this is the standard pattern for GitHub
Actions, since consumers pin `uses: owner/repo@v1` rather than a full
patch version.

## Cutting a release

1. Bump the `version` field in `package.json` to the new `X.Y.Z`.
2. Commit that change: `git commit -am "chore: bump version to X.Y.Z"`.
3. Push to `main` (via a reviewed PR, same as any other change).
4. From the GitHub Actions tab, run the **Release** workflow
   (`.github/workflows/release.yml`) via "Run workflow", entering the new
   version (e.g. `1.2.0`, no leading `v`).
5. The workflow tags `vX.Y.Z`, force-moves the floating `vX` tag to the
   same commit, pushes both tags, and creates a GitHub Release from
   `vX.Y.Z`.

## First release

The first release is `v1.0.0` (floating tag `v1`), matching what the
README already documents for the quickstart `uses:` line.
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

permissions:
  contents: write

jobs:
  tag-and-release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Validate version format
        run: |
          if ! [[ "${{ inputs.version }}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "::error::version must be X.Y.Z (no leading v), got '${{ inputs.version }}'"
            exit 1
          fi

      - name: Configure git identity
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Create version tag
        run: |
          git tag -a "v${{ inputs.version }}" -m "Release v${{ inputs.version }}"
          git push origin "v${{ inputs.version }}"

      - name: Move floating major tag
        run: |
          MAJOR="v$(echo '${{ inputs.version }}' | cut -d. -f1)"
          git tag -fa "$MAJOR" -m "Update $MAJOR to v${{ inputs.version }}"
          git push origin "$MAJOR" --force

      - name: Create GitHub Release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release create "v${{ inputs.version }}" \
            --title "v${{ inputs.version }}" \
            --generate-notes
```

- [ ] **Step 3: Verify both new files are well-formed**

Run:

```bash
python3 -c "
import yaml
with open('.github/workflows/release.yml') as f:
    data = yaml.safe_load(f)
assert True in data or 'on' in data  # YAML parses 'on:' as boolean True key in some parsers
assert data['jobs']['tag-and-release']['permissions']['contents'] == 'write' if 'permissions' in data['jobs']['tag-and-release'] else True
print('release.yml parses OK, top-level keys:', list(data.keys()))
"
grep -q "First release" RELEASING.md && echo "RELEASING.md OK"
```

Expected: no exceptions, `release.yml parses OK, ...` printed, and `RELEASING.md OK` printed.

- [ ] **Step 4: Commit**

```bash
git add RELEASING.md .github/workflows/release.yml
git commit -m "ci: add release workflow and RELEASING.md"
```

---

## Task 6: Add `SECURITY.md`

**Files:**
- Create: `SECURITY.md`

**Interfaces:** None (no code).

- [ ] **Step 1: Write `SECURITY.md`**

Create `SECURITY.md`:

```markdown
# Security Policy

## Reporting a vulnerability

If you find a security vulnerability in `pr-trailer-ghaction`, please do
**not** open a public GitHub issue. Instead, report it privately using
GitHub's [private vulnerability reporting](https://github.com/yasel-scf/pr-trailer-ghaction/security/advisories/new)
for this repository, or email yasel@scalingforge.com with details.

We'll acknowledge your report within 5 business days and keep you updated
as we investigate and fix the issue.

## Scope

This policy covers the `pr-trailer-ghaction` Action code itself (this
repository). It does not cover the separately-operated `pr-trailer-api`
backend service, which has its own reporting channel.

## Supported versions

Only the latest major version (currently `v1`) receives security fixes.
```

- [ ] **Step 2: Verify**

Run: `grep -q "Reporting a vulnerability" SECURITY.md && echo OK` — expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add SECURITY.md
git commit -m "docs: add SECURITY.md"
```

---

## Task 7: Remove the dead signup URL from `README.md`

**Files:**
- Modify: `README.md`

**Interfaces:** None (no code).

- [ ] **Step 1: Replace the placeholder line**

In `README.md`, replace:

```markdown
## Getting an API key

Request an API key at https://TODO-replace-with-pr-trailer-signup-url, then
add it as a secret in your repo (**Settings → Secrets and variables →
Actions**) named `PR_TRAILER_API_KEY`.
```

with:

```markdown
## Getting an API key

Hosted `pr-trailer-api` access is not yet publicly available — sign-up is
coming soon. Once you have a key, add it as a secret in your repo
(**Settings → Secrets and variables → Actions**) named
`PR_TRAILER_API_KEY`.
```

- [ ] **Step 2: Verify no TODO placeholders remain**

Run: `grep -ci "TODO" README.md` — expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: remove dead signup URL placeholder from README"
```

---

## Task 8: Cut the `v1.0.0` / `v1` release

This task pushes real tags to `origin` (the actual GitHub remote, not just
the local worktree) and creates a public-facing GitHub Release object.
This is outward-facing and not easily undone — **pause here and get
explicit confirmation from the user before running Step 2.**

**Files:** None — this task only creates git tags and a GitHub Release.

**Interfaces:** None.

- [ ] **Step 1: Confirm all prior tasks are merged**

Run: `git log --oneline -10` and `git status --short` — confirm Tasks 1–7's commits are present and the working tree is clean. If this plan is being executed on a feature branch, this task should not run until that branch is merged to `main` — releases are cut from `main`.

- [ ] **Step 2: Get explicit user confirmation, then trigger the release**

Ask the user to confirm before proceeding. Once confirmed, either:

- From the GitHub UI: Actions tab → "Release" workflow → "Run workflow" → enter `1.0.0` → Run, **or**
- Via CLI: `gh workflow run release.yml -f version=1.0.0`

- [ ] **Step 3: Verify the release**

Run: `git fetch --tags && git tag -l 'v1*'` — expected: both `v1.0.0` and `v1` listed.

Run: `gh release view v1.0.0` — expected: shows the release with generated notes.

(No commit — this task only creates tags/a release, no file changes.)

---

## Self-Review Notes

- **Spec coverage:** §1 untrack docs → Task 1. §2 LICENSE → Task 2. §3 branding → Task 3. §4 CI fix → Task 4. §5 release process → Task 5 (mechanism) + Task 8 (first cut). §6 SECURITY.md → Task 6. §7 README cleanup → Task 7. Explicitly-out-of-scope items (public flip, Marketplace submission, signup flow, history squash) have no tasks, as intended.
- **Placeholder scan:** no TBD/TODO/"handle appropriately" language; every step has literal file content or literal commands.
- **Type/name consistency:** `release.yml`'s `inputs.version` format (`X.Y.Z`, no `v`) matches `RELEASING.md`'s instructions and Task 8's usage (`version=1.0.0`). Branding `icon`/`color` values in Task 3's edit and its verification step match exactly.
