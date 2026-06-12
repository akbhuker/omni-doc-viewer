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
- [Core API (framework-agnostic)](#core-api-framework-agnostic)
  - [`renderDocument(options)`](#renderdocumentoptions)
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

- **8 formats, one component** — PDF, Word (`.docx`), Excel (`.xlsx`/`.xls`), PowerPoint (`.pptx`), images, Markdown, CSV/TSV, and plain text.
- **100% client-side** — no server, no Office iframe, no public URL, no API keys. Works offline.
- **Automatic format detection** — by file extension *and* by magic bytes, so it works even with no filename.
- **Selectable, searchable PDFs** — a real text layer means copy/paste, browser <kbd>Ctrl</kbd>+<kbd>F</kbd>, and screen readers all work.
- **Virtualized rendering** — large PDFs only rasterize the pages near the viewport, so a 500-page file stays fast and memory-light.
- **Opt-in page navigation** — a polished, responsive toolbar: prev/next, jump-to-page, zoom, fit-width, download, print, and a paged ⇄ continuous toggle.
- **Real images in PowerPoint** — EMF/WMF metafiles are rasterized to PNG, and layout-inherited picture placeholders are positioned correctly (cases most viewers drop).
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
| **Excel** | `.xlsx`, `.xls` | [SheetJS](https://github.com/SheetJS/sheetjs) | HTML table + sheet tabs |
| **PowerPoint** | `.pptx` | [pptx-preview](https://www.npmjs.com/package/pptx-preview) + [emf-converter](https://www.npmjs.com/package/emf-converter) | HTML/CSS slides (EMF/WMF rasterized) |
| **Image** | `.png` `.jpg` `.jpeg` `.gif` `.webp` `.svg` `.bmp` `.avif` `.ico` | native | `<img>` |
| **Markdown** | `.md` `.markdown` `.mdown` `.mkd` | [marked](https://github.com/markedjs/marked) + [DOMPurify](https://github.com/cure53/DOMPurify) | sanitized HTML |
| **CSV / TSV** | `.csv` `.tsv` | built-in (RFC 4180) | HTML table with sticky header |
| **Text** | `.txt` `.log`, or any UTF-8 text | built-in | `<pre>` (wrapped) |

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
type DocSource = string | File | Blob | ArrayBuffer | Uint8Array
```

| Source | How it's handled | Filename used for detection? |
|---|---|---|
| `string` (URL) | `fetch`ed (supports `http(s):` and `blob:`) | yes — from the URL path |
| `File` | read via `arrayBuffer()` | yes — `file.name` |
| `Blob` | read via `arrayBuffer()` | no — falls back to magic bytes |
| `ArrayBuffer` / `Uint8Array` | used directly | no — falls back to magic bytes |

```ts
// From a URL
renderDocument({ container, source: 'https://example.com/a.pdf' })

// From an <input type="file"> or drag-and-drop
renderDocument({ container, source: event.target.files[0] })

// From bytes you already have (e.g. a decrypted buffer)
renderDocument({ container, source: myUint8Array, type: 'pdf' })
```

> When the source has no filename/extension (a `Blob`, `ArrayBuffer`, or an extensionless URL), detection falls back to magic-byte sniffing. If you already know the format, pass `type` to skip detection entirely.

---

## React component (DocViewer)

```tsx
import { DocViewer, type DocViewerProps, type ViewMode } from 'omni-doc-viewer/react'
```

### Props

`DocViewerProps` extends the per-format tuning options (`pdf`, `pptx` — see [Configuration](#configuration--per-format-tuning)).

| Prop | Type | Default | Description |
|---|---|---|---|
| `source` | `DocSource` | **required** | URL string, `File`, `Blob`, `ArrayBuffer` or `Uint8Array`. |
| `type` | `DocType` | auto | Force a format and skip auto-detection. |
| `pagination` | `boolean` | `false` | Enable the page-navigation toolbar inside a scrollable viewport. |
| `initialViewMode` | `'paged' \| 'continuous'` | `'paged'` | Layout when `pagination` is on: one page at a time, or a scrolling stack. |
| `height` | `number \| string` | `'80vh'` | Viewport height when `pagination` is on. Number = px. |
| `toolbar` | `boolean` | = `pagination` | Show the toolbar. Set `false` to keep navigation logic but hide the chrome. |
| `loading` | `ReactNode` | spinner text | Shown while the engine + document load. |
| `errorFallback` | `(error: Error) => ReactNode` | message | Render prop for the error state. |
| `onLoad` | `(meta: RenderMeta) => void` | — | Fired once the document has rendered. |
| `onError` | `(error: Error) => void` | — | Fired if rendering fails. |
| `onPageChange` | `(page: number, total: number) => void` | — | Fired when the current page changes (1-based). |
| `pdf` | `{ scale?, workerSrc?, textLayer? }` | — | PDF tuning ([details](#configuration--per-format-tuning)). |
| `pptx` | `{ width?, height? }` | — | PowerPoint slide size. |
| `className` | `string` | — | Applied to the root element. |
| `style` | `CSSProperties` | — | Applied to the root element. |

### Page navigation (pagination)

Set `pagination` to turn the plain viewer into a full reading experience. The toolbar gives you:

- **Prev / next** and a **page number input** you can type into (`n / total`) to jump.
- **Zoom** (−, %, +), **fit-width**, **download** (original bytes), and **print**.
- A **paged ⇄ continuous** toggle (one page at a time, or a vertical scroll of all pages).
- **Keyboard navigation:** <kbd>←</kbd>/<kbd>→</kbd>, <kbd>PageUp</kbd>/<kbd>PageDown</kbd>, <kbd>Home</kbd>/<kbd>End</kbd>.
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

> Pagination is meaningful for paged formats (PDF, PPTX, DOCX). Spreadsheets navigate by their own **sheet tabs**; single images/text render as one page.

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
| `onError` | `(error: Error) => void` | Called on failure; the promise also rejects. |
| `pdf` | `{ scale?, workerSrc?, textLayer? }` | PDF tuning. |
| `pptx` | `{ width?, height? }` | Slide size. |

```ts
const view = await renderDocument({
  container: document.getElementById('viewer')!,
  source: file,
  pdf: { scale: 2 },
})
```

> `renderDocument` runs **in the browser only**. On the server it throws a clear error — defer to the client (see [Next.js / SSR](#nextjs--ssr)).

### `RenderResult`

```ts
interface RenderResult {
  type: DocType
  meta: RenderMeta            // { type, pageCount? }
  pages?: HTMLElement[]       // page/slide/section elements, in order
  destroy(): void             // free listeners, engine resources, clear container
}
```

Always call `destroy()` when you're done (the React wrapper does this for you):

```ts
const view = await renderDocument({ container, source })
// …
view.destroy()
```

### Format detection

Detection runs in priority order: **explicit override → filename/URL extension → magic bytes**.

```ts
// Full resolver (throws on unsupported/undetectable):
detect({ bytes, filename?, override? }): DocType

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

### `normalizeSource(source)`

Turn any `DocSource` into raw bytes (+ a filename hint when available). Useful if you want to inspect or detect before rendering.

```ts
const { bytes, filename } = await normalizeSource(source, signal?)
const type = detect({ bytes, filename })
```

---

## Configuration & per-format tuning

Pass `pdf` and/or `pptx` to either `renderDocument` or `<DocViewer />`.

```ts
interface RenderTuning {
  pdf?: {
    scale?: number       // canvas render scale. Default 1.5 (crisp on most displays)
    workerSrc?: string   // explicit pdf.js worker URL (see worker section)
    textLayer?: boolean  // selectable/searchable text overlay. Default true
  }
  pptx?: {
    width?: number       // slide width in px. Default: container width (or 960)
    height?: number      // slide height in px. Default: width * 9/16
  }
}
```

| Option | Default | When to change it |
|---|---|---|
| `pdf.scale` | `1.5` | Raise (e.g. `2`–`3`) for sharper text/zoom; lower to save memory on huge docs. |
| `pdf.textLayer` | `true` | Set `false` for a pure-canvas, image-only render (slightly faster, not selectable). |
| `pdf.workerSrc` | auto | Set if your bundler can't resolve the worker — see below. |
| `pptx.width` / `pptx.height` | container / 16:9 | Force an exact slide size. |

```tsx
<DocViewer source={file} pdf={{ scale: 2, textLayer: true }} />
<DocViewer source={deck} pptx={{ width: 1280, height: 720 }} />
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
import { UnsupportedFormatError, FormatDetectionError } from 'omni-doc-viewer'

try {
  await renderDocument({ container, source })
} catch (err) {
  if (err instanceof UnsupportedFormatError) {
    // legacy .doc/.ppt — inspect err.detectedFormat ('doc' | 'ppt' | undefined)
  } else if (err instanceof FormatDetectionError) {
    // couldn't determine the format — ask the user, or pass `type`
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
| `DOMException` (`name: 'AbortError'`) | The render was cancelled via `signal`. | Ignore. |
| `Error` (generic) | Network/`fetch` failure, corrupt file, or engine error. | Retry / show the message. |

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

PDF rendering uses a pdf.js Web Worker. By default the library resolves the worker bundled with `pdfjs-dist` via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` — which **modern bundlers (Vite, webpack 5, Next.js, Parcel) handle automatically**. You usually don't need to do anything.

If your bundler can't resolve it, point at a copy you host yourself:

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

---

## Framework integration

The core is framework-agnostic: give it a DOM element and a source.

```ts
// Vanilla
const view = await renderDocument({ container: el, source })

// Vue 3 (in onMounted, with a template ref)
onMounted(async () => { view = await renderDocument({ container: elRef.value, source }) })
onUnmounted(() => view?.destroy())

// Svelte (in onMount)
onMount(async () => { view = await renderDocument({ container: el, source }); return () => view.destroy() })
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
- Each engine — pdf.js, docx-preview, SheetJS, pptx-preview — is imported **the first time that format is rendered**. Show only PDFs, and SheetJS/PowerPoint code never reaches the user.
- The heaviest extras load **on demand, conditionally**:
  - `emf-converter` — only when a PPTX actually contains an EMF/WMF metafile.
  - `marked` + `dompurify` — only when a Markdown file is opened.
  - `jszip` — only for PPTX media extraction.

`"sideEffects": false` lets bundlers tree-shake unused exports.

---

## Security

- **Everything is client-side.** Files are never uploaded; nothing leaves the browser.
- **Markdown is sanitized.** Untrusted Markdown can contain raw HTML; the generated HTML is run through **DOMPurify** before it touches the DOM, stripping `<script>`, inline event handlers (`onerror`, …), `javascript:`/`vbscript:` URLs and `<iframe>`s.
- **No `eval`, no remote code.** Rendering engines parse bytes; they don't execute document scripts.
- **Undecodable/missing images fail closed** — e.g. a PPTX metafile that can't be rasterized is hidden rather than rendered as a broken element.

---

## Accessibility

- **PDF text layer** (on by default) makes PDFs **selectable, searchable, and readable by screen readers** — not just an image of a page.
- Each PDF page is a labelled region (`role="region"`, `aria-label="Page N"`).
- Toolbar controls have `aria-label`s and are keyboard-operable; the viewport is focusable and responds to arrow/Page/Home/End keys.
- The error state uses `role="alert"`.

---

## Browser support

Targets modern evergreen browsers — **Chrome / Edge, Firefox, Safari** (and Chromium-based mobile browsers). It relies on widely-available web platform features:

- ES2020, dynamic `import()`, `fetch`, `<canvas>`, `Blob`/`URL.createObjectURL`.
- `IntersectionObserver` and `ResizeObserver` power virtualization and the text layer; if absent, the library **degrades gracefully** (e.g. PDFs render eagerly).
- The toolbar uses CSS **container queries** with a `@media` fallback for older engines.

There is no IE11 support.

---

## TypeScript

Types ship with the package — no `@types/*` needed.

```ts
import type {
  DocType,        // 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'image' | 'text' | 'markdown' | 'csv'
  DocSource,      // string | File | Blob | ArrayBuffer | Uint8Array
  RenderOptions,
  RenderResult,
  RenderMeta,
  RenderTuning,
} from 'omni-doc-viewer'

import type { DocViewerProps, ViewMode } from 'omni-doc-viewer/react'
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

## FAQ

**Does it upload my files anywhere?**
No. Everything runs in the browser; bytes never leave the page.

**Can it render a PDF from a `Uint8Array` / decrypted buffer?**
Yes — pass the bytes as `source`. Add `type: 'pdf'` if there's no filename.

**Why is my PDF text not selectable?**
Make sure `pdf.textLayer` isn't set to `false`. Note that scanned/image-only PDFs have no text to select.

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
pnpm test           # vitest
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm verify         # lint + typecheck + test (run before a PR)
pnpm samples        # regenerate the demo sample documents
```

- Commits follow **[Conventional Commits](https://www.conventionalcommits.org/)** (enforced by commitlint): `feat:`, `fix:`, `docs:`, `chore:`, …
- Run `pnpm verify` before opening a pull request.
- Found a bug or have a feature request? [Open an issue](https://github.com/akbhuker/omni-doc-viewer/issues).

---

## License

[MIT](./LICENSE) © akbhuker.

The bundled rendering engines keep their own licenses — see [`NOTICE`](./NOTICE).
