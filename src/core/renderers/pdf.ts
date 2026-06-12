import { type Renderer } from '../types'

let workerConfigured = false

/**
 * Override the pdf.js worker URL globally. Call once before rendering any PDF.
 * Most bundlers don't need this — we resolve the bundled worker automatically —
 * but it's the escape hatch when yours can't.
 */
export function setPdfWorkerSrc(src: string): void {
  workerConfiguredSrc = src
}

let workerConfiguredSrc: string | undefined

async function configureWorker(pdfjs: any, explicit?: string): Promise<void> {
  const src = explicit ?? workerConfiguredSrc
  if (src) {
    pdfjs.GlobalWorkerOptions.workerSrc = src
    workerConfigured = true
    return
  }
  if (workerConfigured || pdfjs.GlobalWorkerOptions.workerSrc) return
  // Resolve the worker shipped inside pdfjs-dist. Modern bundlers understand
  // the `new URL(specifier, import.meta.url)` pattern and emit the worker as
  // an asset; this avoids hardcoding a CDN and keeps things offline.
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
    workerConfigured = true
  } catch {
    // Last resort: let pdf.js attempt its own default. The README documents
    // setPdfWorkerSrc() / the `pdf.workerSrc` option for stubborn bundlers.
  }
}

export const render: Renderer = async ({ container, bytes, options, signal }) => {
  const pdfjs: any = await import('pdfjs-dist')
  await configureWorker(pdfjs, options.pdf?.workerSrc)

  const scale = options.pdf?.scale ?? 1.5

  // pdf.js may transfer/detach the underlying buffer, so hand it a copy.
  const loadingTask = pdfjs.getDocument({ data: bytes.slice() })
  const pdf = await loadingTask.promise

  const wrapper = document.createElement('div')
  wrapper.className = 'odv-pdf'
  wrapper.style.display = 'flex'
  wrapper.style.flexDirection = 'column'
  wrapper.style.alignItems = 'center'
  wrapper.style.gap = '12px'
  container.appendChild(wrapper)

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const wantText = options.pdf?.textLayer !== false
  if (wantText) injectTextLayerStyles()

  // Per-page bookkeeping. Pages are virtualized: we reserve their size up front
  // (so the scrollbar and page navigation are correct immediately) but only
  // rasterize a page — and build its text layer — when it nears the viewport,
  // freeing it again once it scrolls far away. This keeps a 500-page PDF fast
  // and memory-bounded instead of rendering every page on load.
  interface PageState {
    el: HTMLElement
    width: number
    pointWidth: number
    rendered: boolean
    rendering: boolean
    resize?: ResizeObserver
  }
  const states: PageState[] = []
  const pages: HTMLElement[] = []

  // Pass 1 — cheap: read each page's size and reserve a correctly-sized box.
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (signal?.aborted) break
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const cssWidth = Math.floor(viewport.width)

    const pageEl = document.createElement('div')
    pageEl.className = 'odv-pdf-page'
    pageEl.style.position = 'relative'
    pageEl.style.width = `${cssWidth}px`
    pageEl.style.maxWidth = '100%'
    // Reserve the page's aspect ratio so the box holds its place before render.
    pageEl.style.aspectRatio = `${viewport.width} / ${viewport.height}`
    pageEl.style.background = '#fff'
    pageEl.style.boxShadow = '0 1px 4px rgba(0,0,0,0.18)'
    pageEl.setAttribute('role', 'region')
    pageEl.setAttribute('aria-label', `Page ${pageNum}`)
    pageEl.dataset.odvPage = String(pageNum)

    wrapper.appendChild(pageEl)
    pages.push(pageEl)
    states.push({
      el: pageEl,
      width: cssWidth,
      pointWidth: viewport.width / scale,
      rendered: false,
      rendering: false,
    })
    page.cleanup()
  }

  async function renderPage(i: number): Promise<void> {
    const st = states[i]
    if (!st || st.rendered || st.rendering || signal?.aborted) return
    st.rendering = true
    try {
      const page = await pdf.getPage(i + 1)
      if (signal?.aborted) return
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.className = 'odv-pdf-canvas'
      canvas.style.display = 'block'
      canvas.style.width = '100%'
      canvas.style.height = 'auto'
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      // Clear the reserved aspect-ratio box; the canvas now defines the height.
      st.el.style.aspectRatio = ''
      st.el.appendChild(canvas)

      await page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise

      if (wantText && typeof pdfjs.TextLayer === 'function') {
        try {
          const textEl = document.createElement('div')
          textEl.className = 'textLayer'
          st.el.appendChild(textEl)
          const textLayer = new pdfjs.TextLayer({
            textContentSource: page.streamTextContent({ includeMarkedContent: true }),
            container: textEl,
            viewport,
          })
          await textLayer.render()
          // pdf.js sizes glyphs from `--scale-factor` = rendered px per PDF
          // point; keep it in sync as the page scales (responsive / mobile).
          const sync = () =>
            textEl.style.setProperty(
              '--scale-factor',
              String((st.el.clientWidth || st.width) / st.pointWidth),
            )
          sync()
          if (typeof ResizeObserver === 'function') {
            st.resize = new ResizeObserver(sync)
            st.resize.observe(st.el)
          }
        } catch {
          /* Text layer is an enhancement — never let it break the render. */
        }
      }
      st.rendered = true
      page.cleanup()
    } catch {
      /* Leave the page as a reserved placeholder; it can render on retry. */
    } finally {
      st.rendering = false
    }
  }

  /** Free a rendered page's canvas/text to bound memory; keep its reserved box. */
  function discardPage(i: number): void {
    const st = states[i]
    if (!st || !st.rendered) return
    st.resize?.disconnect()
    st.resize = undefined
    st.el.style.aspectRatio = `${st.width} / ${(st.el.clientHeight / st.el.clientWidth) * st.width}`
    st.el.replaceChildren()
    st.rendered = false
  }

  // Lazily render pages near the viewport. Root is the nearest scrollable
  // ancestor (the paginated stage, or the page itself in plain mode).
  let io: IntersectionObserver | undefined
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.odvPage) - 1
          if (e.isIntersecting) void renderPage(i)
          else discardPage(i)
        }
      },
      { root: findScrollParent(wrapper), rootMargin: '300% 0px' },
    )
    states.forEach((st) => io!.observe(st.el))
  } else {
    // No IntersectionObserver (old/SSR): render everything eagerly.
    for (let i = 0; i < states.length; i++) await renderPage(i)
  }

  return {
    type: 'pdf',
    meta: { type: 'pdf', pageCount: pdf.numPages },
    pages,
    destroy() {
      try {
        io?.disconnect()
        states.forEach((st) => st.resize?.disconnect())
        pdf.destroy()
        loadingTask.destroy?.()
      } catch {
        /* ignore */
      }
      container.replaceChildren()
    },
  }
}

