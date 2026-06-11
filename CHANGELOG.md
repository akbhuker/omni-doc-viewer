# Changelog

All notable changes to this project are documented here.

This file is maintained automatically by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/). Do not edit it by
hand — write good commit messages instead.

## [0.1.2](https://github.com/akbhuker/omni-doc-viewer/compare/omni-doc-viewer-v0.1.1...omni-doc-viewer-v0.1.2) (2026-06-11)


### Features

* **react:** add opt-in paginated viewer with page navigation ([2ffadce](https://github.com/akbhuker/omni-doc-viewer/commit/2ffadcea125be8b7f714d7f1ecc1fe12cb611816))


### Bug Fixes

* **pptx:** render EMF/WMF metafiles and placeholder pictures ([9a0d8e9](https://github.com/akbhuker/omni-doc-viewer/commit/9a0d8e9d9005f11660f8fd2f6653c59d4975ed0a))
* **pptx:** render EMF/WMF metafiles and placeholder pictures ([ad7353a](https://github.com/akbhuker/omni-doc-viewer/commit/ad7353a53362f53d08921ff6ff888a6c00a33253))

## [0.1.1](https://github.com/akbhuker/omni-doc-viewer/compare/omni-doc-viewer-v0.1.0...omni-doc-viewer-v0.1.1) (2026-06-10)


### Features

* initial public release of omni-doc-viewer ([5091d19](https://github.com/akbhuker/omni-doc-viewer/commit/5091d19cc7deb3c4fe12679abbf712ecc69e098b))


### Bug Fixes

* replace flaky bundlephobia badge and drop premature downloads badge ([8afdf5b](https://github.com/akbhuker/omni-doc-viewer/commit/8afdf5bd930947ddad8b061586c9e94d14def260))

## 0.1.0 (Unreleased)

Initial release.

### Features

- Unified `renderDocument()` core API for PDF, DOCX, XLSX and PPTX, fully
  client-side (no server, no Microsoft iframe, no API keys).
- Automatic format detection by extension and magic bytes (incl. OOXML
  container inspection and OLE legacy-format detection).
- `<DocViewer>` React component (`omni-doc-viewer/react`) with loading/error
  states and SSR safety.
- Per-format engines lazy-loaded via dynamic `import()` for minimal bundle size.
- Sources accepted: URL, `File`, `Blob`, `ArrayBuffer`, `Uint8Array`.
