'use client'

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { initialViewerState } from '../core/viewer/controller'
import type { LoadProgress, ViewerController, ViewerState, ViewMode } from '../core/viewer/types'
import {
  type AnyDocType,
  type DocSource,
  type FetchOptions,
  type RendererLoader,
  type RendererRegistration,
  type RenderMeta,
  type RenderTuning,
  type RenderWarning,
} from '../core/types'
import { setStyleNonce } from '../core/styles'
import { DEFAULT_LABELS, type DocViewerLabels } from './labels'
import { PasswordPrompt } from './PasswordPrompt'
import { SearchBar } from './SearchBar'
import { Thumbnails } from './Thumbnails'
import { Toolbar, type ToolbarItem } from './Toolbar'
import { useViewerStyles } from './styles'
import { useViewer } from './useViewer'

export type { ViewMode, LoadProgress, ViewerState, ToolbarItem, DocViewerLabels }

/** What a custom `renderToolbar` receives. */
export interface ToolbarRenderContext {
  state: ViewerState
  /** The viewer's imperative API (same object as the `ref` handle). */
  controller: ViewerHandle
  labels: DocViewerLabels
  /** The built-in toolbar, so you can wrap or extend it. */
  defaultToolbar: ReactNode
}

export interface DocViewerProps extends RenderTuning {
  /** The document to display: URL string, File, Blob, ArrayBuffer, Uint8Array, Response or { base64 }. */
  source: DocSource
  /** Optional format override; skips auto-detection. */
  type?: AnyDocType
  /** Custom renderers / overrides for this viewer (see `registerRenderer` for app-wide ones). */
  renderers?: Record<string, RendererLoader | RendererRegistration>
  /** Type (or loader) to render undetectable input with instead of failing. */
  fallback?: AnyDocType | RendererLoader
  /**
   * Headers / credentials for URL sources (auth-gated files, S3 signed URLs).
   * A function receives the URL and returns the `RequestInit` (e.g. to sign it).
   */
  fetchOptions?: FetchOptions
  /** Download progress. `total` is undefined when the size is unknown. */
  onProgress?: (loaded: number, total?: number) => void
  /**
   * Shown while the engine and document load. Pass a function to render
   * download progress: `(progress) => <Bar value={progress?.loaded} max={progress?.total} />`.
   */
  loading?: ReactNode | ((progress: LoadProgress | undefined) => ReactNode)
  /** Render prop for the error state. Defaults to a simple message. */
  errorFallback?: (error: Error) => ReactNode
  /** Called once the document has rendered. */
  onLoad?: (meta: RenderMeta) => void
  /** Called if rendering fails. */
  onError?: (error: Error) => void
  /** Called for recoverable problems the renderer worked around (diagnostics). */
  onWarning?: (warning: RenderWarning) => void
  /**
   * Enable the page navigation chrome: a toolbar with prev/next, a "current /
   * total" indicator you can type into to jump, a continuous⇄paged toggle and
   * zoom controls — all inside a scrollable viewport (vertical and horizontal).
   * When `false` (default) the document renders as a plain continuous stack.
   */
  pagination?: boolean
  /** Initial layout when `pagination` is on. Default `'paged'` (one page at a time). */
  initialViewMode?: ViewMode
  /**
   * Zoom after load: a factor, `'fit-width'`, or `'auto'` (fit width in
   * containers narrower than 600px — phones, sidebars). Default `'auto'`.
   */
  initialZoom?: number | 'fit-width' | 'auto'
  /**
   * Touch/trackpad gestures on the viewport: pinch and Ctrl/⌘+wheel to zoom,
   * horizontal swipe to flip pages in paged mode. Default `true`.
   */
  gestures?: boolean
  /**
   * Height of the scrollable viewport when `pagination` is on. Number = px.
   * Default `'80vh'`. Has no effect when `pagination` is off.
   */
  height?: number | string
  /** Show the toolbar. Defaults to the value of `pagination`. */
  toolbar?: boolean
  /** Notified whenever the current page changes (1-based). */
  onPageChange?: (page: number, total: number) => void
  /**
   * Colour theme: `'light'`, `'dark'`, or `'auto'` (follows the OS). Sets
   * `data-odv-theme` on the root; override any `--odv-*` token in CSS.
   */
  theme?: 'light' | 'dark' | 'auto'
  /** CSP nonce for the stylesheets the viewer injects. */
  styleNonce?: string
  /** Translate / override any user-visible string. */
  labels?: Partial<DocViewerLabels>
  /** Hide individual toolbar sections, e.g. `{ print: false, download: false }`. */
  toolbarItems?: Partial<Record<ToolbarItem, boolean>>
  /** Extra controls rendered inside the toolbar's action group. */
  toolbarExtra?: ReactNode
  /** Replace (or wrap — `ctx.defaultToolbar`) the built-in toolbar. */
  renderToolbar?: (ctx: ToolbarRenderContext) => ReactNode
  /**
   * Page-thumbnail sidebar (toggle in the toolbar). `true`, or options:
   * `{ width?: number; defaultOpen?: boolean }`.
   */
  thumbnails?: boolean | { width?: number; defaultOpen?: boolean }
  className?: string
  style?: CSSProperties
}

