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

### GitHub Actions workflow permissions

Every workflow in `.github/workflows/` must declare an explicit top-level
`permissions:` block — never rely on the repository or organization's
default `GITHUB_TOKEN` permissions, which can change independently of this
repo and aren't visible from the workflow file itself.

- Default to the minimum the workflow's steps actually use. Most of our
  workflows only read (`contents: read`); grant `write` only on the specific
  scope a step needs (e.g. `pull-requests: write` to post a comment,
  `contents: write` only on a job that pushes a tag or commit).
- Never request a scope nothing in the workflow uses. If you remove the
  step that needed a permission, remove the permission in the same commit.
- Prefer the narrowest scope that grants the access, not the broadest one
  that would also work — e.g. posting a PR comment needs `pull-requests:
  write`, not `issues: write`, even though both can create comments.

This mirrors how `pr-trailer` itself is documented to customers (see
[README.md § Required permissions](./README.md#required-permissions)) — the
Action should never ask a consumer's workflow for more than it uses, and
our own CI shouldn't either.

`npm install` wires up a pre-commit hook (see `.githooks/pre-commit`) that
rebuilds `dist/` and stages it whenever a commit touches `src/`,
`package.json`, `package-lock.json`, or `tsconfig.json`. This keeps CI's
"dist/ is up to date" check from failing after a push — don't bypass it
with `--no-verify`.

Releases are cut manually — see [RELEASING.md](./RELEASING.md).
