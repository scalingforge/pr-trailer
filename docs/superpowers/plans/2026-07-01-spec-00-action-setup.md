# SPEC-00: Action Setup Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the `pr-trailer` GitHub Action project — build tooling, folder structure, and a "hello world" comment — so a real, installable Action runs end-to-end on a real PR with no business logic yet.

**Architecture:** A TypeScript project bundled with `@vercel/ncc` into a single committed `dist/index.js`, invoked by `action.yml` as a Node 20 action. `src/index.ts` contains all logic inline for this spec: read inputs via `@actions/core`, post one fixed comment via `@actions/github` (octokit), and call `core.setFailed` on error. Two workflows drive it: `ci.yml` (build/lint/typecheck/dist-freshness gate on every push) and `pr-trailer.yml` (runs the action against this same repo on `pull_request`, the literal e2e acceptance test).

**Tech Stack:** TypeScript, Node 20, npm, `@actions/core`, `@actions/github`, `@vercel/ncc`, ESLint (`typescript-eslint` recommended config) + Prettier, `tsc --noEmit`. No unit test framework this spec.

## Global Constraints

- TypeScript project, Node 20 target, npm as package manager.
- `action.yml`: `runs: { using: node20, main: dist/index.js }`, inputs `anthropic-api-key` (required, unused this spec) and `github-token` (default `${{ github.token }}`).
- `@vercel/ncc` bundles `src/index.ts` → committed `dist/index.js` (no `node_modules` at runtime).
- ESLint + Prettier (`typescript-eslint` recommended config) + `tsc --noEmit`.
- No unit test framework yet.
- Folder skeleton: `src/index.ts` (all logic inline), plus empty placeholder dirs `src/github/`, `src/prompt/`, `src/claude/`, `src/render/` each containing only `.gitkeep`.
- `.github/workflows/ci.yml` (push/pull_request): `npm ci` → `tsc --noEmit` → eslint → rebuild via ncc → `git diff --exit-code dist/`.
- `.github/workflows/pr-trailer.yml` (pull_request): `uses: ./`, posts the fixed test comment against this same repo.
- Out of scope: PR-context extraction, prompt construction, brief generation, comment update/marker logic.

---

### Task 1: Project init — package.json, tsconfig, dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

**Interfaces:**
- Produces: npm scripts `build` (ncc bundle), `typecheck` (`tsc --noEmit`), `lint` (eslint), `format` (prettier) that later tasks and CI rely on by exact name.
- Produces: `node_modules/@actions/core`, `node_modules/@actions/github` available for `src/index.ts` (Task 3) to import.

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
*.log
.DS_Store
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "pr-trailer",
  "version": "0.1.0",
  "private": true,
  "description": "GitHub Action that analyzes PRs and posts a risk-prioritized text review brief as a comment.",
  "main": "dist/index.js",
  "engines": {
    "node": "20.x"
  },
  "scripts": {
    "build": "ncc build src/index.ts -o dist",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "license": "MIT"
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "lib",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "lib"]
}
```

- [ ] **Step 4: Install runtime and dev dependencies**

Run:
```bash
npm install @actions/core @actions/github
npm install --save-dev typescript @vercel/ncc eslint @eslint/js typescript-eslint prettier eslint-config-prettier
```

Expected: `package.json` gains `dependencies` and `devDependencies` blocks; `package-lock.json` is created; `node_modules/` appears (ignored by git).

- [ ] **Step 5: Verify npm scripts are wired (no source yet, so build/typecheck will fail — that's expected)**

Run: `cat package.json`
Expected: scripts block matches Step 2 exactly, dependencies present.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore
git commit -m "chore: init npm project with TypeScript and Action dependencies"
```

---

### Task 2: Lint & format config — ESLint flat config + Prettier

**Files:**
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Create: `.prettierignore`

**Interfaces:**
- Consumes: `typescript-eslint`, `@eslint/js`, `eslint-config-prettier` from Task 1's devDependencies.
- Produces: `npm run lint` and `npx prettier --check .` usable by CI (Task 6).

- [ ] **Step 1: Create `eslint.config.js`** (flat config, typescript-eslint recommended + prettier compat)

```js
// @ts-check
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ['dist/**', 'lib/**', 'node_modules/**'],
  },
);
```

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 3: Create `.prettierignore`**

```
dist/
lib/
node_modules/
```