/**
 * Imperative API available through `ref` — the same operations the toolbar
 * performs, for your own UI. Every method is safe to call before the document
 * has loaded (they no-op or return the idle state).
 */
export interface ViewerHandle
  extends Pick<
    ViewerController,
    | 'goToPage'
    | 'nextPage'
    | 'prevPage'
    | 'getPage'
    | 'getPageCount'
    | 'setZoom'
    | 'zoomIn'
    | 'zoomOut'
    | 'resetZoom'
    | 'fitWidth'
    | 'fitPage'
    | 'rotate'
    | 'setRotation'
    | 'setViewMode'
    | 'toggleViewMode'
    | 'search'
    | 'findNext'
    | 'findPrev'
    | 'clearSearch'
    | 'print'
    | 'download'
    | 'getState'
    | 'subscribe'
  > {
  /** The underlying framework-agnostic controller (null before mount). */
  getController(): ViewerController | null
  /** The root element (null before mount). */
  getElement(): HTMLElement | null
}

/**
 * Client-side document viewer for PDF / DOCX / XLSX / PPTX / images / text.
 *
 * SSR-safe: rendering is deferred to an effect, so it is inert on the server.
 * In Next.js App Router this works in a Client Component; if you hit a
 * bundler/SSR edge, wrap it with `dynamic(() => import(...), { ssr: false })`.
 *
 * Set `pagination` to get a full navigation experience — page-by-page or
 * continuous scrolling, jump-to-page, and zoom — over any paged format.
 */
