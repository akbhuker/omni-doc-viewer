import { RenderError, type PdfPasswordReason, type Renderer } from '../../types'
import { injectPdfLayerStyles } from './css'
import { createLinkService } from './links'
import { createPdfSearchProvider } from './search'
import { createPdfThumbnailProvider } from './thumbnails'
import { assetUrlsFrom, configureWorker, workerBaseOf, cdnBaseFor } from './worker'

export { setPdfWorkerSrc } from './worker'

type Rotation = 0 | 90 | 180 | 270

/** Marker for "the password callback gave up" so we can map it precisely. */
class PasswordCancelled extends Error {
  constructor() {
    super('Password entry cancelled')
    this.name = 'PasswordCancelled'
  }
}

async function loadPdfjs(legacy?: boolean): Promise<any> {
  return legacy ? import('pdfjs-dist/legacy/build/pdf.mjs') : import('pdfjs-dist')
}

export const render: Renderer = async ({ container, bytes, options, signal, warn }) => {
  const tuning = options.pdf ?? {}
  const pdfjs: any = await loadPdfjs(tuning.legacy)

  const worker = await configureWorker(pdfjs, {
    explicit: tuning.workerSrc,
    cdn: tuning.workerFallbackCdn,
    legacy: tuning.legacy,
  })
  if (worker.warning) warn(worker.warning)

  // Asset folders (CMaps for CJK, standard fonts, wasm decoders): explicit
  // `assetsUrl`, else next to a package-layout worker, else the CDN base.
  const assetBase =
    tuning.assetsUrl ??
    workerBaseOf(worker.src) ??
    (worker.strategy === 'cdn'
      ? cdnBaseFor(String(pdfjs.version ?? ''), tuning.workerFallbackCdn ?? true)
      : undefined)
  const assets = assetBase ? assetUrlsFrom(assetBase) : undefined

  let scale = tuning.scale ?? 1.5
  let rotation: Rotation = 0
  const password = tuning.password
  const wantText = tuning.textLayer !== false
  const wantLinks = tuning.annotations !== false
  const maxRendered = Math.max(1, tuning.maxRenderedPages ?? 12)

  // pdf.js may transfer/detach the underlying buffer, so hand it a copy.
  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(),
    password: typeof password === 'string' ? password : undefined,
    cMapUrl: tuning.cMapUrl ?? assets?.cMapUrl,
    cMapPacked: true,
    standardFontDataUrl: tuning.standardFontDataUrl ?? assets?.standardFontDataUrl,
    wasmUrl: tuning.wasmUrl ?? assets?.wasmUrl,
    iccUrl: tuning.iccUrl ?? assets?.iccUrl,
  })

  if (typeof password === 'function') {
    loadingTask.onPassword = (update: (value: string | Error) => void, reasonCode: number) => {
      const reason: PdfPasswordReason =
        reasonCode === pdfjs.PasswordResponses?.INCORRECT_PASSWORD ? 'incorrect' : 'need'
      Promise.resolve()
        .then(() => password(reason))
        .then(
          (value) => update(value == null ? new PasswordCancelled() : value),
          (err) => update(err instanceof Error ? err : new Error(String(err))),
        )
    }
  }

  let pdf: any
  try {
    pdf = await loadingTask.promise
  } catch (err) {
    throw mapLoadError(err)
  }
  if (signal?.aborted) {
    void loadingTask.destroy?.()
    throw new DOMException('Aborted', 'AbortError')
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'odv-pdf'
  wrapper.style.display = 'flex'
  wrapper.style.flexDirection = 'column'
  wrapper.style.alignItems = 'center'
  wrapper.style.gap = '12px'
  container.appendChild(wrapper)

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  injectPdfLayerStyles()

  // Per-page bookkeeping. Pages are virtualized: we reserve their size up front
  // (so the scrollbar and page navigation are correct immediately) but only
  // rasterize a page — and build its layers — when it nears the viewport,
  // freeing it again once it scrolls far away (plus an LRU cap). This keeps a
  // 500-page PDF fast and memory-bounded instead of rendering every page.
  interface PageState {
    el: HTMLElement
    /** Unrotated page size in PDF points. */
    pointWidth: number
    pointHeight: number
    userUnit: number
    sized: boolean
    rendered: boolean
    rendering: boolean
    /** Bumped on every (re)render request so stale renders are dropped. */
    generation: number
    resize?: ResizeObserver
    /** The pdf.js TextLayer instance while rendered (search highlights use its spans). */
    textLayer?: any
  }
  const states: PageState[] = []
  const pages: HTMLElement[] = []
  const visible = new Set<number>()
  const renderedOrder: number[] = []
  const renderedListeners = new Set<(page: number) => void>()
  let destroyed = false

  /** Box width in points for the current rotation. */
  const boxPointWidth = (st: PageState) => (rotation % 180 ? st.pointHeight : st.pointWidth)
  const boxPointHeight = (st: PageState) => (rotation % 180 ? st.pointWidth : st.pointHeight)

  /** Apply size (from point dims × scale × rotation) to a page box. */
  function relayout(st: PageState): void {
    const w = boxPointWidth(st) * scale
    const h = boxPointHeight(st) * scale
    st.el.style.width = `${Math.floor(w)}px`
    if (!st.rendered) st.el.style.aspectRatio = `${w} / ${h}`
    if (st.userUnit !== 1) st.el.style.setProperty('--user-unit', String(st.userUnit))
    syncScaleFactor(st)
  }

  /** pdf.js sizes its layers from `--scale-factor` = rendered px per PDF point. */
  function syncScaleFactor(st: PageState): void {
    const cssWidth = st.el.clientWidth || boxPointWidth(st) * scale
    st.el.style.setProperty('--scale-factor', String(cssWidth / boxPointWidth(st)))
  }

  function setPointSize(st: PageState, page: any): void {
    const vp = page.getViewport({ scale: 1, rotation: 0 })
    st.pointWidth = vp.width
    st.pointHeight = vp.height
    st.userUnit = Number(page.userUnit) || 1
    st.sized = true
  }

  // Pass 1 — read ONE page to size every box immediately (first paint after a
  // single worker round-trip); real sizes for the rest arrive in the background.
  const firstPage = await pdf.getPage(1)
  const first = { w: 0, h: 0, unit: 1 }
  {
    const vp = firstPage.getViewport({ scale: 1, rotation: 0 })
    first.w = vp.width
    first.h = vp.height
    first.unit = Number(firstPage.userUnit) || 1
  }
  firstPage.cleanup()

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const pageEl = document.createElement('div')
    pageEl.className = 'odv-pdf-page'
    pageEl.style.position = 'relative'
    pageEl.style.maxWidth = '100%'
    pageEl.style.background = 'var(--odv-page-bg, #fff)'
    pageEl.style.boxShadow = 'var(--odv-page-shadow, 0 1px 4px rgba(0,0,0,0.18))'
    pageEl.setAttribute('role', 'region')
    pageEl.setAttribute('aria-label', `Page ${pageNum}`)
    pageEl.dataset.odvPage = String(pageNum)
    const st: PageState = {
      el: pageEl,
      pointWidth: first.w,
      pointHeight: first.h,
      userUnit: first.unit,
      sized: pageNum === 1,
      rendered: false,
      rendering: false,
      generation: 0,
    }
    relayout(st)
    wrapper.appendChild(pageEl)
    pages.push(pageEl)
    states.push(st)
  }

  // Pass 2 (background) — correct sizes for pages that differ from page 1.
  async function sizePages(): Promise<void> {
    const BATCH = 8
    for (let start = 2; start <= pdf.numPages; start += BATCH) {
      if (signal?.aborted || destroyed) return
      const nums: number[] = []
      for (let n = start; n < start + BATCH && n <= pdf.numPages; n++) nums.push(n)
      let loaded: any[]
      try {
        loaded = await Promise.all(nums.map((n) => pdf.getPage(n)))
      } catch {
        return
      }
      if (destroyed) return
      loaded.forEach((page, i) => {
        const st = states[nums[i]! - 1]!
        if (!st.sized) {
          const before = `${st.pointWidth}x${st.pointHeight}`
          setPointSize(st, page)
          if (before !== `${st.pointWidth}x${st.pointHeight}`) relayout(st)
        }
        page.cleanup()
      })
    }
  }
  void sizePages()

  const navigate = (page: number): void => {
    if (options.onNavigate) options.onNavigate(page)
    else pages[page - 1]?.scrollIntoView({ block: 'start' })
  }
  const linkService = createLinkService({
    pdf,
    pageCount: pdf.numPages,
    getPage: () => {
      // Best effort: the first visible page.
      const v = [...visible].sort((a, b) => a - b)[0]
      return v !== undefined ? v + 1 : 1
    },
    navigate,
    externalLinkTarget: tuning.externalLinkTarget ?? '_blank',
  })

  /** Evict least-recently rendered pages beyond the cap (never visible ones). */
  function enforceCap(): void {
    while (renderedOrder.length > maxRendered) {
      const victim = renderedOrder.find((i) => !visible.has(i))
      if (victim === undefined) return
      discardPage(victim)
    }
  }

  async function renderPage(i: number): Promise<void> {
    const st = states[i]
    if (!st || st.rendering || signal?.aborted || destroyed) return
    st.rendering = true
    const generation = ++st.generation
    const stale = () => generation !== st.generation || signal?.aborted || destroyed
    try {
      const page = await pdf.getPage(i + 1)
      if (stale()) return
      if (!st.sized) {
        setPointSize(st, page)
        relayout(st)
      }
      const viewport = page.getViewport({ scale, rotation })

      // Everything for this page is built into a frame and swapped in at the
      // end, so a re-render (zoom/rotate) never flashes an empty box.
      const frame = document.createElement('div')
      frame.className = 'odv-pdf-frame'
      frame.style.position = 'relative'

      const canvas = document.createElement('canvas')
      canvas.className = 'odv-pdf-canvas'
      canvas.style.display = 'block'
      canvas.style.width = '100%'
      canvas.style.height = 'auto'
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      frame.appendChild(canvas)

      await page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise
      if (stale()) return

      if (wantText && typeof pdfjs.TextLayer === 'function') {
        try {
          const textEl = document.createElement('div')
          textEl.className = 'textLayer'
          frame.appendChild(textEl)
          const textLayer = new pdfjs.TextLayer({
            textContentSource: page.streamTextContent({ includeMarkedContent: true }),
            container: textEl,
            viewport,
          })
          await textLayer.render()
          if (!stale()) st.textLayer = textLayer
        } catch {
          /* Text layer is an enhancement — never let it break the render. */
        }
        if (stale()) return
      }

      if (wantLinks && typeof pdfjs.AnnotationLayer === 'function') {
        try {
          const annotations = (await page.getAnnotations({ intent: 'display' })).filter(
            (a: any) => a?.subtype === 'Link',
          )
          if (stale()) return
          if (annotations.length > 0) {
            const div = document.createElement('div')
            div.className = 'annotationLayer'
            frame.appendChild(div)
            const layerViewport = viewport.clone({ dontFlip: true })
            const layer = new pdfjs.AnnotationLayer({
              div,
              page,
              viewport: layerViewport,
              accessibilityManager: null,
              annotationCanvasMap: null,
              annotationEditorUIManager: null,
              structTreeLayer: null,
              commentManager: null,
              linkService,
              annotationStorage: null,
            })
            await layer.render({
              annotations,
              div,
              page,
              viewport: layerViewport,
              linkService,
              renderForms: false,
              imageResourcesPath: '',
            })
          }
        } catch {
          /* Links are an enhancement. */
        }
        if (stale()) return
      }

      // Swap: the reserved box (or the previous raster) is replaced atomically.
      st.el.style.aspectRatio = ''
      st.el.replaceChildren(frame)
      st.resize?.disconnect()
      syncScaleFactor(st)
      if (typeof ResizeObserver === 'function') {
        st.resize = new ResizeObserver(() => syncScaleFactor(st))
        st.resize.observe(st.el)
      }
      st.rendered = true
      const idx = renderedOrder.indexOf(i)
      if (idx >= 0) renderedOrder.splice(idx, 1)
      renderedOrder.push(i)
      enforceCap()
      page.cleanup()
      for (const l of renderedListeners) l(i + 1)
    } catch {
      /* Leave the page as a reserved placeholder; it can render on retry. */
    } finally {
      if (generation === st.generation) st.rendering = false
    }
  }

  /** Free a rendered page's layers to bound memory; keep its reserved box. */
  function discardPage(i: number): void {
    const st = states[i]
    if (!st) return
    st.generation++
    st.rendering = false
    if (!st.rendered) return
    st.resize?.disconnect()
    st.resize = undefined
    st.textLayer = undefined
    st.el.replaceChildren()
    st.rendered = false
    const w = boxPointWidth(st) * scale
    const h = boxPointHeight(st) * scale
    st.el.style.aspectRatio = `${w} / ${h}`
    const idx = renderedOrder.indexOf(i)
    if (idx >= 0) renderedOrder.splice(idx, 1)
  }

  /** Re-lay out every page and re-render the ones near the viewport. */
  async function rerenderAll(): Promise<void> {
    for (let i = 0; i < states.length; i++) {
      const st = states[i]!
      st.generation++ // cancel in-flight renders at the old geometry
      st.rendering = false
      relayout(st)
    }
    const targets = [...visible].sort((a, b) => a - b)
    for (const i of targets) {
      // Keep the old raster on screen (scaled by CSS) until the new one lands.
      const st = states[i]!
      st.rendered = false
      const idx = renderedOrder.indexOf(i)
      if (idx >= 0) renderedOrder.splice(idx, 1)
    }
    await Promise.all(targets.map((i) => renderPage(i)))
  }

  // Lazily render pages near the viewport. Root is the nearest scrollable
  // ancestor (the paginated stage, or the page itself in plain mode).
  let io: IntersectionObserver | undefined
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.odvPage) - 1
          if (e.isIntersecting) {
            visible.add(i)
            void renderPage(i)
          } else {
            visible.delete(i)
            discardPage(i)
          }
        }
      },
      { root: findScrollParent(wrapper), rootMargin: '300% 0px' },
    )
    states.forEach((st) => io!.observe(st.el))
  } else {
    // No IntersectionObserver (old/SSR): render everything eagerly.
    for (let i = 0; i < states.length; i++) {
      visible.add(i)
      await renderPage(i)
    }
  }

  const onPageRendered = (listener: (page: number) => void): (() => void) => {
    renderedListeners.add(listener)
    return () => {
      renderedListeners.delete(listener)
    }
  }

  const search = wantText
    ? createPdfSearchProvider({
        pdf,
        numPages: pdf.numPages,
        getTextLayer: (page) => {
          const st = states[page - 1]
          return st?.rendered && st.textLayer ? { textDivs: st.textLayer.textDivs as HTMLElement[] } : undefined
        },
        ensureRendered: async (page) => {
          const i = page - 1
          if (states[i]?.rendered) return
          await renderPage(i)
        },
        onPageRendered,
        signal,
      })
    : undefined

  const thumbnails = createPdfThumbnailProvider({
    pdf,
    numPages: pdf.numPages,
    rotation: () => rotation,
    signal,
  })

  return {
    type: 'pdf',
    meta: { type: 'pdf', pageCount: pdf.numPages },
    pages,
    search,
    thumbnails,
    async setScale(next: number) {
      if (!(next > 0) || next === scale) return
      scale = next
      await rerenderAll()
    },
    async rotate(next: Rotation) {
      const r = (((next % 360) + 360) % 360) as Rotation
      if (r === rotation) return
      rotation = r
      linkService.rotation = r
      await rerenderAll()
    },
    onPageRendered,
    destroy() {
      destroyed = true
      try {
        io?.disconnect()
        states.forEach((st) => st.resize?.disconnect())
        renderedListeners.clear()
        thumbnails.destroy?.()
        // v6: the loading task owns the document; destroying it frees the worker side.
        void loadingTask.destroy?.()
      } catch {
        /* ignore */
      }
      container.replaceChildren()
    },
  }
}

/** Map pdf.js load failures to structured errors. */
function mapLoadError(err: unknown): Error {
  const e = err as { name?: string; message?: string; code?: number }
  if (err instanceof PasswordCancelled || e?.name === 'PasswordCancelled') {
    return new RenderError(
      'This PDF is password-protected and no password was supplied.',
      'PDF_PASSWORD_REQUIRED',
      'pdf',
      { reason: 'cancelled' },
    )
  }
  if (e?.name === 'PasswordException') {
    const incorrect = /incorrect/i.test(e.message ?? '') || e.code === 2
    return new RenderError(
      incorrect
        ? 'The password for this PDF is incorrect.'
        : 'This PDF is password-protected. Provide `pdf.password`.',
      'PDF_PASSWORD_REQUIRED',
      'pdf',
      { reason: incorrect ? 'incorrect' : 'need' },
    )
  }
  if (e?.name === 'InvalidPDFException') {
    return new RenderError(`Invalid or corrupt PDF: ${e.message ?? ''}`.trim(), 'PDF_INVALID', 'pdf', {
      cause: err,
    })
  }
  return err instanceof Error ? err : new Error(String(err))
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