- [ ] **Step 4: Verify eslint config loads (will report "no files" or pass since `src/` is empty, that's fine — just confirm no config-parse error)**

Run: `npx eslint . --no-warn-ignored || true`
Expected: no crash/stacktrace about invalid config (may warn there are no matching files yet — acceptable at this point since `src/index.ts` doesn't exist until Task 3).

- [ ] **Step 5: Commit**

```bash
git add eslint.config.js .prettierrc .prettierignore
git commit -m "chore: add ESLint flat config and Prettier config"
```

---

### Task 3: Source skeleton — src/index.ts + placeholder module dirs

**Files:**
- Create: `src/index.ts`
- Create: `src/github/.gitkeep`
- Create: `src/prompt/.gitkeep`
- Create: `src/claude/.gitkeep`
- Create: `src/render/.gitkeep`

**Interfaces:**
- Consumes: `@actions/core` (`getInput`, `setFailed`), `@actions/github` (`getOctokit`, `context`) from Task 1.
- Produces: compiled entrypoint `src/index.ts` that Task 4 (ncc build) bundles into `dist/index.js`, and that `action.yml` (Task 5) points `main` at.

- [ ] **Step 1: Write `src/index.ts`**

```typescript
import * as core from '@actions/core';
import * as github from '@actions/github';

const TEST_COMMENT_BODY = '🤖 pr-trailer scaffold is alive';

async function run(): Promise<void> {
  // anthropic-api-key is declared as a required input but unused until a
  // later spec introduces real Claude API calls.
  core.getInput('anthropic-api-key', { required: true });
  const githubToken = core.getInput('github-token', { required: true });

  const octokit = github.getOctokit(githubToken);
  const { context } = github;

  const pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    core.info('No pull_request in event payload; skipping comment.');
    return;
  }

  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: pullRequest.number,
    body: TEST_COMMENT_BODY,
  });

  core.info(`Posted test comment on PR #${pullRequest.number}`);
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  core.setFailed(message);
});
```

- [ ] **Step 2: Create placeholder directories with `.gitkeep`**

```bash
mkdir -p src/github src/prompt src/claude src/render
touch src/github/.gitkeep src/prompt/.gitkeep src/claude/.gitkeep src/render/.gitkeep
```

- [ ] **Step 3: Typecheck the new source**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 4: Lint the new source**

Run: `npm run lint`
Expected: exits 0, no errors (fix any flagged issues before proceeding).

- [ ] **Step 5: Format check**

Run: `npx prettier --check src/index.ts`
Expected: reports the file as already formatted (if not, run `npx prettier --write src/index.ts` and re-check).

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: add scaffold entrypoint that posts a fixed test comment"
```

---

### Task 4: Build — ncc bundle committed to dist/

**Files:**
- Create: `dist/index.js` (and any `dist/*.js.map`/licenses ncc emits)

**Interfaces:**
- Consumes: `src/index.ts` (Task 3), `npm run build` script (Task 1).
- Produces: `dist/index.js` — the exact file `action.yml` (Task 5) sets as `runs.main`, and what `ci.yml`'s dist-freshness check (Task 6) diffs against.

- [ ] **Step 1: Run the bundler**

Run: `npm run build`
Expected: exits 0, creates `dist/index.js` (and likely `dist/index.js.map`, `dist/licenses.txt`).

- [ ] **Step 2: Sanity-check the bundle is self-contained (no external requires that would fail without node_modules)**

Run: `node -e "require('./dist/index.js')" 2>&1 | head -20`
Expected: it will throw at runtime (missing required Action env vars like `INPUT_ANTHROPIC-API-KEY` / `GITHUB_TOKEN` and no real GitHub Actions environment) — that's fine, the goal is confirming it *loads and executes JS* without a `Cannot find module` error for a package that should have been bundled. A "required input not supplied" or `setFailed` message printed to stderr is the expected/acceptable failure mode here; a `Cannot find module '@actions/...'` error would mean the bundle is broken.

- [ ] **Step 3: Commit the built bundle**

```bash
git add dist/
git commit -m "build: bundle src/index.ts to dist/index.js via ncc"
```

---

### Task 5: action.yml

**Files:**
- Create: `action.yml`

**Interfaces:**
- Consumes: `dist/index.js` (Task 4).
- Produces: the action metadata that `pr-trailer.yml` (Task 7) references via `uses: ./`.

