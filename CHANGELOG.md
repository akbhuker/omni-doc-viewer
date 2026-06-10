# Changelog

All notable changes to this project are documented here.

This file is maintained automatically by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/). Do not edit it by
hand — write good commit messages instead.

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
