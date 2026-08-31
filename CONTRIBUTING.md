# Contributing to omni-doc-viewer

Thank you for helping make omni-doc-viewer better! This guide walks you through
everything from your first fork to a merged pull request. It assumes you know
some TypeScript and git, but **not** that you have contributed to open source
before — every step is spelled out.

If anything here is unclear, open an issue and say so; improving this guide is
a contribution too.

---

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [How the project is organised](#how-the-project-is-organised)
- [Step 1 — Fork and clone the repository](#step-1--fork-and-clone-the-repository)
- [Step 2 — Set up your machine](#step-2--set-up-your-machine)
- [Step 3 — Create a branch](#step-3--create-a-branch)
- [Step 4 — Make your change](#step-4--make-your-change)
  - [Where things live](#where-things-live)
  - [Write a test first](#write-a-test-first)
  - [Running the tests](#running-the-tests)
  - [Trying it in the demo](#trying-it-in-the-demo)
- [Step 5 — Fixing a reported issue, end to end](#step-5--fixing-a-reported-issue-end-to-end)
- [Step 6 — Update the documentation](#step-6--update-the-documentation)
- [Step 7 — Verify everything](#step-7--verify-everything)
- [Step 8 — Commit with a Conventional Commit message](#step-8--commit-with-a-conventional-commit-message)
- [Step 9 — Push and open a pull request](#step-9--push-and-open-a-pull-request)
- [After you open the PR](#after-you-open-the-pr)
- [Keeping your fork up to date](#keeping-your-fork-up-to-date)
- [Reporting bugs and requesting features](#reporting-bugs-and-requesting-features)
- [Adding a new format or renderer](#adding-a-new-format-or-renderer)
- [Dependency policy](#dependency-policy)
- [Releases (maintainers)](#releases-maintainers)
- [Troubleshooting your setup](#troubleshooting-your-setup)
- [Scope reminder](#scope-reminder)
- [License](#license)

---

## Ways to contribute

You don't have to write code to help:

| Contribution | How |
|---|---|
| **Report a bug** | [Open a bug report](https://github.com/akbhuker/omni-doc-viewer/issues/new?template=bug_report.yml). A sample file that reproduces it is gold. |
| **Request a feature** | [Open a feature request](https://github.com/akbhuker/omni-doc-viewer/issues/new?template=feature_request.yml) and describe the problem you're solving. |
| **Improve docs** | Typos, unclear sections, missing examples — README and this guide. |
| **Triage** | Reproduce open issues, add missing details, confirm fixes. |
| **Fix a bug / build a feature** | Follow the steps below. Issues labelled `good first issue` are a great start. |

Before starting a large change, open an issue first so we can agree on the
approach — it saves everyone time.

---

## How the project is organised

```
omni-doc-viewer/
├─ src/
│  ├─ core/                    # framework-agnostic library ("omni-doc-viewer")
│  │  ├─ index.ts              #   public exports
│  │  ├─ render.ts             #   renderDocument(): normalize → detect → lazy-load engine → render
│  │  ├─ detect.ts             #   format detection (extension, MIME, magic bytes)
│  │  ├─ source.ts             #   normalizeSource(): URL/File/Blob/bytes → Uint8Array (+ progress, auth)
│  │  ├─ types.ts              #   all public types and error classes
│  │  ├─ mime.ts               #   MIME/extension tables
│  │  ├─ viewer/               #   download/print helpers (used by the React toolbar)
│  │  └─ renderers/            #   one module per format, each lazy-loaded
│  │     ├─ pdf.ts             #     pdf.js — canvas + text layer, virtualized
│  │     ├─ docx.ts            #     docx-preview
│  │     ├─ xlsx.ts            #     SheetJS (@e965/xlsx)
│  │     ├─ pptx/              #     pptx-preview + our EMF/WMF + placeholder fixes
│  │     ├─ image.ts, text.ts, markdown.ts, csv.ts
│  └─ react/                   # React wrapper ("omni-doc-viewer/react")
│     ├─ DocViewer.tsx         #   <DocViewer> component
│     ├─ Toolbar.tsx           #   pagination toolbar
│     └─ styles.ts, icons.tsx
├─ test/
│  ├─ unit/                    # pure functions, Node (detection, parsers…)
│  ├─ dom/                     # renderers + React components in happy-dom
│  ├─ browser/                 # real engines in headless Chromium (Playwright)
│  ├─ helpers/                 # shared test utilities (fake renderer…)
│  └─ setup.dom.ts             # polyfills for the dom project
├─ demo/                       # Vite playground (deployed to GitHub Pages)
├─ scripts/                    # sample/fixture generators
└─ .github/                    # CI workflows, issue & PR templates
```

Key ideas:

- **Everything runs in the browser.** No server, no uploads. Don't add code that needs one.
- **Engines are lazy.** Each renderer does `await import('engine')` so consumers only ship what they use. Keep it that way.
- **Core first, React second.** Put logic in `src/core` and keep `src/react` a thin wrapper, so Vue/Svelte/vanilla users get the same features.
- **Fail loudly, not silently.** A renderer that can't render must throw a `RenderError` with a `code`; a problem it worked around goes through `warn()` (→ `onWarning`).

---

## Step 1 — Fork and clone the repository

You can't push directly to this repository, so you work on your own copy (a *fork*).

1. Go to <https://github.com/akbhuker/omni-doc-viewer> and click **Fork** (top right). Keep the default settings and click **Create fork**. You now have `https://github.com/<your-username>/omni-doc-viewer`.
2. Clone **your fork** to your computer and add the original repository as `upstream` so you can pull in new changes later:

   ```bash
   git clone https://github.com/<your-username>/omni-doc-viewer.git
   cd omni-doc-viewer
   git remote add upstream https://github.com/akbhuker/omni-doc-viewer.git
   git remote -v   # origin = your fork, upstream = the main project
   ```

   If you use the GitHub CLI, `gh repo fork akbhuker/omni-doc-viewer --clone` does all of this in one go.

---

## Step 2 — Set up your machine

Requirements:

- **Node.js 20 or newer** (22 recommended — that's what CI uses). Check with `node -v`.
- **pnpm 10**. The easiest way is Corepack, which ships with Node:

  ```bash
  corepack enable
  corepack prepare pnpm@latest --activate
  pnpm -v
  ```

Install dependencies and confirm the baseline is green before you change anything:

```bash
pnpm install     # installs dependencies AND the git hooks (commitlint, lint)
pnpm verify      # lint + typecheck + unit/dom tests — should pass
```

Optional, for the real-browser tests (recommended if you touch a renderer):

```bash
pnpm exec playwright install chromium   # one-time ~150 MB download
pnpm samples                            # generate the sample documents the tests render
pnpm test:browser
```

---

## Step 3 — Create a branch

Never work on `main`. Create a short-lived branch per change, named after the
kind of change (same prefixes as commit types):

```bash
git checkout main
git pull upstream main          # make sure you start from the latest code
git checkout -b fix/pptx-zero-slides     # or feat/…, docs/…, refactor/…, chore/…
```

---

## Step 4 — Make your change

### Where things live

| I want to… | Look at |
|---|---|
| change how a format is drawn | `src/core/renderers/<format>.ts` |
| change how a file's format is detected | `src/core/detect.ts` (+ `test/unit/detect.test.ts`) |
| change how URLs/Files are loaded | `src/core/source.ts` |
| add an option to `renderDocument()` / `<DocViewer>` | `src/core/types.ts` (types) → renderer → `src/react/DocViewer.tsx` (prop) → README |
| change the toolbar | `src/react/Toolbar.tsx`, styles in `src/react/styles.ts` |
| change download/print | `src/core/viewer/download.ts`, `src/core/viewer/print.ts` |

### Write a test first

We practise test-driven development: **write a failing test that shows the bug
or the missing behaviour, watch it fail, then make it pass.** A test that was
never red proves nothing.

Pick the right test project:

| Project | Environment | Use it for | Location |
|---|---|---|---|
| `unit` | Node | pure functions: detection, parsers, string/byte helpers | `test/unit/*.test.ts` |
| `dom` | happy-dom | renderers that only need a DOM, React components, download/print | `test/dom/*.test.{ts,tsx}` |
| `browser` | headless Chromium | anything that needs a real engine: pdf.js, docx-preview, SheetJS, pptx-preview, canvas | `test/browser/*.test.ts` |

Tips:

- Mock as little as possible. The React tests use `test/helpers/fake-render.ts`
  (a stand-in for `renderDocument`) so they can test navigation without an engine.
- For bugs caused by a specific file, don't commit someone's real document.
  Build a **minimal fixture** in `scripts/lib/samples.mjs` / `scripts/make-fixtures.mjs`
  (we generate PDFs, DOCX, XLSX and PPTX programmatically) or mutate an
  existing sample in the test with JSZip to reproduce the broken structure.
- Name tests after the behaviour: `it('hides sheets flagged hidden in the workbook')`,
  not `it('works')`.

### Running the tests

```bash
pnpm test                                  # unit + dom (fast, no browser needed)
pnpm test:watch                            # same, re-runs on save
pnpm exec vitest run --project dom test/dom/docx.test.ts   # one file
pnpm test:browser                          # real engines in Chromium (see Step 2)
pnpm exec vitest run --project browser -t "pptx"           # filter by test name
```

### Trying it in the demo

```bash
pnpm dev:demo      # http://localhost:5173 — Vite playground, uses the library source directly
```

Drop a real file onto the page. If you changed a renderer, also toggle
**DevTools → Network → Offline** and reload: the document must still render
(that's the whole point of this library).

---

## Step 5 — Fixing a reported issue, end to end

A worked example, using the kind of report we actually get: *"I upload a PPTX
and it shows 0 slides, no error in the console."*

1. **Reproduce it.** Ask the reporter for the file if they can share it (or the
   output of `inspectPptx()` / the `onWarning` messages — see the bug template).
   Open it in the demo. Confirm you see the same thing.
2. **Find the cause.** Add `console.log`s or step through with DevTools. Here the
   engine (`pptx-preview`) silently returns zero slides when
   `[Content_Types].xml` references a part that isn't in the zip.
3. **Write the failing test.** In `test/browser/`, build a fixture that has the
   same defect (e.g. take `sample.pptx`, add a phantom `<Override>` with JSZip)
   and assert that `renderDocument()` either renders the slides or throws a
   `RenderError` with a clear `code` — never a silent `pageCount: 0`.
   Run it. It must fail.
4. **Fix it** in `src/core/renderers/pptx/`. Run the test until it passes, then
   run the whole suite (`pnpm test && pnpm test:browser`).
5. **Document it.** If users can now do something new, or an error/warning code
   was added, update the README (see Step 6).
6. **Commit** with a message that references the issue, e.g.
   `fix(pptx): repair Content_Types overrides so decks no longer render 0 slides (#7)`.
7. **Open the PR** with `Closes #7` in the description so the issue closes on merge.

---

## Step 6 — Update the documentation

Documentation is part of the change, not an afterthought. Depending on what you
touched, update:

| You changed… | Update |
|---|---|
| a prop / option / callback | README → *Props* table, *Core API* table, *Configuration* section |
| an error or warning code | README → *Error handling* / *Warnings & diagnostics* |
| format support (new extension, new limitation) | README → *Supported formats* / *Out of scope* |
| how something is built/tested/released | this file (`CONTRIBUTING.md`) |
| a dependency's license | `NOTICE` |

Do **not** edit `CHANGELOG.md` or the `version` in `package.json` — both are
generated from commit messages by release-please (see [Releases](#releases-maintainers)).

---

## Step 7 — Verify everything

Before you commit:

```bash
pnpm verify          # lint + typecheck + unit/dom tests
pnpm test:browser    # if you touched a renderer, the worker setup, or fetching
pnpm build           # make sure the library still builds (dist/)
```

CI runs exactly these on every pull request (on Node 22 and 24), plus a
production-dependency security audit (`pnpm audit --prod --audit-level=high`).

---

## Step 8 — Commit with a Conventional Commit message

Commit messages are **machine-read**: they decide the next version number and
write the changelog. Every commit must follow
[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short description in the imperative>

<optional body: what and why, not how>

<optional footer, e.g. "Closes #123" or "BREAKING CHANGE: …">
```

| Type | Use for | Version bump |
|---|---|---|
| `fix` | bug fixes | patch (0.1.3 → 0.1.4) |
| `feat` | new user-facing features | minor (0.1.3 → 0.2.0) |
| `perf` | performance improvements | patch |
| `docs`, `test`, `refactor`, `chore`, `build`, `ci`, `style`, `revert` | everything else | none |
| any type with `!` or a `BREAKING CHANGE:` footer | incompatible changes | major (or minor while we're pre-1.0) |

Scopes we use: `pdf`, `docx`, `xlsx`, `pptx`, `csv`, `markdown`, `image`, `text`,
`core`, `react`, `demo`, `deps`.

Examples:

```
fix(pdf): fall back to a CDN worker when the bundled worker URL 404s
feat(react): expose docx rendering options as a prop
perf(csv): virtualize rows so 100k-line files stay responsive
docs: explain how to pass auth headers for signed URLs
chore(deps): bump dompurify to 3.4.14
```

A `commit-msg` git hook (installed by `pnpm install`) rejects messages that
don't match, and CI checks them again. If the hook rejects your message, just
`git commit --amend` and fix it.

**Do not** add generated "co-authored-by" trailers or tool signatures to commits.

---

## Step 9 — Push and open a pull request

```bash
git push -u origin fix/pptx-zero-slides
```

Then open a pull request from your branch to `akbhuker/omni-doc-viewer:main` —
GitHub shows a **Compare & pull request** button right after you push, or run
`gh pr create --fill`.

- The **PR title must be a Conventional Commit** too (it becomes the squash-merge commit).
- Fill in the template: what and why, `Closes #<issue>`, the checklist.
- Keep one logical change per PR. Two unrelated fixes = two PRs.
- Include screenshots/GIFs for anything visual.

---

## After you open the PR

1. **CI runs** (lint, typecheck, build, tests on two Node versions, browser
   tests, commit-message lint, security audit). Click *Details* on a red check
   to see why; push a fix commit — no need to open a new PR.
2. **A maintainer reviews.** Expect questions and suggestions; that's normal.
   Reply to each comment, push follow-up commits, and click *Resolve* when done.
3. **Merge.** Maintainers squash-merge, so your branch's commit history doesn't
   have to be tidy — the PR title becomes the single commit on `main`.
4. Your change ships in the next release (see [Releases](#releases-maintainers)).

---

## Keeping your fork up to date

If `main` moved while you were working:

```bash
git fetch upstream
git rebase upstream/main        # replay your commits on top of the latest main
git push --force-with-lease     # update your PR branch
```

To sync your fork's `main` itself:

```bash
git checkout main
git pull upstream main
git push origin main
```

---

## Reporting bugs and requesting features

Good bug reports make fixes fast. Please include:

- the **version** (`npm ls omni-doc-viewer`), the **format**, and whether you use
  `omni-doc-viewer` (core) or `omni-doc-viewer/react`;
- your **bundler/framework** (Vite, Next.js App Router, webpack, CRA…) — many
  PDF issues are worker/bundler related;
- the **browser** and OS;
- the **file**, or a minimal one with the same structure. If you can't share
  it, include what `onWarning` reported and, for PPTX, the output of
  `inspectPptx()` (see README → Troubleshooting);
- the **console output** (errors *and* warnings).

For features, describe the problem you're trying to solve, not just the
solution — there may be a simpler way that fits the library.

---

## Adding a new format or renderer

1. Add the type to `DocType` in `src/core/types.ts` and its extensions/MIME
   types in `src/core/detect.ts` and `src/core/mime.ts` (with unit tests).
2. Create `src/core/renderers/<format>.ts` exporting `render: Renderer`. Lazy-load
   any engine (`await import('engine')`). Return `{ type, meta, pages?, destroy }`.
   Report recoverable problems with `warn({ code, message })`; throw
   `RenderError` for real failures.
3. Register it in `RENDERER_LOADERS` (`src/core/render.ts`).
4. Add a sample to `scripts/lib/samples.mjs`, a browser smoke test in
   `test/browser/render.smoke.test.ts`, and any dom/unit tests.
5. Document it: README *Supported formats* table, *Bundle size* section, and
   `NOTICE` if the engine has its own license.
6. Engines must be permissively licensed (MIT/Apache/ISC/BSD) and work fully
   client-side.

---

## Dependency policy

- Prefer **no new runtime dependency**. If one is needed, discuss it in the
  issue first: size, license, maintenance, and whether it can be lazy-loaded.
- Runtime dependencies must be free of High/Critical advisories — CI enforces
  `pnpm audit --prod --audit-level=high`.
- Pin engines whose worker/API versions must match (pdf.js) exactly; use caret
  ranges elsewhere.
- Bumps that fix advisories use `fix(deps): …` so a release is published;
  routine bumps use `chore(deps): …`.

---

## Releases (maintainers)

Releases are automated with
[release-please](https://github.com/googleapis/release-please). Nobody bumps the
version or edits `CHANGELOG.md` by hand.

1. Conventional commits land on `main` via squash-merged PRs.
2. release-please opens/updates a **"chore(main): release x.y.z"** PR that bumps
   the version and writes the changelog from those commits.
3. Merging that PR creates a git tag + GitHub Release, which triggers the
   *Release* workflow to `npm publish` the new version (with provenance) and the
   *Deploy demo* workflow to publish the playground to GitHub Pages.

One-time repository setup: an **`NPM_TOKEN`** secret (npm *automation* token).
`GITHUB_TOKEN` is provided by Actions.

---

## Troubleshooting your setup

| Problem | Fix |
|---|---|
| `ERR_PNPM_ADDING_TO_ROOT` when running `pnpm add` | This is a workspace (library + demo). Add `-w` for root deps: `pnpm add -w -D <pkg>`; for the demo: `pnpm --filter omni-doc-viewer-demo add <pkg>`. |
| `pnpm test:browser` fails with "browser not found" | Run `pnpm exec playwright install chromium` once. |
| Browser tests can't find `sample.pdf` etc. | Run `pnpm samples` to generate them. |
| Commit rejected by the `commit-msg` hook | Your message isn't a Conventional Commit. `git commit --amend` and use `type(scope): description`. |
| Hooks don't run at all | They're installed by `pnpm install` (via Husky). Re-run it, and make sure you're inside a git checkout. |
| `pnpm verify` passes locally but CI fails on lint | CI uses the same command; check you're on Node ≥ 20 and ran `pnpm install` after pulling (the lint config may have changed). |
| pdf.js "worker" errors in the demo | Vite resolves the worker automatically; if you changed how it's resolved, see README → *The pdf.js worker*. |
| Windows: line-ending noise in diffs | `git config core.autocrlf input`. |

---

## Scope reminder

This package renders documents **client-side only**. Things that need a server
(faithful legacy `.doc`/`.ppt` conversion, pixel-perfect PPTX with
animations/charts) are intentionally out of scope — see the README's scope
table before proposing them. Framework-specific wrappers beyond React are
welcome as separate packages built on the core API.

---

## License

By contributing, you agree your contributions are licensed under the project's
[MIT license](./LICENSE).