- [ ] **Step 1: Write `action.yml`**

```yaml
name: 'pr-trailer'
description: 'Analyzes a pull request and posts a risk-prioritized review brief as a comment.'
inputs:
  anthropic-api-key:
    description: 'Anthropic API key used to generate the review brief.'
    required: true
  github-token:
    description: 'Token used to read PR data and post the comment.'
    required: false
    default: ${{ github.token }}
runs:
  using: 'node20'
  main: 'dist/index.js'
```

- [ ] **Step 2: Validate YAML syntax**

Run: `node -e "console.log(require('yaml').parse(require('fs').readFileSync('action.yml','utf8')))" 2>/dev/null || python3 -c "import yaml,sys; print(yaml.safe_load(open('action.yml')))"`
Expected: prints a parsed dict/object with keys `name`, `description`, `inputs`, `runs` — confirms valid YAML (use whichever of the two commands succeeds in the environment; a Python YAML parser is commonly available even without a `yaml` npm package installed).

- [ ] **Step 3: Commit**

```bash
git add action.yml
git commit -m "feat: add action.yml metadata for node20 runtime"
```

---

### Task 6: CI workflow — ci.yml

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build` (Task 1), committed `dist/` (Task 4).
- Produces: nothing consumed by later tasks; this is the terminal code-health gate.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  build-and-check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Rebuild dist
        run: npm run build

      - name: Verify committed dist/ is up to date
        run: git diff --exit-code dist/
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK`
Expected: prints `OK`.

- [ ] **Step 3: Locally simulate the CI steps end to end**

Run:
```bash
npm ci && npm run typecheck && npm run lint && npm run build && git diff --exit-code dist/
```
Expected: all steps pass, and `git diff --exit-code dist/` exits 0 (no diff) because `dist/` was already rebuilt and committed in Task 4 from the same `src/`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add build/typecheck/lint/dist-freshness workflow"
```

---

### Task 7: e2e workflow — pr-trailer.yml

**Files:**
- Create: `.github/workflows/pr-trailer.yml`

**Interfaces:**
- Consumes: `action.yml` (Task 5) via `uses: ./`.
- Produces: the permanent trigger workflow later specs will build real logic behind. This is the literal e2e acceptance test for SCA-109.

- [ ] **Step 1: Write `.github/workflows/pr-trailer.yml`**

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
        uses: ./
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          github-token: ${{ github.token }}
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/pr-trailer.yml'))" && echo OK`
Expected: prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pr-trailer.yml
git commit -m "ci: add pr-trailer e2e workflow that runs the action on pull_request"
```

---

### Task 8: Final verification pass

**Files:** none created; this task only runs checks across the whole tree.

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: confidence that `npm run build`/lint/typecheck all pass and `dist/index.js` is committed and fresh, ready for the report back to the user.

- [ ] **Step 1: Fresh install to catch any drift**

Run: `rm -rf node_modules && npm ci`
Expected: exits 0.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 4: Rebuild and confirm no diff**

Run: `npm run build && git status --porcelain dist/`
Expected: build exits 0; `git status --porcelain dist/` prints nothing (clean — committed bundle matches fresh build).

- [ ] **Step 5: Confirm full file tree matches the spec's structure**

Run: `find . -path ./node_modules -prune -o -type f -print | grep -v '^\./\.git' | sort`
Expected: includes `action.yml`, `package.json`, `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `src/index.ts`, `src/github/.gitkeep`, `src/prompt/.gitkeep`, `src/claude/.gitkeep`, `src/render/.gitkeep`, `dist/index.js`, `.github/workflows/ci.yml`, `.github/workflows/pr-trailer.yml`.

- [ ] **Step 6: Confirm git log shows the incremental commits**

Run: `git log --oneline -10`
Expected: shows the commits from Tasks 1–7 on top of the existing "Add design spec" and "initial commit" commits.

No commit for this task — it is verification-only. If any step fails, fix the underlying task and re-run this whole task before reporting completion.

---

## Manual acceptance step (cannot be done from this environment)

Per the spec's Testing section, the concrete SCA-109 acceptance criterion is: open a PR against this repo and confirm `pr-trailer.yml` runs and posts the fixed comment. This requires actually pushing a branch and opening a PR on GitHub — flag this clearly as the remaining manual step in the final report.
