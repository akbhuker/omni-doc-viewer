# Changelog

All notable changes to this project are documented here.

This file is maintained automatically by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/). Do not edit it by
hand — write good commit messages instead.

## [0.2.0](https://github.com/akbhuker/omni-doc-viewer/compare/omni-doc-viewer-v0.1.3...omni-doc-viewer-v0.2.0) (2026-08-31)


### ⚠ BREAKING CHANGES

* **pdf:** pdfjs-dist 6 raises the browser floor to Chrome/Edge 125+, Safari 18+ and Firefox ESR 128+. Set `pdf: { legacy: true }` to load the pdfjs-dist/legacy build instead.

### Features

* **core:** fetch options, progress, new sources, structured errors, renderer registry ([3f5351b](https://github.com/akbhuker/omni-doc-viewer/commit/3f5351b6c880317e3367e6138ee11086dc595d6d))
* **core:** framework-agnostic viewer controller with search, theming and thumbnails ([9d6b7b9](https://github.com/akbhuker/omni-doc-viewer/commit/9d6b7b9d2223859fb140572433aad90fcad5c6e5))
* **core:** video, audio, sandboxed HTML, JSON and code renderers; docx options ([5ca9be3](https://github.com/akbhuker/omni-doc-viewer/commit/5ca9be3c262fed5e82270271bf0af73dbeff1a57))
* **pdf:** pdf.js 6 with resilient worker, fonts, password, crisp zoom, rotation, links ([26fb390](https://github.com/akbhuker/omni-doc-viewer/commit/26fb3906464b55b63def8f1a2ed760d6bd256b25))
* **react:** ref API, find bar, theming, labels, toolbar customization, password prompt ([c5d6d64](https://github.com/akbhuker/omni-doc-viewer/commit/c5d6d645592a0346dd544acfcd8c5f127f21e73a))


### Bug Fixes

* **deps:** patch runtime advisories, replace xlsx with @e965/xlsx, pin pdfjs-dist 6 ([75018db](https://github.com/akbhuker/omni-doc-viewer/commit/75018db6d048356f3c52a9e85e6fd24ec877d707))
* **pptx:** inspect and repair decks that rendered 0 slides ([524e03d](https://github.com/akbhuker/omni-doc-viewer/commit/524e03d6181156916642dcdd3a296e620f23e279)), closes [#7](https://github.com/akbhuker/omni-doc-viewer/issues/7)


### Performance Improvements

* **table:** virtualized CSV and XLSX tables with data-set search, sniffing and row caps ([162660f](https://github.com/akbhuker/omni-doc-viewer/commit/162660f33504b08a01f450b0f34e38cfe68580d2))

## [0.1.3](https://github.com/akbhuker/omni-doc-viewer/compare/omni-doc-viewer-v0.1.2...omni-doc-viewer-v0.1.3) (2026-06-12)


### Features

* **core:** render images, text, markdown and csv ([ef78d74](https://github.com/akbhuker/omni-doc-viewer/commit/ef78d74f2f4027be1b4e2193196e6c63d9243d8d))
* **core:** render images, text, markdown and csv ([4eb5005](https://github.com/akbhuker/omni-doc-viewer/commit/4eb5005af797d0f698bc84be333d83c5de11b284))
* **pdf:** add selectable text layer and virtualized rendering ([d0443e4](https://github.com/akbhuker/omni-doc-viewer/commit/d0443e4d71ac9d0e2885e1817d990a95cb500394))
* **react:** add download, print and fit-width toolbar actions ([485705c](https://github.com/akbhuker/omni-doc-viewer/commit/485705c41478e369485cc0f5f07a7c0ebf08ca00))

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
