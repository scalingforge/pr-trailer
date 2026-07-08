# Vertical MVP: auth, brief/script/TTS pipeline, and comment delivery

The full design spec for this repo's changes — PR context extraction
(`extractPrContext`), the real `POST /v1/jobs` + polling API client
(replacing the current stub `/brief` ping), and extending the PR comment
with an audio link — lives in the sibling repo, alongside the matching
`pr-trailer-api` pipeline work it depends on:

[`pr-trailer-api/docs/superpowers/specs/2026-07-08-vertical-mvp-audio-pipeline-design.md`](https://github.com/yasel-scf/pr-trailer-api/blob/main/docs/superpowers/specs/2026-07-08-vertical-mvp-audio-pipeline-design.md)

That spec is the source of truth for this vertical slice across both
repos; keep this repo's
[`docs/superpowers/specs/2026-07-04-action-api-wiring-design.md`](../superpowers/specs/2026-07-04-action-api-wiring-design.md)
as historical context for the earlier stub-ping wiring it now replaces.
