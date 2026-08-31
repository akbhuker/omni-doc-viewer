import { renderDocument } from '../render'
import { type DocSource, type RenderResult } from '../types'
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from './constants'
import { downloadDocument } from './download'
import { printDocument } from './print'
import { createStore } from './store'
import type {
  LoadOverrides,
  Rotation,
  ViewMode,
  ViewerController,
  ViewerOptions,
  ViewerState,
} from './types'

const IDLE_SEARCH = { query: '', status: 'idle', total: 0, current: 0 } as const
const NO_CAPABILITIES = { paged: false, zoom: false, print: false, rotate: false, search: false, thumbnails: false, rescale: false } as const
const NO_ZOOM_TYPES = new Set(['video', 'audio', 'html'])
const NO_PRINT_TYPES = new Set(['video', 'audio'])

export function initialViewerState(opts: Partial<ViewerOptions> = {}): ViewerState {
  return {
    status: 'idle',
    error: null,
    page: 1,
    pageCount: 1,
    zoom: typeof opts.initialZoom === 'number' ? opts.initialZoom : 1,
    rotation: opts.initialRotation ?? 0,
    viewMode: opts.initialViewMode ?? 'paged',
    search: { ...IDLE_SEARCH },
    capabilities: { ...NO_CAPABILITIES },
  }
}

/** Nearest scrollable ancestor, or null. */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement
  while (p) {
    const oy = getComputedStyle(p).overflowY
    if (oy === 'auto' || oy === 'scroll') return p
    p = p.parentElement
  }
  return null
}

function normalizeRotation(deg: number): Rotation {
  return ((((deg % 360) + 360) % 360) as Rotation)
}

/**
 * Framework-agnostic viewer: owns the document lifecycle plus page, zoom,
 * rotation, view-mode and search state, and drives the DOM the renderers
 * produce. The React `<DocViewer>` is a thin shell over this; Vue/Svelte/
 * vanilla apps can use it directly.
 */
