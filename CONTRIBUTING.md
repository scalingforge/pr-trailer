# Contributing

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/).

Format: `type(scope): description`

Common types used in this repo:

| Type | Use for |
|---|---|
| `feat` | New functionality (a new source file, a new input, new behavior) |
| `fix` | Bug fixes |
| `chore` | Tooling/config/dependency setup with no behavior change |
| `build` | Build system or bundling changes (e.g. ncc, tsconfig) |
| `ci` | CI/CD workflow changes (`.github/workflows/**`) |
| `docs` | Documentation only (specs, plans, README, this file) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |

Scope is optional and should name the affected area (e.g. `feat(github): ...`).

Keep commits small and scoped to one logical change — prefer several small
commits over one large one.
