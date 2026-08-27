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
