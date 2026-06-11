# omni-doc-viewer

[![npm version](https://img.shields.io/npm/v/omni-doc-viewer.svg)](https://www.npmjs.com/package/omni-doc-viewer)
[![unpacked size](https://img.shields.io/npm/unpacked-size/omni-doc-viewer)](https://www.npmjs.com/package/omni-doc-viewer)
[![types included](https://img.shields.io/npm/types/omni-doc-viewer.svg)](https://www.npmjs.com/package/omni-doc-viewer)
[![license: MIT](https://img.shields.io/npm/l/omni-doc-viewer.svg)](./LICENSE)

<!-- Re-add once the package has download traffic (shows "too new" until then):
[![npm downloads](https://img.shields.io/npm/dm/omni-doc-viewer.svg)](https://www.npmjs.com/package/omni-doc-viewer)
-->


**One `<DocViewer>` for PDF, Word, Excel & PowerPoint. 100% client-side — no server, no Microsoft iframe, no public-URL requirement, no API keys.**

**[▶ Live demo](https://akbhuker.github.io/omni-doc-viewer/)** — drop a file, or try a sample. Works offline.

Most "free" document viewers force a bad tradeoff: they either embed Microsoft's
Office Online viewer in an iframe (needs the internet **and** a public file URL —
useless for private/local/offline files), or they're paid commercial SDKs, or
they're four separate single-format libraries you have to find, wire, and
maintain yourself.

`omni-doc-viewer` wraps four proven, permissively-licensed engines behind **one
API** with **automatic format detection** and **per-format lazy loading**. It
runs entirely in the browser — works offline, no backend, no keys.

```bash
npm install omni-doc-viewer
# pnpm add omni-doc-viewer · yarn add omni-doc-viewer
```

> Framework-agnostic core + an optional React wrapper. `react` is an **optional**
> peer dependency — you only need it if you import `omni-doc-viewer/react`.

---

## Quick start (React)

```tsx
import { DocViewer } from 'omni-doc-viewer/react'

export default function Preview({ file }: { file: File | string }) {
  return (
    <DocViewer
      source={file}                  // URL | File | Blob | ArrayBuffer | Uint8Array
      onLoad={(meta) => console.log('rendered', meta)}
      onError={(err) => console.error(err)}
      style={{ height: 600 }}
    />
  )
}
```

## Quick start (no framework)

```ts
import { renderDocument } from 'omni-doc-viewer'

const view = await renderDocument({
  container: document.getElementById('viewer')!,
  source: fileOrUrlOrBuffer,
  // type: 'pdf',           // optional — skip auto-detection
  onError: (e) => console.error(e),
})

console.log(view.type, view.meta)  // e.g. 'pdf' { type: 'pdf', pageCount: 12 }
view.destroy()                     // cleanup when you're done
```

Works with Vue, Svelte, Angular, or vanilla JS — give it an element and a source.

---

## Supported formats

| Format | Extensions | Engine | Renders to |
|---|---|---|---|
| PDF | `.pdf` | [pdfjs-dist](https://github.com/mozilla/pdf.js) | `<canvas>` per page |
| Word | `.docx` | [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) | semantic HTML |
| Excel | `.xlsx`, `.xls` | [SheetJS](https://github.com/SheetJS/sheetjs) | HTML table + sheet tabs |
| PowerPoint | `.pptx` | [pptx-preview](https://www.npmjs.com/package/pptx-preview) | HTML/CSS slides |

### Out of scope (be honest — these need a server we don't have)

- **Legacy binary `.doc` / `.ppt`** (pre-2007 OLE). Only the modern zipped OOXML
  formats render client-side. Passing one throws an `UnsupportedFormatError`
  with a clear message. (`.xls` *does* work — SheetJS parses it.)
- **PPTX fidelity caveats:** `pptx-preview` reproduces text, lists, basic shapes
  and images well, but **not** animations, transitions, 3D, charts, SmartArt,
  OLE objects, or speaker notes. Treat PPTX as "readable preview", not
  pixel-perfect PowerPoint. Images include EMF/WMF metafiles (rasterized to PNG
  for the browser) and layout-inherited picture placeholders.

---

## Format detection

You don't have to tell it the type. Detection runs in priority order:

1. An explicit `type` prop/option (skips detection).
2. The **filename/URL extension**, when available.
3. **Magic bytes** — `%PDF`; the ZIP/OOXML container is inspected to tell
   `.docx` / `.xlsx` / `.pptx` apart; the OLE signature identifies legacy files.

```ts
import { detect } from 'omni-doc-viewer'
const type = detect({ bytes, filename: 'maybe.bin' }) // 'pdf' | 'docx' | 'xlsx' | 'pptx'
```

---

## Bundle size & lazy loading

Each engine is **dynamically imported on first use**, so the engine you don't
use is code-split out of your main bundle. A PDF-only app never ships SheetJS or
the PPTX engine. The engines are regular dependencies (it "just works" on
install) but your bundler splits them into separate chunks.

---

## The pdf.js worker (bundler setup)

pdf.js renders on a Web Worker. By default we resolve the worker shipped inside
`pdfjs-dist` using `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`,
which **Vite, webpack 5 and Next.js handle automatically** — no setup needed.

If your bundler can't resolve it, point it at a worker yourself:

```ts
import { setPdfWorkerSrc } from 'omni-doc-viewer'
setPdfWorkerSrc('/pdf.worker.min.mjs') // a copy you serve, or a CDN URL

// or per-render:
renderDocument({ container, source, pdf: { workerSrc: '/pdf.worker.min.mjs' } })
```

---

## Next.js / SSR

Rendering is browser-only and SSR-safe (it's deferred to an effect). In the App
Router, use it inside a Client Component (`'use client'`). If you hit a
bundler/SSR edge case, lazy-load with `ssr: false`:

```tsx
'use client'
import dynamic from 'next/dynamic'
const DocViewer = dynamic(
  () => import('omni-doc-viewer/react').then((m) => m.DocViewer),
  { ssr: false },
)
```

---

## API

### `renderDocument(options): Promise<RenderResult>`

| option | type | notes |
|---|---|---|
| `container` | `HTMLElement` | **required** — contents are replaced |
| `source` | `string \| File \| Blob \| ArrayBuffer \| Uint8Array` | **required** |
| `type` | `'pdf' \| 'docx' \| 'xlsx' \| 'pptx'` | optional override |
| `signal` | `AbortSignal` | cancel an in-flight render |
| `onError` | `(err: Error) => void` | also rejects the promise |
| `pdf` | `{ scale?, workerSrc? }` | canvas scale (default 1.5), worker URL |
| `pptx` | `{ width?, height? }` | slide size (defaults to container width, 16:9) |

`RenderResult` = `{ type, meta: { type, pageCount? }, pages?: HTMLElement[], destroy() }`.
`pages` is the array of page elements (PDF pages, PPTX slides, DOCX sections) the
viewer uses to drive navigation.

### `<DocViewer />` props

All `renderDocument` options (minus `container`), plus:

| prop | type | notes |
|---|---|---|
| `loading` | `ReactNode` | shown while loading |
| `errorFallback` | `(error: Error) => ReactNode` | custom error UI |
| `onLoad` | `(meta: RenderMeta) => void` | fired once rendered |
| `className` / `style` | — | applied to the root |
| `pagination` | `boolean` | **opt-in** page navigation: a toolbar with prev/next, jump-to-page, zoom, and a page-by-page ⇄ continuous toggle, inside a scrollable (vertical **and** horizontal) viewport. Default `false` |
| `initialViewMode` | `'paged' \| 'continuous'` | layout when `pagination` is on. Default `'paged'` (one page at a time) |
| `height` | `number \| string` | viewport height when `pagination` is on. Number = px. Default `'80vh'` |
| `toolbar` | `boolean` | show the toolbar. Defaults to the value of `pagination` |
| `onPageChange` | `(page: number, total: number) => void` | fired when the current page changes (1-based) |

The toolbar is fully responsive — it adapts to the **viewer's own width** (via
container queries), so it stays usable in a narrow column or on a phone.

```tsx
<DocViewer
  source={file}
  pagination                 // toolbar + page-by-page navigation
  initialViewMode="paged"    // or "continuous" for a scrolling stack
  height="80vh"
  onPageChange={(page, total) => console.log(`${page} / ${total}`)}
/>
```

---

## Development

```bash
pnpm install
pnpm build          # ESM + CJS + .d.ts for "." and "./react"
pnpm test           # vitest (format detection)
pnpm dev:demo       # Vite playground — drag-drop any format, works offline
```

## License

MIT (this package). The bundled rendering engines keep their own licenses —
see [`NOTICE`](./NOTICE).