/** Nearest scrollable ancestor, or null (the viewport) if none. */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement
  while (p) {
    const oy = getComputedStyle(p).overflowY
    if (oy === 'auto' || oy === 'scroll') return p
    p = p.parentElement
  }
  return null
}

/**
 * Minimal pdf.js text-layer stylesheet (a trimmed version of pdfjs-dist's
 * `web/pdf_viewer.css`). Injected once so consumers don't have to import a CSS
 * file from the package. The glyphs are transparent text positioned over the
 * canvas: invisible, but selectable, searchable (Ctrl+F) and screen-readable.
 */
const TEXT_LAYER_CSS = `
.textLayer{position:absolute;text-align:initial;inset:0;overflow:clip;opacity:1;
  line-height:1;text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;
  caret-color:CanvasText;z-index:2}
.textLayer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;
  transform-origin:0% 0%}
.textLayer span.markedContent{top:0;height:0}
.textLayer ::selection{background:rgba(59,130,246,.3)}
.textLayer br::selection{background:transparent}
.textLayer .endOfContent{display:block;position:absolute;inset:100% 0 0;z-index:-1;
  cursor:default;user-select:none}
`

let textLayerStylesInjected = false
function injectTextLayerStyles(): void {
  if (textLayerStylesInjected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.id = 'odv-pdf-textlayer-styles'
  el.textContent = TEXT_LAYER_CSS
  document.head.appendChild(el)
  textLayerStylesInjected = true
}
