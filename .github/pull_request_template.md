<!--
PR title MUST be a Conventional Commit, e.g.:
  fix(pptx): strip phantom slideMaster from Content_Types
It becomes the squash-merge commit message and drives the changelog.
-->

## What & why

<!-- What does this change do, and why is it needed? -->

Closes #

## Type of change

- [ ] fix — bug fix (patch)
- [ ] feat — new feature (minor)
- [ ] docs / chore / refactor / test / build / ci
- [ ] breaking change (major) — describe the migration below

## Checklist

- [ ] PR title follows Conventional Commits
- [ ] `pnpm verify` passes (lint + typecheck + test)
- [ ] Verified in the demo (`pnpm dev:demo`) if a renderer changed
- [ ] Updated the README/scope table if behavior or support changed
- [ ] No new runtime dependency added without discussion

## Notes for reviewers

<!-- Anything tricky, screenshots, trade-offs, follow-ups. -->