export function createViewer(options: ViewerOptions): ViewerController {
  const { host } = options
  const pagination = options.pagination !== false
  const minZoom = options.minZoom ?? MIN_ZOOM
  const maxZoom = options.maxZoom ?? MAX_ZOOM
  const zoomStep = options.zoomStep ?? ZOOM_STEP
  const scrollEl = (): HTMLElement | null => options.scrollElement ?? findScrollParent(host)

  const store = createStore<ViewerState>(initialViewerState(options))
  let result: RenderResult | null = null
  let pages: HTMLElement[] = []
  let abort: AbortController | null = null
  let lastSource: DocSource | undefined
  let lastOverrides: LoadOverrides | undefined
  let observer: IntersectionObserver | undefined
  let destroyed = false
  /**
   * Zoom the renderer has natively rasterized at (via `result.setScale`).
   * CSS zoom covers the difference between the requested zoom and this, so
   * zooming feels instant and settles into a crisp re-raster.
   */
  let nativeZoom = 1
  let searchRun = 0
  let detachGestures: (() => void) | undefined
  /** Fit-width threshold for `initialZoom: 'auto'` (phones, sidebars). */
  const AUTO_FIT_MAX_WIDTH = 600
  let rescaleTimer: ReturnType<typeof setTimeout> | undefined
  let rescaleRun = 0
  const RESCALE_DEBOUNCE_MS = 150

  const state = () => store.get()
  const clampZoom = (z: number) => Math.min(maxZoom, Math.max(minZoom, +z.toFixed(2)))

  // --- DOM application -----------------------------------------------------

  function applyVisibility(): void {
    if (!pagination) return
    const { viewMode, page } = state()
    pages.forEach((el, i) => {
      el.style.display = viewMode === 'paged' && i !== page - 1 ? 'none' : ''
    })
  }

  function applyZoom(): void {
    if (!pagination) return
    // `zoom` reflows content so the scroll container reports the scaled size
    // (and thus shows correct scrollbars), unlike `transform: scale`.
    host.style.setProperty('zoom', String(+(state().zoom / nativeZoom).toFixed(4)))
  }

  /** Base engine scale the renderer was created with (PDF: 1.5 by default). */
  function baseScale(): number {
    return (lastOverrides?.pdf ?? options.pdf)?.scale ?? 1.5
  }

  /** Ask the renderer to re-rasterize at base × zoom (debounced), then drop the CSS zoom. */
  function scheduleRescale(): void {
    if (!result?.setScale) return
    if (rescaleTimer) clearTimeout(rescaleTimer)
    const run = ++rescaleRun
    rescaleTimer = setTimeout(async () => {
      rescaleTimer = undefined
      const target = state().zoom
      if (!result?.setScale || target === nativeZoom) return
      try {
        await result.setScale(+(baseScale() * target).toFixed(2))
      } catch {
        return
      }
      if (run !== rescaleRun || destroyed) return
      nativeZoom = target
      applyZoom()
    }, RESCALE_DEBOUNCE_MS)
  }

  function applyRotationFallback(): void {
    // Images get a CSS rotation; other formats without native support are
    // reported as not rotatable.
    if (result?.type !== 'image' || result.rotate) return
    const img = host.querySelector<HTMLElement>('img')
    if (!img) return
    const r = state().rotation
    img.style.transform = r ? `rotate(${r}deg)` : ''
    img.style.transformOrigin = 'center center'
  }

  function observePages(): void {
    observer?.disconnect()
    observer = undefined
    if (!pagination || state().viewMode !== 'continuous' || pages.length === 0) return
    const root = scrollEl()
    if (!root || typeof IntersectionObserver === 'undefined') return
    const ratios = new Map<Element, number>()
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(e.target, e.intersectionRatio)
        let best = -1
        let bestIdx = -1
        pages.forEach((el, i) => {
          const r = ratios.get(el) ?? 0
          if (r > best) {
            best = r
            bestIdx = i + 1
          }
        })
        if (best > 0 && bestIdx > 0 && bestIdx !== state().page) {
          store.set({ page: bestIdx })
          emitPageChange()
        }
      },
      { root, threshold: [0.1, 0.25, 0.5, 0.75, 1] },
    )
    pages.forEach((el) => observer!.observe(el))
  }

  function emitPageChange(): void {
    const s = state()
    if (s.status === 'loaded') options.onPageChange?.(s.page, s.pageCount)
  }

  /** Natural (zoom-independent) size of a page element. */
  function naturalSize(el: HTMLElement): { width: number; height: number } {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const canvas = el.querySelector('canvas')
    // A natively re-rasterized canvas is nativeZoom× larger than at zoom 1.
    if (canvas && canvas.width) {
      return { width: canvas.width / dpr / nativeZoom, height: canvas.height / dpr / nativeZoom }
    }
    const img = el.querySelector('img')
    if (img?.naturalWidth) return { width: img.naturalWidth, height: img.naturalHeight }
    const rect = el.getBoundingClientRect()
    const z = state().zoom || 1
    return { width: rect.width / z, height: rect.height / z }
  }

  // --- Loading -------------------------------------------------------------

  function teardownResult(): void {
    observer?.disconnect()
    observer = undefined
    searchRun++
    if (rescaleTimer) clearTimeout(rescaleTimer)
    rescaleTimer = undefined
    rescaleRun++
    nativeZoom = 1
    result?.destroy()
    result = null
    pages = []
  }

  async function load(source: DocSource, overrides?: LoadOverrides): Promise<RenderResult> {
    if (destroyed) throw new Error('Viewer has been destroyed.')
    abort?.abort()
    const controller = new AbortController()
    abort = controller
    lastSource = source
    lastOverrides = overrides
    teardownResult()
    store.set({
      status: 'loading',
      error: null,
      page: 1,
      pageCount: 1,
      progress: undefined,
      search: { ...IDLE_SEARCH },
      capabilities: { ...NO_CAPABILITIES },
      type: overrides?.type ?? options.type,
      meta: undefined,
    })

    try {
      const r = await renderDocument({
        container: host,
        source,
        type: overrides?.type ?? options.type,
        signal: controller.signal,
        pdf: overrides?.pdf ?? options.pdf,
        pptx: overrides?.pptx ?? options.pptx,
        docx: overrides?.docx ?? options.docx,
        csv: overrides?.csv ?? options.csv,
        xlsx: overrides?.xlsx ?? options.xlsx,
        html: overrides?.html ?? options.html,
        renderers: overrides?.renderers ?? options.renderers,
        fallback: overrides?.fallback ?? options.fallback,
        fetchOptions: overrides?.fetchOptions ?? options.fetchOptions,
        onProgress: (loaded, total) => {
          if (controller.signal.aborted) return
          store.set({ progress: { loaded, total } })
          options.onProgress?.(loaded, total)
        },
        onWarning: options.onWarning,
        onNavigate: (page) => goToPage(page),
        theme: overrides?.theme ?? options.theme,
        styleNonce: options.styleNonce,
      })
      if (controller.signal.aborted || destroyed) {
        r.destroy()
        throw new DOMException('Aborted', 'AbortError')
      }
      result = r
      pages = r.pages ?? []
      store.set({
        status: 'loaded',
        type: r.meta.type,
        meta: r.meta,
        page: 1,
        pageCount: Math.max(pages.length, 1),
        capabilities: {
          paged: pages.length > 1 || (r.meta.pageCount ?? 0) > 1,
          zoom: !NO_ZOOM_TYPES.has(r.type),
          print: !NO_PRINT_TYPES.has(r.type),
          rotate: typeof r.rotate === 'function' || r.type === 'image',
          search: !!r.search,
          thumbnails: !!r.thumbnails || pages.length > 1,
          rescale: typeof r.setScale === 'function',
        },
      })
      applyVisibility()
      applyInitialZoom()
      applyZoom()
      if (state().zoom !== 1) scheduleRescale()
      if (state().rotation !== 0) void applyRotation()
      observePages()
      attachGestures()
      options.onLoad?.(r.meta)
      emitPageChange()
      return r
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw err
      }
      const e = err instanceof Error ? err : new Error(String(err))
      store.set({ status: 'error', error: e })
      options.onError?.(e)
      throw e
    }
  }

  // --- Navigation ----------------------------------------------------------

  function goToPage(n: number): void {
    const total = state().pageCount
    const clamped = Math.min(Math.max(1, Math.round(n)), total)
    const changed = clamped !== state().page
    store.set({ page: clamped })
    result?.goToPage?.(clamped)
    applyVisibility()
    const scroller = scrollEl()
    if (state().viewMode === 'continuous' && scroller) {
      const el = pages[clamped - 1]
      if (el) {
        // Scroll by the delta between the page top and the viewport top;
        // `scrollIntoView` is unreliable inside nested flex/zoom layouts.
        const delta = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top
        scroller.scrollTo?.({ top: scroller.scrollTop + delta, behavior: 'smooth' })
      }
    } else {
      scroller?.scrollTo?.({ top: 0, left: 0 })
    }
    if (changed) emitPageChange()
  }

  // --- Zoom ----------------------------------------------------------------

  /** Honour `initialZoom` ('fit-width' / 'auto') on each load. */
  function applyInitialZoom(): void {
    const mode = options.initialZoom
    if (mode === 'fit-width') fitWidth()
    else if (mode === 'auto') {
      const w = scrollEl()?.clientWidth ?? Infinity
      if (w > 0 && w < AUTO_FIT_MAX_WIDTH) fitWidth()
    }
  }

  function setZoom(z: number): void {
    if (state().status === 'loaded' && !state().capabilities.zoom) return
    const zoom = clampZoom(z)
    if (zoom === state().zoom) return
    store.set({ zoom })
    applyZoom()
    scheduleRescale()
  }

  function fitWidth(): void {
    const scroller = scrollEl()
    const el = pages[state().page - 1]
    if (!scroller || !el) return
    const avail = scroller.clientWidth - 36 // stage padding
    const { width } = naturalSize(el)
    if (width > 0 && avail > 0) setZoom(avail / width)
  }

  function fitPage(): void {
    const scroller = scrollEl()
    const el = pages[state().page - 1]
    if (!scroller || !el) return
    const availW = scroller.clientWidth - 36
    const availH = scroller.clientHeight - 36
    const { width, height } = naturalSize(el)
    if (width > 0 && height > 0 && availW > 0 && availH > 0) {
      setZoom(Math.min(availW / width, availH / height))
    }
  }

  // --- Gestures ------------------------------------------------------------

  function attachGestures(): void {
    if (!options.gestures || detachGestures || !pagination) return
    const el = scrollEl()
    if (!el) return
    // Let the browser pan/scroll with one finger; we handle pinch ourselves.
    el.style.touchAction = 'pan-x pan-y'

    const onWheel = (e: WheelEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return // plain wheel = scroll
      e.preventDefault()
      // Trackpad pinch arrives as ctrl+wheel with small deltas; wheel+ctrl as ±100.
      const factor = Math.exp(-e.deltaY * (Math.abs(e.deltaY) < 50 ? 0.01 : 0.002))
      setZoom(state().zoom * factor)
    }

    const pointers = new Map<number, { x: number; y: number }>()
    let pinchStart: { distance: number; zoom: number } | undefined
    let swipeStart: { x: number; y: number; id: number } | undefined
    const distance = (): number => {
      const [a, b] = [...pointers.values()]
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
    }
    const onPointerDown = (e: PointerEvent): void => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        pinchStart = { distance: distance(), zoom: state().zoom }
        swipeStart = undefined
      } else if (pointers.size === 1 && e.pointerType !== 'mouse') {
        swipeStart = { x: e.clientX, y: e.clientY, id: e.pointerId }
      }
    }
    const onPointerMove = (e: PointerEvent): void => {
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinchStart && pointers.size === 2) {
        const d = distance()
        if (pinchStart.distance > 0 && d > 0) {
          e.preventDefault()
          setZoom(pinchStart.zoom * (d / pinchStart.distance))
        }
      }
    }
    const onPointerEnd = (e: PointerEvent): void => {
      const start = swipeStart
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinchStart = undefined
      if (start && start.id === e.pointerId && e.type === 'pointerup') {
        const dx = e.clientX - start.x
        const dy = e.clientY - start.y
        // A clear horizontal flick in paged mode flips the page.
        if (state().viewMode === 'paged' && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) {
          if (dx < 0) goToPage(state().page + 1)
          else goToPage(state().page - 1)
        }
      }
      if (pointers.size === 0) swipeStart = undefined
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerEnd)
    el.addEventListener('pointercancel', onPointerEnd)
    detachGestures = () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerEnd)
      el.removeEventListener('pointercancel', onPointerEnd)
      el.style.touchAction = ''
      detachGestures = undefined
    }
  }

  // --- Rotation ------------------------------------------------------------

  async function applyRotation(): Promise<void> {
    const rotation = state().rotation
    if (result?.rotate) await result.rotate(rotation)
    else applyRotationFallback()
  }

  function setRotation(rotation: Rotation): void {
    if (!state().capabilities.rotate) return
    const r = normalizeRotation(rotation)
    store.set({ rotation: r })
    void applyRotation()
  }

  // --- Search --------------------------------------------------------------

  function scrollToTarget(target: Element | Range | undefined): void {
    if (!target) return
    const el =
      target instanceof Element
        ? target
        : (target.startContainer instanceof Element
            ? target.startContainer
            : target.startContainer.parentElement)
    try {
      el?.scrollIntoView({ block: 'center', inline: 'nearest' })
    } catch {
      /* ignore */
    }
  }

  async function selectMatch(i: number): Promise<void> {
    const provider = result?.search
    if (!provider) return
    const run = searchRun
    const { page, element } = await provider.select(i)
    if (run !== searchRun) return
    store.set({ search: { ...state().search, current: i + 1 } })
    if (page !== state().page) goToPage(page)
    scrollToTarget(element)
  }

  async function search(query: string): Promise<number> {
    const provider = result?.search
    const run = ++searchRun
    if (!provider) {
      store.set({ search: { query, status: 'done', total: 0, current: 0 } })
      return 0
    }
    store.set({ search: { query, status: 'searching', total: 0, current: 0 } })
    const r = await provider.search(query)
    if (run !== searchRun) return r.total
    store.set({ search: { query, status: 'done', total: r.total, current: r.total ? 1 : 0 } })
    if (r.total) await selectMatch(0)
    return r.total
  }

  async function step(delta: 1 | -1): Promise<void> {
    const { total, current } = state().search
    if (!total) return
    const next = (((current - 1 + delta) % total) + total) % total
    await selectMatch(next)
  }

  // --- View mode -----------------------------------------------------------

  function setViewMode(mode: ViewMode): void {
    if (mode === state().viewMode) return
    store.set({ viewMode: mode })
    applyVisibility()
    observePages()
  }

  const controller: ViewerController = {
    host,
    getState: state,
    subscribe: store.subscribe,

    load,
    reload() {
      if (lastSource === undefined) return Promise.reject(new Error('Nothing to reload.'))
      return load(lastSource, lastOverrides)
    },
    getResult: () => result,

    goToPage,
    nextPage: () => goToPage(state().page + 1),
    prevPage: () => goToPage(state().page - 1),
    getPage: () => state().page,
    getPageCount: () => state().pageCount,

    setZoom,
    zoomIn: () => setZoom(state().zoom + zoomStep),
    zoomOut: () => setZoom(state().zoom - zoomStep),
    resetZoom: () => setZoom(1),
    fitWidth,
    fitPage,

    rotate: (delta = 90) => setRotation(normalizeRotation(state().rotation + delta)),
    setRotation,

    setViewMode,
    toggleViewMode: () => setViewMode(state().viewMode === 'paged' ? 'continuous' : 'paged'),

    search,
    findNext: () => step(1),
    findPrev: () => step(-1),
    clearSearch() {
      searchRun++
      result?.search?.clear()
      store.set({ search: { ...IDLE_SEARCH } })
    },

    print() {
      printDocument({
        bytes: result?.bytes,
        source: lastSource,
        filename: result?.filename,
        type: state().type,
        host,
        pages,
      })
    },
    download(filename) {
      downloadDocument({
        bytes: result?.bytes,
        source: lastSource,
        filename: filename ?? result?.filename,
        type: state().type,
      })
    },

    handleKeyDown(e) {
      const total = state().pageCount
      let handled = true
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goToPage(state().page + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goToPage(state().page - 1)
      else if (e.key === 'Home') goToPage(1)
      else if (e.key === 'End') goToPage(total)
      else handled = false
      if (handled) e.preventDefault()
      return handled
    },

    destroy() {
      if (destroyed) return
      destroyed = true
      abort?.abort()
      abort = null
      detachGestures?.()
      teardownResult()
      host.style.removeProperty('zoom')
      store.set(initialViewerState(options))
    },
  }
  return controller
}
