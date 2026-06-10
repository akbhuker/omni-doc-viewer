# Contributing to omni-doc-viewer

Thanks for helping out! This guide covers the branch model, commit rules, local
setup, and how releases work. Following it keeps `main` always releasable and
keeps the changelog accurate and automatic.

---

## TL;DR

```bash
git checkout main && git pull
git checkout -b fix/short-description      # feat/ fix/ docs/ chore/ ...
pnpm install                               # installs git hooks automatically
# ...make your change...
pnpm verify                                # lint + typecheck + test
git commit -m "fix(pptx): describe the change"   # Conventional Commits required
git push -u origin fix/short-description
gh pr create --fill                        # open a PR into main
```

CI runs on the PR. Once it's green and reviewed, it gets **squash-merged** into
`main`. You never push to `main` directly.

---

## Branch model (GitHub Flow)

| Branch | Purpose |
|---|---|
| `main` | Always stable and releasable. Protected — **PRs only**, no direct pushes. This is what's published to npm and deployed to GitHub Pages. |
| `feat/*`, `fix/*`, `docs/*`, `chore/*` | Short-lived working branches, one per change. Deleted after merge. |

There is intentionally **no long-lived `dev` branch**. For a single-package
library that just creates merge drift; branch off `main` per task instead.

Branch naming: use the same prefixes as commit types — `feat/`, `fix/`,
`docs/`, `refactor/`, `chore/`, etc.

---

## Commit messages — Conventional Commits (enforced)

Every commit message **must** follow
[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(optional scope): <subject>

[optional body]

[optional footer(s)]
```

Examples:

```
feat(react): add onLoad callback with page count
fix(pptx): strip phantom slideMaster from Content_Types
docs: clarify pdf.js worker setup for webpack
chore(deps): bump pdfjs-dist to 4.10
```

**Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, `revert`.

These types drive automated versioning and the changelog:

| Commit | Version bump |
|---|---|
| `fix:` | patch (0.1.0 → 0.1.1) |
| `feat:` | minor (0.1.0 → 0.2.0) |
| `feat!:` / `fix!:` or a `BREAKING CHANGE:` footer | major (0.x → 1.0.0) |

Enforcement happens in **two** places, so a bad message is caught early:

1. **Locally** — a Husky `commit-msg` hook runs commitlint when you commit.
   (Hooks are installed by `pnpm install` via the `prepare` script. They only
   work inside a git checkout.)
2. **In CI** — the *Commit lint* workflow validates every commit on a PR.

The same `pnpm lint` runs on a `pre-commit` hook, so obvious lint errors are
caught before they reach CI.

---

## Local setup

Requirements: **Node ≥ 18** and **pnpm 9+** (`corepack enable`).

```bash
pnpm install            # deps + git hooks
pnpm build              # build the library (dist/)
pnpm test               # unit tests (vitest)
pnpm typecheck          # tsc --noEmit
pnpm lint               # eslint
pnpm verify             # all three quality checks at once

pnpm samples            # regenerate demo sample documents
pnpm dev:demo           # run the Vite playground
```

When changing a renderer, always verify in the real demo (`pnpm dev:demo`) — drop
a real `.pdf` / `.docx` / `.xlsx` / `.pptx`, and toggle DevTools → Offline to
confirm the no-server promise still holds.

---

## Pull requests

- One logical change per PR. Keep them focused and small where possible.
- Fill out the PR template. Link the issue it closes (`Closes #123`).
- Make sure `pnpm verify` passes and the build is green.
- A maintainer squash-merges; your PR's title should also be a valid
  Conventional Commit (it becomes the squash commit message).

---

## Releases (maintainers)

Releases are automated with
[release-please](https://github.com/googleapis/release-please). You do **not**
bump the version or edit `CHANGELOG.md` by hand.

1. Conventional commits land on `main` via merged PRs.
2. release-please opens/updates a **"chore: release x.y.z"** PR that bumps the
   version and writes the changelog from those commits.
3. Merging that PR creates a git tag + GitHub Release, which triggers the
   *Release* workflow to `npm publish` the new version (with provenance).

One-time repo setup for publishing:

- Add an **`NPM_TOKEN`** repository secret (an npm *automation* access token).
- `GITHUB_TOKEN` is provided automatically by Actions.

---

## Scope reminder

This package renders documents **client-side only**. Things that need a server
(faithful legacy `.doc`/`.ppt` conversion, pixel-perfect PPTX with
animations/charts) are intentionally out of scope — see the README's scope
table before proposing them.

By contributing, you agree your contributions are licensed under the project's
[MIT license](./LICENSE).
