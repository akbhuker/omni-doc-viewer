# omni-doc-viewer

[![npm version](https://img.shields.io/npm/v/omni-doc-viewer.svg)](https://www.npmjs.com/package/omni-doc-viewer)
[![unpacked size](https://img.shields.io/npm/unpacked-size/omni-doc-viewer)](https://www.npmjs.com/package/omni-doc-viewer)
[![types included](https://img.shields.io/npm/types/omni-doc-viewer.svg)](https://www.npmjs.com/package/omni-doc-viewer)
[![license: MIT](https://img.shields.io/npm/l/omni-doc-viewer.svg)](./LICENSE)

> **One `<DocViewer>` for PDF, Word, Excel, PowerPoint, images, Markdown, CSV & text — 100% in the browser.**
> No server. No Microsoft Office iframe. No public-URL requirement. No API keys.

**[▶ Live demo](https://akbhuker.github.io/omni-doc-viewer/)** — drop in a file or try a sample. Works offline.

```tsx
import { DocViewer } from 'omni-doc-viewer/react'

<DocViewer source={file} pagination />
```

---

## Table of contents

- [Why omni-doc-viewer](#why-omni-doc-viewer)
- [Features](#features)
- [Supported formats](#supported-formats)
- [Installation](#installation)
- [Quick start](#quick-start)
  - [React](#react)
  - [Without a framework](#without-a-framework)
- [Loading a document](#loading-a-document)
- [React component (DocViewer)](#react-component-docviewer)
  - [Props](#props)
  - [Page navigation (pagination)](#page-navigation-pagination)
  - [Custom loading & error UI](#custom-loading--error-ui)
  - [Lifecycle callbacks](#lifecycle-callbacks)
  - [Imperative API (`ref`)](#imperative-api-ref)
  - [Search in document](#search-in-document)
  - [Theming, dark mode & CSP](#theming-dark-mode--csp)
  - [Customizing the toolbar & translations](#customizing-the-toolbar--translations)
- [Core API (framework-agnostic)](#core-api-framework-agnostic)
  - [`renderDocument(options)`](#renderdocumentoptions)
  - [`createViewer(options)` — the viewer controller](#createvieweroptions--the-viewer-controller)
  - [`RenderResult`](#renderresult)
  - [Format detection](#format-detection)
  - [`normalizeSource(source)`](#normalizesourcesource)
- [Configuration & per-format tuning](#configuration--per-format-tuning)
- [Cancellation & timeouts](#cancellation--timeouts)
- [Error handling](#error-handling)
- [The pdf.js worker (bundler setup)](#the-pdfjs-worker-bundler-setup)
- [Framework integration](#framework-integration)
  - [Next.js / SSR](#nextjs--ssr)
- [Bundle size & lazy loading](#bundle-size--lazy-loading)
- [Security](#security)
- [Accessibility](#accessibility)
- [Browser support](#browser-support)
- [TypeScript](#typescript)
- [Comparison](#comparison)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## Why omni-doc-viewer

Most "free" document viewers force a bad trade-off. They either:

- **embed Microsoft / Google Office Online in an iframe** — which needs the internet *and* a publicly reachable file URL, so it's useless for private, local, offline, or auth-gated files; or
- are **paid commercial SDKs**; or
- are **a pile of separate single-format libraries** you have to find, wire together, and maintain yourself.

`omni-doc-viewer` wraps proven, permissively-licensed rendering engines behind **one API**, with **automatic format detection** and **per-format lazy loading**. It runs entirely in the browser — works offline, no backend, no keys, no uploads.

```
 source (URL │ File │ Blob │ ArrayBuffer │ Uint8Array)
        │
        ▼
   normalize ──▶ detect ──▶ lazy-load the one engine ──▶ render ──▶ RenderResult
   (→ bytes)    (type)      (only what you use)          (into DOM)  (+ destroy())
```

---

## Features

- **13 formats, one component** — PDF, Word (`.docx`), Excel (`.xlsx`/`.xls`), PowerPoint (`.pptx`), images, Markdown, CSV/TSV, plain text, source code, JSON, HTML, video and audio — plus a registry for your own renderers.
- **100% client-side** — no server, no Office iframe, no public URL, no API keys. Works offline.
- **Automatic format detection** — by file extension *and* by magic bytes, so it works even with no filename.
- **Selectable, searchable PDFs** — a real text layer means copy/paste and screen readers work, and the built-in **find bar** searches every page (even ones not rendered yet) with highlights. Password-protected PDFs, CJK fonts and a self-healing worker setup are handled.
- **Virtualized rendering** — large PDFs only rasterize the pages near the viewport (with a memory cap), so a 500-page file stays fast and memory-light. Page sizes are read lazily, so first paint doesn't wait for every page.
- **Crisp zoom & rotation** — zooming re-rasterizes PDF pages at the new scale after a short debounce (instant CSS zoom first, then sharp pixels); rotation is native for PDFs.
- **Large tables stay smooth** — CSV files and spreadsheets are rendered as virtualized tables (only the visible rows exist in the DOM), with search over the whole data set, merged cells, column widths, number formats, and a configurable row cap.
- **Clickable links** — URLs open in a new tab, internal links jump to the target page.
- **Opt-in page navigation** — a polished, responsive toolbar: prev/next, jump-to-page, zoom, fit-width, download, print, and a paged ⇄ continuous toggle.
- **Real images in PowerPoint** — EMF/WMF metafiles are rasterized to PNG, layout-inherited picture placeholders are positioned correctly (cases most viewers drop), and slide media is served as object URLs (no base64 inflation on the heap). Decks with broken `[Content_Types]`/relationship structures are repaired before rendering instead of silently showing 0 slides.
- **Safe Markdown** — rendered HTML is sanitized with DOMPurify (no XSS from untrusted files).
- **Per-format lazy loading** — a consumer who only shows PDFs never ships the Excel/PowerPoint/Markdown code.
- **Framework-agnostic core + optional React wrapper** — use it anywhere, or drop in `<DocViewer />`.
- **First-class TypeScript** — full types, no `@types` package needed.
- **SSR-safe** — inert on the server, renders on the client.

---

## Supported formats

| Format | Extensions | Engine | Renders to |
|---|---|---|---|
| **PDF** | `.pdf` | [pdfjs-dist](https://github.com/mozilla/pdf.js) | `<canvas>` per page **+ selectable text layer**, virtualized |
| **Word** | `.docx` | [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) | semantic, paginated HTML |
| **Excel** | `.xlsx`, `.xls` | [SheetJS CE 0.20](https://github.com/SheetJS/sheetjs) via [`@e965/xlsx`](https://www.npmjs.com/package/@e965/xlsx) | sheet tabs + virtualized table (column letters, merged cells, column widths, number formats; hidden sheets hidden) |
| **PowerPoint** | `.pptx` | [pptx-preview](https://www.npmjs.com/package/pptx-preview) + [emf-converter](https://www.npmjs.com/package/emf-converter) | HTML/CSS slides (EMF/WMF rasterized) |
| **Image** | `.png` `.jpg` `.jpeg` `.gif` `.webp` `.svg` `.bmp` `.avif` `.ico` | native | `<img>` |
| **Markdown** | `.md` `.markdown` `.mdown` `.mkd` | [marked](https://github.com/markedjs/marked) + [DOMPurify](https://github.com/cure53/DOMPurify) | sanitized HTML |
| **CSV / TSV** | `.csv` `.tsv` | built-in (RFC 4180) | virtualized table (sticky header, only visible rows in the DOM), delimiter auto-detected (`,` `\t` `;` `\|`) |
| **Text** | `.txt` `.log`, or any UTF-8 text | built-in | `<pre>` (wrapped) |
| **Code** | `.js` `.ts` `.py` `.java` `.go` `.rs` `.css` `.xml` `.yaml` `.sql` `.sh` … | built-in | monospace with line numbers (`data-language` for your own highlighting) |
| **JSON** | `.json` `.jsonl` `.geojson` | built-in | pretty-printed with line numbers |
| **HTML** | `.html` `.htm` | built-in + [DOMPurify](https://github.com/cure53/DOMPurify) | sanitized, in a fully sandboxed `<iframe>` |
| **Video** | `.mp4` `.webm` `.mov` `.m4v` `.ogv` | native | `<video controls>` |
| **Audio** | `.mp3` `.wav` `.ogg` `.m4a` `.aac` `.flac` | native | `<audio controls>` |

Need another format (DICOM, EPUB, multi-page TIFF, …)? [Register your own renderer](#custom-renderers-and-fallbacks).

### Out of scope

- **Legacy binary `.doc` / `.ppt`** (pre-2007 OLE). These need a server-side converter. Passing one throws an [`UnsupportedFormatError`](#error-handling) with a clear message. (`.xls` *does* work — SheetJS parses it.)
- **PowerPoint fidelity:** slides are a *readable preview* — animations, transitions, 3D, charts, SmartArt, OLE objects and speaker notes are not reproduced.

---

## Installation

```bash
npm install omni-doc-viewer
# or
pnpm add omni-doc-viewer
# or
yarn add omni-doc-viewer
# or
bun add omni-doc-viewer
```

- **React is optional.** It's a peer dependency you only need if you import `omni-doc-viewer/react`. The core (`omni-doc-viewer`) has no UI-framework dependency.
- **ESM and CommonJS** builds are both shipped, with TypeScript declarations.
- **Node ≥ 18** to build/develop; at runtime it targets evergreen browsers.

```jsonc
// package.json "exports"
"."        // → renderDocument, detect, types, … (framework-agnostic)
"./react"  // → <DocViewer />, DocViewerProps, …
```

---

## Quick start

### React

```tsx
'use client'
import { useState } from 'react'
import { DocViewer } from 'omni-doc-viewer/react'

export function Example() {
  const [file, setFile] = useState<File | string>('/docs/report.pdf')

  return (
    <>
      <input
        type="file"
        accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.svg,.md,.csv,.txt"
        onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
      />

      <DocViewer
        source={file}            // URL | File | Blob | ArrayBuffer | Uint8Array
        pagination               // page-by-page toolbar (optional)
        style={{ height: '80vh' }}
        onLoad={(meta) => console.log('loaded', meta.type, meta.pageCount)}
        onError={(err) => console.error(err)}
      />
    </>
  )
}
```

### Without a framework

The core gives you an element + a source. It works with any framework, or none.

```ts
import { renderDocument } from 'omni-doc-viewer'

const container = document.getElementById('viewer')!

const view = await renderDocument({
  container,                 // contents are replaced
  source: fileOrUrlOrBuffer, // anything in DocSource
})

console.log(view.type, view.meta.pageCount)

// later — free engine resources, listeners and DOM:
view.destroy()
```

---

## Loading a document

`source` accepts anything in the `DocSource` union — pick whatever you already have:

```ts
type DocSource =
  | string                                   // URL (http(s):, blob:) or data: URL
  | File | Blob | ArrayBuffer | Uint8Array
  | Response                                 // an already-fetched response
  | { base64: string; filename?: string; mime?: string }
```

| Source | How it's handled | Detection hints |
|---|---|---|
| `string` (URL) | `fetch`ed with your [`fetchOptions`](#authenticated-urls-fetchoptions) and [progress](#download-progress-onprogress) | URL path filename, `Content-Type`, `Content-Disposition` |
| `string` (`data:` URL) | decoded locally — never fetched | media type |
| `File` | read via `arrayBuffer()` | `file.name`, `file.type` |
| `Blob` | read via `arrayBuffer()` | `blob.type` |
| `ArrayBuffer` / `Uint8Array` | used directly | magic bytes only |
| `Response` | body is streamed (progress works) | `Content-Type`, `Content-Disposition` filename |
| `{ base64 }` | decoded locally | `filename` / `mime` you pass |

```ts
// From a URL
renderDocument({ container, source: 'https://example.com/a.pdf' })

// From an <input type="file"> or drag-and-drop
renderDocument({ container, source: event.target.files[0] })

// From bytes you already have (e.g. a decrypted buffer)
renderDocument({ container, source: myUint8Array, type: 'pdf' })
```

> Detection order: explicit `type` → filename extension → MIME type (if specific) → magic bytes. When the source has no filename/extension (a `Blob`, `ArrayBuffer`, or an extensionless URL), detection falls back to the MIME type and then magic-byte sniffing. If you already know the format, pass `type` to skip detection entirely.

### Authenticated URLs (`fetchOptions`)

Private files — signed S3/GCS URLs, cookie-protected downloads, bearer tokens — work by passing the same options you'd give `fetch()`. Either a `RequestInit`, or a function that receives the URL and returns one (handy for per-request signing):

```tsx
<DocViewer source={url} fetchOptions={{ headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }} />

renderDocument({
  container,
  source: url,
  fetchOptions: async (u) => ({ headers: { Authorization: await getToken(u) } }),
})
```

The library always manages the `AbortSignal` itself (so cancellation keeps working); a `signal` inside `fetchOptions` is ignored. Cross-origin URLs still need CORS headers from the server — that's a browser rule, not a library one. If you already fetched the file yourself, pass the `Response` (or its `Blob`) instead.

### Download progress (`onProgress`)

```tsx
<DocViewer
  source={url}
  onProgress={(loaded, total) => setPct(total ? Math.round((loaded / total) * 100) : null)}
  loading={(progress) => <Spinner value={progress?.loaded} max={progress?.total} />}
/>
```

`total` comes from `Content-Length` and is `undefined` when the server doesn't send it or compresses the body (`Content-Encoding`). Local sources (`File`, bytes, `data:`) report a single `(size, size)` call. The default loading indicator shows a percentage when the total is known.

---

## React component (DocViewer)

```tsx
import { DocViewer, type DocViewerProps, type ViewMode } from 'omni-doc-viewer/react'
```

### Props

`DocViewerProps` extends the per-format tuning options (`pdf`, `pptx`, `docx` — see [Configuration](#configuration--per-format-tuning)).

| Prop | Type | Default | Description |
|---|---|---|---|
| `source` | `DocSource` | **required** | URL string, `File`, `Blob`, `ArrayBuffer` or `Uint8Array`. |
| `type` | `DocType` | auto | Force a format and skip auto-detection. |
| `fetchOptions` | `RequestInit \| (url) => RequestInit` | — | Headers/credentials for URL sources ([details](#authenticated-urls-fetchoptions)). |
| `onProgress` | `(loaded, total?) => void` | — | Download progress ([details](#download-progress-onprogress)). |
| `pagination` | `boolean` | `false` | Enable the page-navigation toolbar inside a scrollable viewport. |
| `initialViewMode` | `'paged' \| 'continuous'` | `'paged'` | Layout when `pagination` is on: one page at a time, or a scrolling stack. |
| `initialZoom` | `number \| 'fit-width' \| 'auto'` | `'auto'` | Zoom after load. `'auto'` fits the page width in containers narrower than 600px (phones, sidebars) and uses 100% otherwise. |
| `gestures` | `boolean` | `true` | Pinch / <kbd>Ctrl</kbd>+wheel to zoom, horizontal swipe to flip pages (paged mode). |
| `height` | `number \| string` | `'80vh'` | Viewport height when `pagination` is on. Number = px. |
| `toolbar` | `boolean` | = `pagination` | Show the toolbar. Set `false` to keep navigation logic but hide the chrome. |
| `loading` | `ReactNode \| (progress?) => ReactNode` | spinner text | Shown while the engine + document load; the function form receives `{ loaded, total? }`. |
| `errorFallback` | `(error: Error) => ReactNode` | message | Render prop for the error state. |
| `onLoad` | `(meta: RenderMeta) => void` | — | Fired once the document has rendered. |
| `onError` | `(error: Error) => void` | — | Fired if rendering fails. |
| `onWarning` | `(warning: RenderWarning) => void` | — | Fired for recoverable problems the renderer worked around (see [Warnings](#warnings--diagnostics)). |
| `onPageChange` | `(page: number, total: number) => void` | — | Fired when the current page changes (1-based). |
| `theme` | `'light' \| 'dark' \| 'auto'` | — | Colour theme ([details](#theming-dark-mode--csp)). |
| `styleNonce` | `string` | — | CSP nonce for injected stylesheets. |
| `labels` | `Partial<DocViewerLabels>` | English | Translate / override any string ([details](#customizing-the-toolbar--translations)). |
| `toolbarItems` | `Partial<Record<ToolbarItem, boolean>>` | all on | Hide toolbar sections: `pages`, `zoom`, `fitWidth`, `rotate`, `search`, `thumbnails`, `download`, `print`, `viewMode`. Controls that don't apply to the current document are hidden automatically (no page/zoom/print controls for video or audio, no page controls for single-page files, no rotate/search/thumbnails where unsupported). |
| `toolbarExtra` | `ReactNode` | — | Extra controls in the toolbar's action group. |
| `renderToolbar` | `(ctx) => ReactNode` | — | Replace or wrap the toolbar (`ctx.defaultToolbar`, `ctx.state`, `ctx.controller`, `ctx.labels`). |
| `thumbnails` | `boolean \| { width?, defaultOpen? }` | off | Page-thumbnail sidebar with a toolbar toggle ([details](#thumbnails-sidebar)). |
| `pdf` | `PdfTuning` | — | PDF tuning: scale, text layer, worker, fonts, password ([details](#configuration--per-format-tuning)). |
| `pptx` | `{ width?, height?, showHiddenSlides? }` | — | PowerPoint slide size; whether to show hidden slides. |
| `docx` | `DocxTuning` | — | Word rendering options — headers/footers/comments/tracked changes/page breaks ([details](#configuration--per-format-tuning)). |
| `csv` | `{ delimiter?, maxRows? }` | auto / 200 000 | Force a delimiter; cap the rows kept in memory ([details](#configuration--per-format-tuning)). |
| `xlsx` | `{ showHiddenSheets?, maxRows? }` | false / 200 000 | Show hidden sheets; cap the rows parsed per sheet. |
| `html` | `{ sanitize?, height? }` | true / 80vh | HTML sanitization & iframe height. |
| `renderers` | `Record<string, loader \| registration>` | — | Custom / overriding renderers ([details](#custom-renderers-and-fallbacks)). |
| `fallback` | `AnyDocType \| loader` | — | What to render when detection fails. |
| `className` | `string` | — | Applied to the root element. |
| `style` | `CSSProperties` | — | Applied to the root element. |

### Page navigation (pagination)

Set `pagination` to turn the plain viewer into a full reading experience. The toolbar gives you:

- **Prev / next** and a **page number input** you can type into (`n / total`) to jump.
- **Zoom** (−, %, +), **fit-width**, **download** (original bytes), and **print**.
- A **paged ⇄ continuous** toggle (one page at a time, or a vertical scroll of all pages).
- **Keyboard navigation:** <kbd>←</kbd>/<kbd>→</kbd>, <kbd>PageUp</kbd>/<kbd>PageDown</kbd>, <kbd>Home</kbd>/<kbd>End</kbd>, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>F</kbd> to find.
- **Touch & trackpad:** pinch to zoom, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+wheel to zoom, swipe left/right to flip pages in paged mode (`gestures`, on by default). On phones and narrow sidebars the page is fitted to the width automatically (`initialZoom="auto"`).
- **Vertical *and* horizontal scrolling** (horizontal kicks in when zoomed or for wide slides).

```tsx
<DocViewer
  source={file}
  pagination
  initialViewMode="paged"     // or "continuous"
  height="80vh"               // or a number of px
  onPageChange={(page, total) => setLabel(`${page} / ${total}`)}
/>
```

The toolbar is **responsive to the viewer's own width** (via CSS container queries), so it stays usable in a narrow sidebar or on a phone — not just based on the window size.

> Pagination is meaningful for paged formats (PDF, PPTX, DOCX). Spreadsheets navigate by their own **sheet tabs** (`goToPage(n)` / the page input switch sheets); single images/text render as one page.

### Custom loading & error UI

```tsx
<DocViewer
  source={file}
  loading={<MySpinner />}
  errorFallback={(err) => <MyError message={err.message} />}
/>
```

### Lifecycle callbacks

```tsx
<DocViewer
  source={file}
  onLoad={(meta) => {
    // meta.type:      'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'markdown' | 'csv' | 'text'
    // meta.pageCount: number | undefined  (pages/slides/sheets when meaningful)
  }}
  onPageChange={(page, total) => {}}
  onError={(err) => {}}
/>
```

`<DocViewer />` automatically **cancels an in-flight render** and **tears down resources** when the `source` changes or the component unmounts — no manual cleanup needed.

Callbacks are read through refs, so passing a new inline function on every render never reloads the document. Per-format tuning (`pdf`, `pptx`, `docx`) is compared **by value** — `pdf={{ scale: 2 }}` as an inline literal is fine; only an actual change (e.g. `textLayer: false`) triggers a re-render.

### Imperative API (`ref`)

Everything the toolbar can do is available programmatically, so you can build your own controls (or hide the toolbar with `toolbar={false}`):

```tsx
import { useRef } from 'react'
import { DocViewer, type ViewerHandle } from 'omni-doc-viewer/react'

function Reader({ file }: { file: File }) {
  const viewer = useRef<ViewerHandle>(null)
  return (
    <>
      <button onClick={() => viewer.current?.prevPage()}>‹</button>
      <button onClick={() => viewer.current?.nextPage()}>›</button>
      <button onClick={() => viewer.current?.goToPage(10)}>Go to 10</button>
      <button onClick={() => viewer.current?.fitWidth()}>Fit width</button>
      <button onClick={() => viewer.current?.rotate()}>Rotate</button>
      <button onClick={() => viewer.current?.download('report.pdf')}>Download</button>
      <DocViewer ref={viewer} source={file} pagination toolbar={false} />
    </>
  )
}
```

| Method | Description |
|---|---|
| `goToPage(n)`, `nextPage()`, `prevPage()`, `getPage()`, `getPageCount()` | Navigation (1-based; clamped). |
| `setZoom(z)`, `zoomIn()`, `zoomOut()`, `resetZoom()`, `fitWidth()`, `fitPage()` | Zoom (0.25–4). |
| `rotate(delta?)`, `setRotation(0 \| 90 \| 180 \| 270)` | Rotation — PDFs natively, images via CSS; a no-op where unsupported (see `getState().capabilities.rotate`). |
| `setViewMode('paged' \| 'continuous')`, `toggleViewMode()` | Layout. |
| `search(query)`, `findNext()`, `findPrev()`, `clearSearch()` | [In-document search](#search-in-document). |
| `print()`, `download(filename?)` | Same as the toolbar buttons. |
| `getState()`, `subscribe(listener)` | Read / observe the [viewer state](#createvieweroptions--the-viewer-controller). |
| `getController()`, `getElement()` | Escape hatches to the core controller and the root element. |

All methods are safe to call before the document has loaded (they no-op). The `ViewerHandle` type is exported from `omni-doc-viewer/react`.

### Search in document

With `pagination` on, the toolbar has a **Find** button (also <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>F</kbd> while the viewer is focused). It opens a find bar with a match counter, next/previous (<kbd>Enter</kbd> / <kbd>Shift</kbd>+<kbd>Enter</kbd>) and close (<kbd>Esc</kbd>). Matches are highlighted; the active one is scrolled into view — and, for PDFs, **pages that are virtualized away are searched too**: the index is built from pdf.js text content for every page, and selecting a match renders that page.

Programmatic use (React ref or core controller):

```ts
const total = await viewer.search('quarterly revenue')   // highlights all matches, selects the first
await viewer.findNext()                                  // wraps around
await viewer.findPrev()
viewer.getState().search                                 // { query, status, total, current }
viewer.clearSearch()
```

Highlights use the CSS Custom Highlight API where available (no DOM changes), falling back to `<mark class="odv-hl">` wrappers — style them with `::highlight(odv-search)` / `::highlight(odv-search-active)` or `.odv-hl` / `.odv-hl-active`. Search is available for every format except images (`getState().capabilities.search`); for spreadsheets it covers the active sheet. The `<SearchBar>` component is exported from `omni-doc-viewer/react` if you want to place it yourself.

### Thumbnails sidebar

```tsx
<DocViewer source={file} pagination thumbnails />                              // toggle in the toolbar
<DocViewer source={file} pagination thumbnails={{ defaultOpen: true, width: 100 }} />
```

Thumbnails are rendered lazily as they scroll into view and evicted when far away, so a 500-page PDF costs nothing until you open the sidebar. PDFs get real rasterized thumbnails (one at a time, cached); other formats show a scaled, inert copy of the page. The current page is highlighted and kept in view; clicking jumps to it. Under 560px the sidebar overlays the document. From the core: `createThumbnailStrip(controller, { container, width })`.

### Theming, dark mode & CSP

```tsx
<DocViewer source={file} pagination theme="dark" />   // or "light" | "auto" (follows prefers-color-scheme)
```

The viewer is styled entirely through `--odv-*` custom properties (toolbar, stage, page shadow, inputs, highlights, text colours), defined with zero-specificity `:where()` selectors so your own rules always win:

```css
.my-viewer { --odv-accent: #e11d48; --odv-bg: #0b0b0d; --odv-toolbar-bg: #17171a; }
/* Render PDF/image pages dark too (they are white by default): */
.my-viewer { --odv-page-filter: invert(0.9) hue-rotate(180deg); }
```

Tokens: `--odv-font`, `--odv-bg`, `--odv-fg`, `--odv-fg-muted`, `--odv-border`, `--odv-toolbar-bg`, `--odv-toolbar-fg`, `--odv-toolbar-hover`, `--odv-toolbar-active`, `--odv-input-bg`, `--odv-input-border`, `--odv-accent`, `--odv-accent-ring`, `--odv-page-bg`, `--odv-page-shadow`, `--odv-page-filter`, `--odv-highlight`, `--odv-highlight-active`, `--odv-selection`, `--odv-surface`, `--odv-surface-alt`, `--odv-error`. When no `theme` is passed nothing is tagged and the light defaults apply — existing integrations look exactly as before.

**Content Security Policy.** Stylesheets are injected through constructable stylesheets (`adoptedStyleSheets`), which CSP `style-src` doesn't restrict; where that API is missing they fall back to `<style>` elements carrying your nonce: `<DocViewer styleNonce={nonce} />` or `renderDocument({ styleNonce })` / `setStyleNonce(nonce)`. Inline styles are set through the CSSOM (`element.style.x = …`), which is likewise CSP-clean. The pdf.js worker needs `worker-src` to allow its URL (or `blob:` when a CDN fallback is used).

### Customizing the toolbar & translations

```tsx
<DocViewer
  source={file}
  pagination
  labels={{ nextPage: 'Weiter', previousPage: 'Zurück', download: 'Herunterladen', matches: (c, t) => `${c} von ${t}` }}
  toolbarItems={{ print: false, viewMode: false }}
  toolbarExtra={<button onClick={share}>Share</button>}
/>

// Or take over the whole bar and reuse the default one where you like:
<DocViewer
  source={file}
  pagination
  renderToolbar={({ state, controller, defaultToolbar }) => (
    <header className="my-bar">
      <span>{state.page} / {state.pageCount}</span>
      {defaultToolbar}
      <button onClick={() => controller?.fitWidth()}>Fit</button>
    </header>
  )}
/>
```

`DocViewerLabels` covers every string (toolbar buttons, view-mode toggle, loading/error text, the find bar); `DEFAULT_LABELS` is exported so you can spread and override. A **rotate** button appears automatically for formats that support rotation (PDF, images).

---

## Core API (framework-agnostic)

```ts
import {
  renderDocument,
  detect,
  detectFromExtension,
  detectFromBytes,
  normalizeSource,
  setPdfWorkerSrc,
  UnsupportedFormatError,
  FormatDetectionError,
} from 'omni-doc-viewer'
```

### `renderDocument(options)`

Detects the format, lazy-loads the matching engine, renders into `container`, and returns a handle.

```ts
function renderDocument(options: RenderOptions): Promise<RenderResult>
```

| Option | Type | Notes |
|---|---|---|
| `container` | `HTMLElement` | **required** — its contents are replaced. |
| `source` | `DocSource` | **required** — URL, `File`, `Blob`, `ArrayBuffer`, `Uint8Array`. |
| `type` | `DocType` | Optional override; skips detection. |
| `signal` | `AbortSignal` | Cancel an in-flight render ([details](#cancellation--timeouts)). |
| `fetchOptions` | `RequestInit \| (url) => RequestInit` | Headers/credentials for URL sources. |
| `onProgress` | `(loaded, total?) => void` | Download progress. |
| `onNavigate` | `(page: number) => void` | An internal PDF link/named action asked to go to `page`. Default: scroll that page into view (the viewer controller routes it to `goToPage`). |
| `onError` | `(error: Error) => void` | Called on failure; the promise also rejects. |
| `onWarning` | `(warning: RenderWarning) => void` | Called for recoverable problems (see [Warnings](#warnings--diagnostics)). |
| `pdf` | `PdfTuning` | PDF tuning: scale, text layer, worker, fonts, password. |
| `pptx` | `{ width?, height?, showHiddenSlides? }` | Slide size; hidden slides. |
| `docx` | `DocxTuning` | Word options (headers, footers, comments, changes, page breaks). |
| `csv` | `{ delimiter?, maxRows? }` | Delimiter override; row cap (default 200 000). |
| `xlsx` | `{ showHiddenSheets?, maxRows? }` | Hidden sheets; per-sheet row cap. |
| `html` | `{ sanitize?, height? }` | HTML sanitization & iframe height. |
| `renderers` | `Record<string, loader \| registration>` | Custom / overriding renderers. |
| `fallback` | `AnyDocType \| loader` | Render undetectable input with this type/loader. |

```ts
const view = await renderDocument({
  container: document.getElementById('viewer')!,
  source: file,
  pdf: { scale: 2 },
})
```

> `renderDocument` runs **in the browser only**. On the server it throws a clear error — defer to the client (see [Next.js / SSR](#nextjs--ssr)).

### `createViewer(options)` — the viewer controller

Everything `<DocViewer pagination>` does — page tracking, paged/continuous layout, zoom, rotation, keyboard navigation, download/print, search — lives in a framework-agnostic controller. Use it directly from Vue, Svelte, Angular or vanilla JS and get feature parity with the React component:

```ts
import { createViewer } from 'omni-doc-viewer'

const viewer = createViewer({
  host: document.getElementById('host')!,          // the document renders here
  scrollElement: document.getElementById('stage')!, // scroll container (defaults to the nearest scrollable ancestor)
  pagination: true,
  initialViewMode: 'paged',
  onPageChange: (page, total) => label.textContent = `${page} / ${total}`,
  onLoad: (meta) => console.log(meta),
})

await viewer.load(file)            // or a URL, Blob, bytes, Response, { base64 }
viewer.nextPage()
viewer.fitWidth()
viewer.subscribe((state) => render(state))   // state: page, pageCount, zoom, rotation, viewMode, status, progress, capabilities…
stage.addEventListener('keydown', (e) => viewer.handleKeyDown(e))
// later
viewer.destroy()
```

`ViewerState`:

```ts
interface ViewerState {
  status: 'idle' | 'loading' | 'loaded' | 'error'
  error: Error | null
  type?: DocType
  meta?: RenderMeta
  page: number; pageCount: number
  zoom: number; rotation: 0 | 90 | 180 | 270
  viewMode: 'paged' | 'continuous'
  progress?: { loaded: number; total?: number }
  search: { query: string; status: 'idle' | 'searching' | 'done'; total: number; current: number }
  capabilities: { paged: boolean; zoom: boolean; print: boolean; rotate: boolean; search: boolean; thumbnails: boolean; rescale: boolean }
}
```

The controller has the same methods as the React [`ViewerHandle`](#imperative-api-ref) plus `load(source, overrides?)`, `reload()`, `getResult()` and `destroy()`.

### `RenderResult`

```ts
interface RenderResult {
  type: DocType
  meta: RenderMeta            // { type, pageCount?, truncated? }
  pages?: HTMLElement[]       // page/slide/section elements, in order
  bytes?: Uint8Array          // the exact bytes that were rendered
  filename?: string           // from the URL path / File.name, when known
  destroy(): void             // free listeners, engine resources, clear container
  // optional capabilities a renderer may implement (used by the viewer controller):
  setScale?(scale): Promise<void> | void       // crisp re-rasterization at a new scale
  rotate?(deg): Promise<void> | void           // native rotation
  goToPage?(n): void                           // e.g. switch spreadsheet tab
  search?: SearchProvider                      // in-document search
  thumbnails?: ThumbnailProvider               // page thumbnails
}
```

`bytes` and `filename` let you offer a download or print **without re-fetching** — and without cross-origin trouble, because you can build a same-origin `Blob` URL from them (this is exactly what the toolbar's download/print buttons do):

```ts
const view = await renderDocument({ container, source: 'https://cdn.example.com/signed/report.pdf' })
const url = URL.createObjectURL(new Blob([view.bytes!], { type: 'application/pdf' }))
// <a href={url} download={view.filename}> … URL.revokeObjectURL(url) when done
```

Always call `destroy()` when you're done (the React wrapper does this for you):

```ts
const view = await renderDocument({ container, source })
// …
view.destroy()
```

### Format detection

Detection runs in priority order: **explicit override → filename/URL extension → MIME type (when specific) → magic bytes**.

```ts
// Full resolver (throws on unsupported/undetectable):
detect({ bytes, filename?, mime?, override? }): DocType

// Lower-level helpers (return undefined instead of throwing):
detectFromExtension(nameOrUrl: string): DocType | undefined
detectFromBytes(bytes: Uint8Array): DocType | undefined
```

```ts
detectFromExtension('report.PDF?token=1#p2') // → 'pdf'
detectFromExtension('data.csv')              // → 'csv'

detectFromBytes(pdfBytes)                     // → 'pdf'  (via "%PDF")
detectFromBytes(new Uint8Array([0x89,0x50]))  // → 'image' (PNG)
```

- OOXML files (`.docx`/`.xlsx`/`.pptx`) are all ZIPs — detection peeks at the internal part names (`word/`, `xl/`, `ppt/`) to tell them apart **without unzipping**.
- Anything that isn't a known binary but looks like UTF-8 text falls back to `'text'`.
- Legacy `.doc`/`.ppt` throw [`UnsupportedFormatError`](#error-handling); truly unknown input throws `FormatDetectionError`.

### Custom renderers and fallbacks

Add a format the library doesn't ship, or replace a built-in engine, without forking:

```ts
import { registerRenderer, type Renderer } from 'omni-doc-viewer'

const render: Renderer = async ({ container, bytes, filename, options, warn, signal }) => {
  const { default: dicomParser } = await import('dicom-parser')   // lazy-load your engine
  // … draw into `container` …
  return { type: 'dicom', meta: { type: 'dicom', pageCount: 1 }, destroy: () => container.replaceChildren() }
}

// App-wide: extension / MIME / magic-byte detection + loader
registerRenderer('dicom', {
  load: async () => ({ render }),
  extensions: ['dcm'],
  mimeTypes: ['application/dicom'],
  sniff: (bytes) => bytes.length > 131 && String.fromCharCode(...bytes.subarray(128, 132)) === 'DICM',
})

// Or per call / per component:
renderDocument({ container, source, renderers: { dicom: async () => ({ render }) }, type: 'dicom' })
<DocViewer source={file} renderers={{ pdf: async () => ({ render: myPdfRenderer }) }} />   // override a built-in
```

Resolution order is per-call `renderers` → `registerRenderer()` → built-ins, for both detection rules and loaders. A custom renderer receives the same `RendererInput` as the built-ins (`container`, `bytes`, `filename`, `mime`, `options`, `signal`, `warn`) and may implement the optional capabilities (`search`, `thumbnails`, `setScale`, `rotate`, `goToPage`) — the viewer picks them up automatically. `createDomSearchProvider`, `createHighlighter`, `createVirtualTable` and `createTableSearchProvider` are exported so you can reuse the built-in machinery.

When detection fails (`FormatDetectionError`), `fallback` renders the bytes anyway:

```ts
renderDocument({ container, source, fallback: 'text' })        // show undetectable input as text
<DocViewer source={file} fallback={async () => ({ render: hexDump })} />
```

Type-level note: `RenderResult.type` / `RenderMeta.type` are `AnyDocType` (`DocType | string`) so custom types fit; narrow with `if (meta.type === 'pdf')` as before.

### `normalizeSource(source, options?)`

Turn any `DocSource` into raw bytes (+ filename / MIME hints when available). Useful if you want to inspect or detect before rendering.

```ts
const { bytes, filename, mime } = await normalizeSource(source, { signal?, fetchOptions?, onProgress? })
const type = detect({ bytes, filename, mime })
```

(The older `normalizeSource(source, signal)` form still works.)

---

## Configuration & per-format tuning

Pass `pdf`, `pptx` and/or `docx` to either `renderDocument` or `<DocViewer />`.

```ts
interface RenderTuning {
  pdf?: {
    scale?: number               // canvas render scale. Default 1.5 (crisp on most displays)
    textLayer?: boolean          // selectable/searchable text overlay. Default true
    password?: string | (reason: 'need' | 'incorrect') => string | null | Promise<string | null>
    workerSrc?: string           // explicit pdf.js worker URL (see worker section)
    workerFallbackCdn?: boolean | string // load the worker from a CDN if the bundled one fails. Default false
    assetsUrl?: string           // self-hosted pdfjs-dist folder (cmaps/, standard_fonts/, wasm/) for CJK fonts & JPX images
    cMapUrl?, standardFontDataUrl?, wasmUrl?, iccUrl?: string // per-folder overrides
    legacy?: boolean             // use pdfjs-dist/legacy for older browsers. Default false
    annotations?: boolean        // clickable links (URLs + internal jumps). Default true
    externalLinkTarget?: '_blank' | '_self' // Default '_blank'
    maxRenderedPages?: number    // memory cap on simultaneously rasterized pages. Default 12
  }
  pptx?: {
    width?: number       // slide width in px. Default: container width (or 960)
    height?: number      // slide height in px. Default: width * 9/16
    showHiddenSlides?: boolean // render slides PowerPoint marks hidden. Default false
  }
  docx?: {
    breakPages?: boolean                  // one <section> per page. Default true
    ignoreLastRenderedPageBreak?: boolean // honour Word's own page-break marks when false. Default true
    renderHeaders?: boolean               // Default true
    renderFooters?: boolean               // Default true
    renderFootnotes?: boolean             // Default true
    renderEndnotes?: boolean              // Default true
    renderComments?: boolean              // review comments (experimental). Default false
    renderChanges?: boolean               // tracked changes (insertions/deletions). Default false
    ignoreWidth?: boolean                 // fluid width instead of the page width. Default false
    ignoreHeight?: boolean                // Default false
    ignoreFonts?: boolean                 // skip embedded fonts. Default false
  }
  csv?: {
    delimiter?: string    // ',' '\t' ';' '|' …  Default: auto-detected from the first lines (quote-aware)
    maxRows?: number      // rows kept in memory; the rest are counted. Default 200000
  }
  xlsx?: {
    showHiddenSheets?: boolean // render sheets Excel marks hidden / very hidden. Default false
    maxRows?: number           // rows parsed per sheet; the rest are counted. Default 200000
  }
  html?: {
    sanitize?: boolean         // DOMPurify before display (the iframe is sandboxed regardless). Default true
    height?: string            // iframe height. Default '80vh'
  }
}
```

| Option | Default | When to change it |
|---|---|---|
| `pdf.scale` | `1.5` | Raise (e.g. `2`–`3`) for sharper text/zoom; lower to save memory on huge docs. |
| `pdf.textLayer` | `true` | Set `false` for a pure-canvas, image-only render (slightly faster, not selectable). |
| `pdf.workerSrc` | auto | Set if your bundler can't resolve the worker — see [the worker section](#the-pdfjs-worker-bundler-setup). |
| `pdf.workerFallbackCdn` | `false` | `true` to fall back to jsDelivr (same pdf.js version) when the bundled worker can't load. |
| `pdf.assetsUrl` | derived | Point at a hosted copy of `pdfjs-dist` when CJK text renders as boxes or JPEG‑2000 images are missing. |
| `pdf.password` | — | Static password, or a callback that's asked again with `'incorrect'` after a wrong attempt. |
| `pdf.annotations` | `true` | Set `false` to skip the link layer (URLs and internal jumps). |
| `pdf.maxRenderedPages` | `12` | Lower on memory-constrained devices; pages beyond the cap are re-rendered when scrolled back. |
| `pptx.width` / `pptx.height` | container / 16:9 | Force an exact slide size. |
| `docx.ignoreLastRenderedPageBreak` | `true` | Set `false` for documents saved by MS Word to get pagination that matches Word's. |
| `docx.renderComments` / `docx.renderChanges` | `false` | Show review comments / tracked changes. |
| `csv.maxRows` / `xlsx.maxRows` | `200000` | Lower for memory-constrained devices. When the cap cuts data, `meta.truncated = { rows, total }` is set, a notice is shown and a `csv/truncated` / `xlsx/truncated` warning is emitted. |

```tsx
<DocViewer source={file} pdf={{ scale: 2, textLayer: true }} />
<DocViewer source={deck} pptx={{ width: 1280, height: 720 }} />
<DocViewer source={doc} docx={{ renderComments: true, ignoreLastRenderedPageBreak: false }} />
```

You can also set the pdf.js worker globally, once, before rendering any PDF:

```ts
import { setPdfWorkerSrc } from 'omni-doc-viewer'
setPdfWorkerSrc('/pdf.worker.min.mjs')
```

---

## Cancellation & timeouts

`renderDocument` accepts a standard [`AbortSignal`](https://developer.mozilla.org/docs/Web/API/AbortSignal). Aborting rejects the promise with a `DOMException` whose `name` is `'AbortError'`.

**Cancel manually** (e.g. the user navigated away):

```ts
const controller = new AbortController()

renderDocument({ container, source, signal: controller.signal })
  .catch((err) => {
    if (err.name === 'AbortError') return // expected — ignore
    throw err
  })

// somewhere else:
controller.abort()
```

**Add a timeout** — there's no `timeout` option; compose one from a signal. Modern environments have `AbortSignal.timeout`:

```ts
await renderDocument({ container, source, signal: AbortSignal.timeout(10_000) })
```

Or combine a manual abort with a timeout:

```ts
const controller = new AbortController()
const t = setTimeout(() => controller.abort(), 10_000)
try {
  const view = await renderDocument({ container, source, signal: controller.signal })
} finally {
  clearTimeout(t)
}
```

> `<DocViewer />` manages cancellation **automatically** — it aborts the previous render whenever `source` changes and on unmount.

---

## Error handling

`renderDocument` **rejects** *and* calls `onError`. `<DocViewer />` calls `onError` and shows `errorFallback`.

```ts
import { UnsupportedFormatError, FormatDetectionError, RenderError } from 'omni-doc-viewer'

try {
  await renderDocument({ container, source })
} catch (err) {
  if (err instanceof UnsupportedFormatError) {
    // legacy .doc/.ppt — inspect err.detectedFormat ('doc' | 'ppt' | undefined)
  } else if (err instanceof FormatDetectionError) {
    // couldn't determine the format — ask the user, or pass `type`
  } else if (err instanceof RenderError) {
    // a known engine failure — branch on err.code, log err.details
  } else if (err.name === 'AbortError') {
    // render was cancelled — usually safe to ignore
  } else {
    // fetch failure, corrupt file, engine error, …
  }
}
```

| Error | Thrown when | How to recover |
|---|---|---|
| `UnsupportedFormatError` | Legacy binary `.doc` / `.ppt`. | Convert to OOXML/PDF server-side, or tell the user. |
| `FormatDetectionError` | Format can't be determined from bytes/extension. | Pass an explicit `type`, or surface a message. |
| `RenderError` | An engine failed for a known reason. `code` is stable, `format` names the renderer, `details` holds structured context. | Branch on `code`; include `details` in bug reports. |

`RenderError` codes:

| Code | Format | Meaning | `details` |
|---|---|---|---|
| `PPTX_NO_SLIDES` | pptx | The deck declares slides but the engine could read none of them, even after repair. | `{ inspection }` — see [Troubleshooting](#powerpoint-shows-0-slides--renders-nothing) |
| `PPTX_ENGINE_ERROR` | pptx | The engine threw while rendering. | `{ inspection, cause }` |
| `PDF_PASSWORD_REQUIRED` | pdf | The PDF is encrypted and no (correct) password was supplied, or the password callback returned `null`. | `{ reason: 'need' \| 'incorrect' \| 'cancelled' }` |
| `PDF_INVALID` | pdf | pdf.js could not parse the file (corrupt / not a PDF). | `{ cause }` |
| `DOMException` (`name: 'AbortError'`) | The render was cancelled via `signal`. | Ignore. |
| `Error` (generic) | Network/`fetch` failure, corrupt file, or engine error. | Retry / show the message. |

### Warnings & diagnostics

Renderers sometimes have to work around a broken file or a missing browser feature and keep going. Those are reported through `onWarning` rather than thrown, so you can log them, show a notice, or attach them to a bug report:

```ts
interface RenderWarning {
  code: string        // stable identifier, e.g. 'pptx/removed-phantom-overrides'
  format?: DocType    // which renderer raised it
  message: string     // human-readable explanation
  details?: unknown   // structured context
}

renderDocument({ container, source, onWarning: (w) => console.warn(w.code, w.message, w.details) })
```

Warning codes currently emitted:

| Code | Meaning |
|---|---|
| `pptx/removed-phantom-overrides` | `[Content_Types].xml` listed parts that aren't in the file (pptxgenjs does this); the entries were dropped so the engine doesn't abort. |
| `pptx/added-overrides` | Slides/layouts/masters/themes were only covered by `<Default>` entries; explicit overrides were added so the engine can find them. |
| `pptx/normalized-content-types` | The content-types root was namespace-prefixed (`<ct:Types>`); normalized. |
| `pptx/stripped-bom` | A UTF-8 BOM preceded `[Content_Types].xml`; removed. |
| `pptx/injected-slide-size` | `presentation.xml` had no slide size; 16:9 assumed. |
| `pptx/slide-order-unknown` | Rendered slides couldn't be mapped to `p:sldIdLst`; shown in engine (file-name) order. |
| `pptx/empty-deck` | The presentation genuinely has no slides. |
| `pdf/worker-fallback-cdn` | The bundled worker couldn't be loaded; the CDN copy of the same version is used. |
| `pdf/fake-worker` | No worker could be loaded; pdf.js runs on the main thread (slow). Set `pdf.workerSrc` or enable `pdf.workerFallbackCdn`. |
| `csv/truncated` | The row cap (`csv.maxRows`) cut the data; `details = { rows, total }`. |
| `xlsx/truncated` | A sheet exceeded `xlsx.maxRows`; `details = { sheet, rows, total }`. |
| `html/unsanitized` | DOMPurify couldn't run (no DOM); only the iframe sandbox protects the page. |

In React:

```tsx
<DocViewer
  source={file}
  errorFallback={(err) =>
    err instanceof UnsupportedFormatError
      ? <p>Legacy Office files aren't supported — please upload a .docx/.pptx or PDF.</p>
      : <p>Couldn't display this document: {err.message}</p>
  }
/>
```

---

## The pdf.js worker (bundler setup)

PDF rendering uses a pdf.js Web Worker. The library resolves it through a chain and tells you (via `onWarning`) if it had to deviate:

1. **Explicit** — `pdf.workerSrc` / `setPdfWorkerSrc()`: used as-is.
2. **Bundled** — `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`, which **Vite, webpack 5, Next.js and Parcel handle automatically**. The URL is verified with a quick request first, so a 404 or an SPA `index.html` fallback (the classic "Setting up fake worker failed" cause) is caught instead of crashing.
3. **CDN** (opt-in, `pdf.workerFallbackCdn: true`) — the *same* pdf.js version from jsDelivr. Warning `pdf/worker-fallback-cdn`.
4. **Last resort** — pdf.js tries to run on the main thread. Warning `pdf/fake-worker`.

`pdfjs-dist` is pinned to an exact version, so the API and worker can never mismatch when both come from this package. If your app *also* depends on `pdfjs-dist` (e.g. via react-pdf), make sure it resolves to one copy.

You usually don't need to do anything. If your bundler can't resolve the worker, point at a copy you host yourself:

```ts
// Option A — globally, once, before any PDF renders:
import { setPdfWorkerSrc } from 'omni-doc-viewer'
setPdfWorkerSrc('/pdf.worker.min.mjs')

// Option B — per render:
renderDocument({ container, source, pdf: { workerSrc: '/pdf.worker.min.mjs' } })
```

```tsx
// Option C — per <DocViewer />:
<DocViewer source={file} pdf={{ workerSrc: '/pdf.worker.min.mjs' }} />
```

Copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` into your `public/`/static dir (or serve it from a CDN) and reference that path.

### Fonts, CJK text and JPEG‑2000 (`assetsUrl`)

pdf.js loads CMaps (for CJK and other non-Latin PDFs), standard fonts and wasm decoders (JPX/ICC) on demand from folders next to its worker. Bundlers only emit the worker file, so those folders aren't reachable in a production build and such PDFs render with fallback glyphs or missing images. Fix it by hosting the `pdfjs-dist` package folder and pointing at it:

```ts
// copy node_modules/pdfjs-dist/{build,cmaps,standard_fonts,wasm,iccs} → public/pdfjs/
<DocViewer source={file} pdf={{ workerSrc: '/pdfjs/build/pdf.worker.min.mjs' }} />
// assetsUrl is derived from a workerSrc that ends in build/pdf.worker*.mjs; set it explicitly otherwise:
<DocViewer source={file} pdf={{ assetsUrl: '/pdfjs/' }} />
```

With `workerFallbackCdn: true` the CDN copy provides these folders automatically.

### Password-protected PDFs

`<DocViewer />` **asks the user** with an inline password form (retrying on a wrong password, cancel → error state) whenever an encrypted PDF is opened and you didn't supply `pdf.password`. Strings are translatable through `labels` (`passwordTitle`, `passwordIncorrect`, `passwordPlaceholder`, `passwordSubmit`, `passwordCancel`). To handle it yourself:

```tsx
// Static:
<DocViewer source={file} pdf={{ password: 'secret' }} />

// Interactive — asked again with 'incorrect' after a wrong attempt; return null to cancel:
<DocViewer
  source={file}
  pdf={{ password: async (reason) => window.prompt(reason === 'incorrect' ? 'Wrong password, try again' : 'Password') }}
  errorFallback={(err) => (err instanceof RenderError && err.code === 'PDF_PASSWORD_REQUIRED' ? <p>Password required.</p> : <p>{err.message}</p>)}
/>
```

Without a password (or after cancelling) the render rejects with `RenderError` code `PDF_PASSWORD_REQUIRED` — no browser prompt loops. The core `renderDocument`/`createViewer` don't include UI: pass `pdf.password` (string or callback) there.

---

## Framework integration

The core is framework-agnostic: give it a DOM element and a source.

```ts
// Vanilla — plain render
const view = await renderDocument({ container: el, source })

// Vanilla — full viewer (navigation, zoom, rotation, keyboard, download/print)
const viewer = createViewer({ host: el, pagination: true })
await viewer.load(source)

// Vue 3 (in onMounted, with a template ref)
onMounted(async () => { viewer = createViewer({ host: elRef.value }); await viewer.load(source) })
onUnmounted(() => viewer?.destroy())

// Svelte (in onMount)
onMount(() => { const v = createViewer({ host: el }); v.load(source); return () => v.destroy() })
```

For React, prefer the wrapper:

```tsx
import { DocViewer } from 'omni-doc-viewer/react'
```

### Next.js / SSR

`<DocViewer />` is SSR-safe (rendering is deferred to a client effect). In the App Router, use it in a Client Component. If your bundler/runtime hits an SSR edge, load it client-only:

```tsx
'use client'
import dynamic from 'next/dynamic'

const DocViewer = dynamic(
  () => import('omni-doc-viewer/react').then((m) => m.DocViewer),
  { ssr: false },
)
```

---

## Bundle size & lazy loading

The package is built around **dynamic imports**, so you only pay for the formats you actually render:

- The core entry (`renderDocument` + detection) is tiny.
- Each engine — pdf.js, docx-preview, SheetJS (`@e965/xlsx`), pptx-preview — is imported **the first time that format is rendered**. Show only PDFs, and SheetJS/PowerPoint code never reaches the user.
- The heaviest extras load **on demand, conditionally**:
  - `emf-converter` — only when a PPTX actually contains an EMF/WMF metafile.
  - `marked` + `dompurify` — only when a Markdown file is opened.
  - `jszip` — only for PPTX media extraction.

`"sideEffects": false` lets bundlers tree-shake unused exports.

---

## Security

- **Everything is client-side.** Files are never uploaded; nothing leaves the browser.
- **Markdown and HTML are sanitized.** Untrusted Markdown can contain raw HTML; the generated HTML is run through **DOMPurify** before it touches the DOM, stripping `<script>`, inline event handlers (`onerror`, …), `javascript:`/`vbscript:` URLs and `<iframe>`s. HTML files are sanitized the same way **and** displayed inside an `<iframe sandbox>` with every permission off, so nothing in them can run, navigate, or reach your page.
- **No `eval`, no remote code.** Rendering engines parse bytes; they don't execute document scripts.
- **Undecodable/missing images fail closed** — e.g. a PPTX metafile that can't be rasterized is hidden rather than rendered as a broken element.
- **Runtime dependencies are kept advisory-free.** CI fails on any High/Critical advisory in the production dependency tree (`pnpm audit --prod`). Spreadsheets use SheetJS CE 0.20.x via `@e965/xlsx` (an unmodified republish of the official release, which is no longer pushed to npm) — it contains the prototype-pollution and ReDoS fixes that the npm `xlsx@0.18.5` package lacks.

---

## Accessibility

- **PDF text layer** (on by default) makes PDFs **selectable, searchable, and readable by screen readers** — not just an image of a page.
- Each PDF page is a labelled region (`role="region"`, `aria-label="Page N"`).
- Toolbar controls have `aria-label`s and are keyboard-operable; the viewport is focusable and responds to arrow/Page/Home/End keys.
- The error state uses `role="alert"`.

---

## Browser support

Targets modern evergreen browsers — **Chrome / Edge 125+, Firefox 128+ (ESR), Safari 18+** (and Chromium-based mobile browsers). The floor is set by pdf.js 6; for older browsers set `pdf: { legacy: true }` to load the `pdfjs-dist/legacy` build. It relies on widely-available web platform features:

- ES2020, dynamic `import()`, `fetch`, `<canvas>`, `Blob`/`URL.createObjectURL`.
- `IntersectionObserver` and `ResizeObserver` power virtualization and the text layer; if absent, the library **degrades gracefully** (e.g. PDFs render eagerly).
- The toolbar uses CSS **container queries** with a `@media` fallback for older engines.

There is no IE11 support.

---

## TypeScript

Types ship with the package — no `@types/*` needed.

```ts
import type {
  DocType,        // 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'text' | 'markdown' | 'csv' | 'video' | 'audio' | 'html' | 'json' | 'code'
  AnyDocType,     // DocType | string (custom renderers)
  DocSource,      // string | File | Blob | ArrayBuffer | Uint8Array
  RenderOptions,
  RenderResult,
  RenderMeta,
  RenderTuning,
  RenderWarning,
  DocxTuning,
  FetchOptions,
  Base64Source,
  PdfTuning,
  PdfPasswordProvider,
  Renderer, RendererInput, RendererRegistration,
} from 'omni-doc-viewer'

import type { DocViewerProps, ViewerHandle, ViewerState, ViewMode } from 'omni-doc-viewer/react'
import type { ViewerController, ViewerOptions } from 'omni-doc-viewer'
```

---

## Comparison

| | omni-doc-viewer | Office Online iframe | Per-format libraries |
|---|---|---|---|
| Works offline / on local files | ✅ | ❌ (needs internet + public URL) | ➖ varies |
| One API for all formats | ✅ | ➖ | ❌ wire each yourself |
| No server / no API keys | ✅ | ❌ | ✅ |
| Selectable PDF text | ✅ | ✅ | ➖ |
| Large-doc virtualization | ✅ | ✅ | ❌ usually |
| EMF/WMF + placeholder images in PPTX | ✅ | ✅ | ❌ usually |
| Lazy per-format loading | ✅ | n/a | ➖ |

---

## Troubleshooting

### "Setting up fake worker failed" / PDF never renders

The pdf.js worker URL didn't serve JavaScript (usually a 404, or an SPA route that returns `index.html`). Check `onWarning` for `pdf/fake-worker` — its `details.reason` says what was wrong. Fixes, in order of preference: let your bundler emit the worker (Vite/webpack 5/Next.js do), host it yourself and set `pdf.workerSrc`, or enable `pdf.workerFallbackCdn`. See [The pdf.js worker](#the-pdfjs-worker-bundler-setup).

### "The API version … does not match the Worker version"

Two copies of `pdfjs-dist` are in play (yours and this package's). Dedupe them in your lockfile, or set `pdf.workerSrc` to the worker of the copy this package resolves.

### CJK text renders as boxes / JPEG‑2000 images are blank

pdf.js needs its `cmaps/`, `standard_fonts/` and `wasm/` folders — see [Fonts, CJK text and JPEG‑2000](#fonts-cjk-text-and-jpeg2000-assetsurl).

### PowerPoint shows 0 slides / renders nothing

`pptx-preview` (the PPTX engine) only discovers parts through `<Override>` entries in `[Content_Types].xml`, and gives up silently on the first part it can't load. omni-doc-viewer inspects and repairs the package before handing it over (see the `pptx/*` [warning codes](#warnings--diagnostics)), renders slides in the presentation's own order, and hides hidden slides. If the engine still can't read any slide you get a `RenderError` with `code: 'PPTX_NO_SLIDES'` instead of an empty view.

To diagnose a deck — or to attach the facts to a bug report without sharing the file — run the inspector:

```ts
import { inspectPptx } from 'omni-doc-viewer'

const info = await inspectPptx(await file.arrayBuffer())
console.log(info)
// {
//   producer: 'Microsoft Office PowerPoint',
//   slideSize: { cx: 12192000, cy: 6858000 },
//   slideParts: ['ppt/slides/slide1.xml', …],   // declared via Overrides
//   slideOrder: ['ppt/slides/slide1.xml', …],   // p:sldIdLst order
//   hiddenSlides: [], missingParts: [], unresolvedLayouts: [], missingRels: [],
//   nonStandardNames: [], prefixedRoot: false, overrideCount: 12,
//   problems: []   // e.g. ['missing-parts', 'missing-overrides', 'prefixed-root', …]
// }
```

`problems` names every structure known to trip the engine. If it's empty and the deck still fails, please open an issue with the `inspection` object from the error's `details` and the producer app — we add repairs for new producers as they show up.

## FAQ

**Does it upload my files anywhere?**
No. Everything runs in the browser; bytes never leave the page.

**Can it render a PDF from a `Uint8Array` / decrypted buffer?**
Yes — pass the bytes as `source`. Add `type: 'pdf'` if there's no filename.

**My file is behind authentication / a signed S3 URL.**
Pass `fetchOptions` (headers, credentials) — see [Authenticated URLs](#authenticated-urls-fetchoptions). If you already have the bytes (e.g. from your own `fetch`), pass the `Response`, `Blob`, or a `{ base64 }` object instead.

**Why is my PDF text not selectable?**
Make sure `pdf.textLayer` isn't set to `false`. Note that scanned/image-only PDFs have no text to select.

**Which pdf.js version is used?**
An exact-pinned `pdfjs-dist` 6.x. Security fixes in pdf.js are picked up promptly; check the [changelog](./CHANGELOG.md).

**Can I print or download from code?**
The pagination toolbar has built-in download & print buttons. For programmatic download, you already hold the `source` — use a normal anchor/`URL.createObjectURL`.

**It says "renders in the browser only" on my server.**
That's expected during SSR — defer rendering to the client (see [Next.js / SSR](#nextjs--ssr)).

**How big is it?**
The core is small; engines load on demand. You only ship the formats you actually render — see [Bundle size & lazy loading](#bundle-size--lazy-loading).

---

## Contributing

Contributions are welcome! This is a pnpm monorepo (library + Vite demo).

```bash
pnpm install
pnpm dev:demo       # Vite playground — drag-drop any format, works offline
pnpm build          # ESM + CJS + .d.ts for "." and "./react"
pnpm test           # vitest: unit (node) + dom (happy-dom) projects
pnpm test:browser   # real engines in headless Chromium (needs: pnpm exec playwright install chromium)
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm verify         # lint + typecheck + test (run before a PR)
pnpm samples        # regenerate the demo sample documents
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for a step-by-step guide (fork → branch → fix → test → PR).

- Commits follow **[Conventional Commits](https://www.conventionalcommits.org/)** (enforced by commitlint): `feat:`, `fix:`, `docs:`, `chore:`, …
- Run `pnpm verify` before opening a pull request.
- Found a bug or have a feature request? [Open an issue](https://github.com/akbhuker/omni-doc-viewer/issues).

---

## License

[MIT](./LICENSE) © akbhuker.

The bundled rendering engines keep their own licenses — see [`NOTICE`](./NOTICE).
