import type {
  AnyDocType,
  DocSource,
  FetchOptions,
  RendererLoader,
  RendererRegistration,
  ProgressCallback,
  RenderMeta,
  RenderResult,
  RenderTuning,
  RenderWarning,
} from '../types'

/** How the pages are laid out in the viewport. */
export type ViewMode = 'continuous' | 'paged'
export type Rotation = 0 | 90 | 180 | 270

export interface ViewerCapabilities {
  /** The document has pages to navigate (page input, prev/next, paged/continuous). */
  paged: boolean
  /** Zooming makes sense for this format (not for video/audio/HTML). */
  zoom: boolean
  /** Printing makes sense for this format (not for video/audio). */
  print: boolean
  /** Rotation is supported (natively by the renderer, or via CSS for images). */
  rotate: boolean
  /** In-document search is available. */
  search: boolean
  /** Thumbnails can be produced. */
  thumbnails: boolean
  /** The renderer can re-rasterize at a new scale (crisp zoom). */
  rescale: boolean
}

export interface ViewerSearchState {
  query: string
  status: 'idle' | 'searching' | 'done'
  total: number
  /** 1-based index of the active match; 0 when none. */
  current: number
}

export interface LoadProgress {
  loaded: number
  total?: number
}

export interface ViewerState {
  status: 'idle' | 'loading' | 'loaded' | 'error'
  error: Error | null
  type?: AnyDocType
  meta?: RenderMeta
  /** Current page, 1-based. */
  page: number
  /** Always ≥ 1. */
  pageCount: number
  zoom: number
  rotation: Rotation
  viewMode: ViewMode
  progress?: LoadProgress
  search: ViewerSearchState
  capabilities: ViewerCapabilities
}

/** Options that may change per load (everything else is fixed at creation). */
export interface LoadOverrides extends RenderTuning {
  type?: AnyDocType
  fetchOptions?: FetchOptions
  theme?: 'light' | 'dark' | 'auto'
  renderers?: Record<string, RendererLoader | RendererRegistration>
  fallback?: AnyDocType | RendererLoader
}

export interface ViewerOptions extends RenderTuning {
  /** Element the document is rendered into (its contents are replaced). */
  host: HTMLElement
  /**
   * Scroll container used for page tracking, jump-to-page and fit-width.
   * Defaults to the nearest scrollable ancestor of `host`.
   */
  scrollElement?: HTMLElement
  /** Default format override for every load. */
  type?: AnyDocType
  fetchOptions?: FetchOptions
  /** Custom / overriding renderers (see `RenderOptions.renderers`). */
  renderers?: Record<string, RendererLoader | RendererRegistration>
  /** Type or loader used when detection fails (see `RenderOptions.fallback`). */
  fallback?: AnyDocType | RendererLoader
  /**
   * Manage paged visibility and zoom on the host (the "viewer" experience).
   * When false the document is a plain continuous stack. Default `true`.
   */
  pagination?: boolean
  initialViewMode?: ViewMode
  /**
   * Zoom after a document loads: a factor, `'fit-width'`, or `'auto'`
   * (fit width only when the scroll container is narrower than 600px —
   * phones and sidebars). Default `1`.
   */
  initialZoom?: number | 'fit-width' | 'auto'
  initialRotation?: Rotation
  /**
   * Attach touch/trackpad gestures to the scroll container: pinch and
   * Ctrl/⌘+wheel to zoom, horizontal swipe to change pages in paged mode.
   * Default `false` for the core; the React component enables it.
   */
  gestures?: boolean
  minZoom?: number
  maxZoom?: number
  zoomStep?: number
  onLoad?: (meta: RenderMeta) => void
  onError?: (error: Error) => void
  onWarning?: (warning: RenderWarning) => void
  onPageChange?: (page: number, total: number) => void
  onProgress?: ProgressCallback
  /** Colour theme applied to `host` (see `RenderOptions.theme`). */
  theme?: 'light' | 'dark' | 'auto'
  styleNonce?: string
}

export interface ViewerController {
  readonly host: HTMLElement
  getState(): ViewerState
  /** Listen for state changes. Every change produces a new state object. */
  subscribe(listener: (state: ViewerState) => void): () => void

  load(source: DocSource, overrides?: LoadOverrides): Promise<RenderResult>
  reload(): Promise<RenderResult>
  getResult(): RenderResult | null

  goToPage(page: number): void
  nextPage(): void
  prevPage(): void
  getPage(): number
  getPageCount(): number

  setZoom(zoom: number): void
  zoomIn(): void
  zoomOut(): void
  resetZoom(): void
  fitWidth(): void
  fitPage(): void

  /** Rotate by `delta` degrees (default +90). No-op when unsupported. */
  rotate(delta?: 90 | -90 | 180): void
  setRotation(rotation: Rotation): void

  setViewMode(mode: ViewMode): void
  toggleViewMode(): void

  /** Search the document; resolves the number of matches. */
  search(query: string): Promise<number>
  findNext(): Promise<void>
  findPrev(): Promise<void>
  clearSearch(): void

  print(): void
  download(filename?: string): void

  /** Handle ←/→, PageUp/PageDown, Home/End. Returns true when consumed. */
  handleKeyDown(event: KeyboardEvent): boolean

  destroy(): void
}
