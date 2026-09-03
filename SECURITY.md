# Security Policy

## Reporting a vulnerability

If you find a security vulnerability in the `pr-trailer` Action, please do
**not** open a public GitHub issue.

Report it privately through GitHub's
[private vulnerability reporting](https://github.com/scalingforge/pr-trailer/security/advisories/new)
for this repository, or email support@scalingforge.com.

Please include enough detail to reproduce the issue — the affected version,
the conditions required, and the impact you observed.

We aim to acknowledge reports within 5 business days and will keep you
updated as we investigate.

## Scope

This policy covers the `pr-trailer` GitHub Action published from this
repository.

It does **not** cover the `pr-trailer` backend service (`pr-trailer-api`),
which is operated separately. For vulnerabilities in the hosted service,
email support@scalingforge.com directly.

## Handling your credentials

The Action requires a `pr-trailer` API key, supplied as a GitHub Actions
secret. Never commit an API key to your repository or paste one into an
issue. If you believe a key has been exposed, email support@scalingforge.com
and we will rotate it.

## Supported versions

Only the latest major version (currently `v1`) receives security fixes.