export const DocViewer = forwardRef<ViewerHandle, DocViewerProps>(function DocViewer(
  {
    source,
    type,
    renderers,
    fallback,
    fetchOptions,
    onProgress,
    loading,
    errorFallback,
    onLoad,
    onError,
    onWarning,
    pagination = false,
    initialViewMode = 'paged',
    initialZoom = 'auto',
    gestures = true,
    height = '80vh',
    toolbar,
    onPageChange,
    theme,
    styleNonce,
    labels,
    toolbarItems,
    toolbarExtra,
    renderToolbar,
    thumbnails,
    className,
    style,
    pdf,
    pptx,
    docx,
    csv,
    xlsx,
    html,
  },
  ref,
): ReactElement {
  if (styleNonce) setStyleNonce(styleNonce)
  const t = { ...DEFAULT_LABELS, ...labels }

  // Built-in password prompt: unless the app supplies `pdf.password`, an
  // encrypted PDF asks the user through an inline form instead of failing.
  const [pwRequest, setPwRequest] = useState<{
    reason: 'need' | 'incorrect'
    resolve: (value: string | null) => void
  } | null>(null)
  const promptForPassword = useCallback(
    (reason: 'need' | 'incorrect') =>
      new Promise<string | null>((resolve) => setPwRequest({ reason, resolve })),
    [],
  )
  const pdfWithPrompt = pdf?.password ? pdf : { ...pdf, password: promptForPassword }
  const rootRef = useRef<HTMLDivElement | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

  // Hooks must run unconditionally — never after an early return.
  useViewerStyles(pagination || !!theme, styleNonce)

  const { controllerRef, state } = useViewer({
    hostRef,
    stageRef,
    source,
    type,
    renderers,
    fallback,
    fetchOptions,
    pagination,
    initialViewMode,
    onLoad,
    onError,
    onWarning,
    onPageChange,
    onProgress,
    pdf: pdfWithPrompt,
    pptx,
    docx,
    csv,
    xlsx,
    html,
    theme,
    initialZoom,
    gestures,
  })

  // A stable facade whose methods read the controller ref at CALL time (never
  // during render). It doubles as the `ref` handle and the toolbar context.
  const handle = useMemo<ViewerHandle>(() => {
      const c = () => controllerRef.current
      const idle = () => initialViewerState({ initialViewMode })
      return {
        goToPage: (n) => c()?.goToPage(n),
        nextPage: () => c()?.nextPage(),
        prevPage: () => c()?.prevPage(),
        getPage: () => c()?.getPage() ?? 1,
        getPageCount: () => c()?.getPageCount() ?? 1,
        setZoom: (z) => c()?.setZoom(z),
        zoomIn: () => c()?.zoomIn(),
        zoomOut: () => c()?.zoomOut(),
        resetZoom: () => c()?.resetZoom(),
        fitWidth: () => c()?.fitWidth(),
        fitPage: () => c()?.fitPage(),
        rotate: (d) => c()?.rotate(d),
        setRotation: (r) => c()?.setRotation(r),
        setViewMode: (m) => c()?.setViewMode(m),
        toggleViewMode: () => c()?.toggleViewMode(),
        search: (q) => c()?.search(q) ?? Promise.resolve(0),
        findNext: () => c()?.findNext() ?? Promise.resolve(),
        findPrev: () => c()?.findPrev() ?? Promise.resolve(),
        clearSearch: () => c()?.clearSearch(),
        print: () => c()?.print(),
        download: (name) => c()?.download(name),
        getState: () => c()?.getState() ?? idle(),
        subscribe: (l) => c()?.subscribe(l) ?? (() => {}),
        getController: c,
        getElement: () => rootRef.current,
      }
  }, [controllerRef, initialViewMode])
  useImperativeHandle(ref, () => handle, [handle])

  const status = state.status === 'idle' ? 'loading' : state.status
  const showToolbar = toolbar ?? pagination
  const caps = state.capabilities
  const showPassword = !!pwRequest && status === 'loading'
  // Controls that make no sense for this document are hidden; explicit
  // `toolbarItems` can only hide more, never show unsupported ones.
  const items: Partial<Record<ToolbarItem, boolean>> =
    status === 'loaded'
      ? {
          ...toolbarItems,
          pages: caps.paged && toolbarItems?.pages !== false,
          viewMode: caps.paged && toolbarItems?.viewMode !== false,
          zoom: caps.zoom && toolbarItems?.zoom !== false,
          fitWidth: caps.zoom && toolbarItems?.fitWidth !== false,
          print: caps.print && toolbarItems?.print !== false,
        }
      : { ...toolbarItems }
  const [searchOpen, setSearchOpen] = useState(false)
  const canSearch = state.capabilities.search
  const thumbOpts = thumbnails && typeof thumbnails === 'object' ? thumbnails : {}
  const [thumbsOpen, setThumbsOpen] = useState(!!thumbnails && !!thumbOpts.defaultOpen)
  const showThumbs = !!thumbnails && thumbsOpen && status === 'loaded' && state.capabilities.thumbnails
  const closeSearch = () => {
    setSearchOpen(false)
    controllerRef.current?.clearSearch()
    stageRef.current?.focus()
  }

  const host = (
    <div ref={hostRef} style={{ width: '100%', opacity: status === 'loaded' ? 1 : 0 }} />
  )

  const overlay =
    status !== 'loaded' ? (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {status === 'error' && state.error ? (
          errorFallback ? (
            errorFallback(state.error)
          ) : (
            <DefaultError error={state.error} labels={t} />
          )
        ) : showPassword ? (
          <PasswordPrompt
            reason={pwRequest!.reason}
            labels={t}
            onSubmit={(value) => {
              pwRequest!.resolve(value)
              setPwRequest(null)
            }}
            onCancel={() => {
              pwRequest!.resolve(null)
              setPwRequest(null)
            }}
          />
        ) : typeof loading === 'function' ? (
          loading(state.progress)
        ) : (
          (loading ?? <DefaultLoading progress={state.progress} labels={t} />)
        )}
      </div>
    ) : null

  // --- Plain mode (backward compatible) -------------------------------------
  if (!pagination) {
    return (
      <div
        ref={rootRef}
        className={className}
        data-odv-theme={theme}
        style={{
          position: 'relative',
          minHeight: status === 'loaded' ? undefined : 120,
          ...style,
        }}
      >
        {/* The host stays in the layout (so renderers can measure its real
            width — e.g. PPTX); we only fade it in once loaded. */}
        {host}
        {overlay}
      </div>
    )
  }

  // --- Paginated mode -------------------------------------------------------
  const defaultToolbar = showToolbar ? (
    <Toolbar
      current={state.page}
      total={state.pageCount}
      zoom={state.zoom}
      viewMode={state.viewMode}
      disabled={status !== 'loaded'}
      onPrev={() => controllerRef.current?.prevPage()}
      onNext={() => controllerRef.current?.nextPage()}
      onJump={(n) => controllerRef.current?.goToPage(n)}
      onZoomIn={() => controllerRef.current?.zoomIn()}
      onZoomOut={() => controllerRef.current?.zoomOut()}
      onZoomReset={() => controllerRef.current?.resetZoom()}
      onFitWidth={() => controllerRef.current?.fitWidth()}
      onDownload={() => controllerRef.current?.download()}
      onPrint={() => controllerRef.current?.print()}
      onToggleMode={() => controllerRef.current?.toggleViewMode()}
      onRotate={state.capabilities.rotate ? () => controllerRef.current?.rotate() : undefined}
      onSearch={canSearch ? () => (searchOpen ? closeSearch() : setSearchOpen(true)) : undefined}
      searchOpen={searchOpen}
      onThumbnails={thumbnails && caps.thumbnails ? () => setThumbsOpen((o) => !o) : undefined}
      thumbnailsOpen={thumbsOpen}
      labels={labels}
      items={items}
      extra={toolbarExtra}
    />
  ) : null
  return (
    <div
      ref={rootRef}
      className={`odv-pg-root${className ? ` ${className}` : ''}`}
      data-odv-theme={theme}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 10,
        overflow: 'hidden',
        // Establish a container so the toolbar can adapt to the viewer's own
        // width (not the viewport) — works even when embedded in a sidebar.
        containerType: 'inline-size',
        containerName: 'odvpg',
        ...style,
      }}
    >
      {renderToolbar
        ? // `handle` is a stable facade; its methods only touch the controller ref
          // when invoked (event handlers), never during render.
          // eslint-disable-next-line react-hooks/refs
          renderToolbar({ state, controller: handle, labels: t, defaultToolbar })
        : defaultToolbar}
      {searchOpen && canSearch && (
        <SearchBar
          state={state.search}
          onQuery={(q) => void controllerRef.current?.search(q)}
          onNext={() => void controllerRef.current?.findNext()}
          onPrev={() => void controllerRef.current?.findPrev()}
          onClose={closeSearch}
          labels={{
            placeholder: t.searchPlaceholder,
            nextMatch: t.nextMatch,
            previousMatch: t.previousMatch,
            close: t.closeSearch,
            noMatches: t.noMatches,
            matches: t.matches,
          }}
        />
      )}
      <div className="odv-pg-body" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
        {showThumbs && (
          <Thumbnails
            controllerRef={controllerRef}
            width={thumbOpts.width}
            label={t.thumbnails}
            pageLabel={t.pageLabel}
          />
        )}
        <div
          ref={stageRef}
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && canSearch) {
              e.preventDefault()
              setSearchOpen(true)
              return
            }
            if (controllerRef.current?.handleKeyDown(e.nativeEvent)) e.stopPropagation()
          }}
          className="odv-pg-stage"
          style={{ height: '100%' }}
        >
          {host}
          {overlay}
        </div>
      </div>
    </div>
  )
})

function DefaultLoading({ progress, labels }: { progress?: LoadProgress; labels: DocViewerLabels }): ReactElement {
  const pct =
    progress && progress.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : null
  return (
    <div
      className="odv-loading"
      style={{ padding: 16, color: 'var(--odv-fg-muted, #666)', fontFamily: 'var(--odv-font, system-ui, sans-serif)' }}
      role="status"
      aria-live="polite"
    >
      {pct !== null ? labels.loadingProgress(pct) : labels.loading}
    </div>
  )
}

function DefaultError({ error, labels }: { error: Error; labels: DocViewerLabels }): ReactElement {
  return (
    <div
      role="alert"
      className="odv-error"
      style={{
        padding: 16,
        color: 'var(--odv-error, #b00020)',
        fontFamily: 'var(--odv-font, system-ui, sans-serif)',
        whiteSpace: 'pre-wrap',
      }}
    >
      {labels.error(error.message)}
    </div>
  )
}
