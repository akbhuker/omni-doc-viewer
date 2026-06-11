'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { renderDocument } from '../core/render'
import {
  type DocSource,
  type DocType,
  type RenderMeta,
  type RenderResult,
  type RenderTuning,
} from '../core/types'

/** How the pages are laid out in the viewport. */
export type ViewMode = 'continuous' | 'paged'

export interface DocViewerProps extends RenderTuning {
  /** The document to display: URL string, File, Blob, ArrayBuffer or Uint8Array. */
  source: DocSource
  /** Optional format override; skips auto-detection. */
  type?: DocType
  /** Shown while the engine and document load. */
  loading?: ReactNode
  /** Render prop for the error state. Defaults to a simple message. */
  errorFallback?: (error: Error) => ReactNode
  /** Called once the document has rendered. */
  onLoad?: (meta: RenderMeta) => void
  /** Called if rendering fails. */
  onError?: (error: Error) => void
  /**
   * Enable the page navigation chrome: a toolbar with prev/next, a "current /
   * total" indicator you can type into to jump, a continuous⇄paged toggle and
   * zoom controls — all inside a scrollable viewport (vertical and horizontal).
   * When `false` (default) the document renders as a plain continuous stack,
   * exactly as before.
   */
  pagination?: boolean
  /** Initial layout when `pagination` is on. Default `'paged'` (one page at a time). */
  initialViewMode?: ViewMode
  /**
   * Height of the scrollable viewport when `pagination` is on. Number = px.
   * Default `'80vh'`. Has no effect when `pagination` is off.
   */
  height?: number | string
  /** Show the toolbar. Defaults to the value of `pagination`. */
  toolbar?: boolean
  /** Notified whenever the current page changes (1-based). */
  onPageChange?: (page: number, total: number) => void
  className?: string
  style?: CSSProperties
}

type Status = 'loading' | 'loaded' | 'error'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 0.2

/**
 * Client-side document viewer for PDF / DOCX / XLSX / PPTX.
 *
 * SSR-safe: rendering is deferred to an effect, so it is inert on the server.
 * In Next.js App Router this works in a Client Component; if you hit a
 * bundler/SSR edge, wrap it with `dynamic(() => import(...), { ssr: false })`.
 *
 * Set `pagination` to get a full navigation experience — page-by-page or
 * continuous scrolling, jump-to-page, and zoom — over any paged format.
 */
export function DocViewer({
  source,
  type,
  loading,
  errorFallback,
  onLoad,
  onError,
  pagination = false,
  initialViewMode = 'paged',
  height = '80vh',
  toolbar,
  onPageChange,
  className,
  style,
  pdf,
  pptx,
}: DocViewerProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<Error | null>(null)
  const [pages, setPages] = useState<HTMLElement[]>([])
  const [current, setCurrent] = useState(1)
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [zoom, setZoom] = useState(1)

  const showToolbar = toolbar ?? pagination
  const total = Math.max(pages.length, 1)

  // --- Render the document --------------------------------------------------
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let result: RenderResult | null = null
    let cancelled = false
    const controller = new AbortController()

    setStatus('loading')
    setError(null)
    setPages([])
    setCurrent(1)

    renderDocument({
      container: host,
      source,
      type,
      signal: controller.signal,
      pdf,
      pptx,
    })
      .then((r) => {
        if (cancelled) {
          r.destroy()
          return
        }
        result = r
        setPages(r.pages ?? [])
        setStatus('loaded')
        onLoad?.(r.meta)
      })
      .catch((err: unknown) => {
        if (cancelled || controller.signal.aborted) return
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        setStatus('error')
        onError?.(e)
      })

    return () => {
      cancelled = true
      controller.abort()
      result?.destroy()
    }
    // Re-render when the source or detection inputs change.
  }, [source, type, pdf?.scale, pdf?.workerSrc, pptx?.width, pptx?.height])

  // --- Apply paged visibility + zoom to the real DOM nodes ------------------
  useEffect(() => {
    if (!pagination || pages.length === 0) return
    pages.forEach((el, i) => {
      el.style.display = viewMode === 'paged' && i !== current - 1 ? 'none' : ''
    })
  }, [pagination, pages, viewMode, current])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !pagination) return
    // `zoom` reflows content so the scroll container reports the scaled size
    // (and thus shows correct scrollbars), unlike `transform: scale`.
    host.style.setProperty('zoom', String(zoom))
    return () => {
      host.style.removeProperty('zoom')
    }
  }, [pagination, zoom, status])

  // --- Track the visible page while scrolling (continuous mode) -------------
  useEffect(() => {
    if (!pagination || viewMode !== 'continuous' || pages.length === 0) return
    const rootEl = scrollRef.current
    if (!rootEl || typeof IntersectionObserver === 'undefined') return

    const ratios = new Map<Element, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(e.target, e.intersectionRatio)
        let best = -1
        let bestIdx = current
        pages.forEach((el, i) => {
          const r = ratios.get(el) ?? 0
          if (r > best) {
            best = r
            bestIdx = i + 1
          }
        })
        if (best > 0) setCurrent(bestIdx)
      },
      { root: rootEl, threshold: [0.1, 0.25, 0.5, 0.75, 1] },
    )
    pages.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [pagination, viewMode, pages])

  // --- Notify on page change ------------------------------------------------
  useEffect(() => {
    if (status === 'loaded') onPageChange?.(current, total)
  }, [current, total, status])

  const goTo = useCallback(
    (n: number) => {
      const clamped = Math.min(Math.max(1, Math.round(n)), total)
      setCurrent(clamped)
      const scroller = scrollRef.current
      if (viewMode === 'continuous' && scroller) {
        const el = pages[clamped - 1]
        if (el) {
          // Scroll the container by the delta between the page top and the
          // viewport top. `scrollIntoView` is unreliable inside our nested
          // flex/zoom layout (it can jump to the wrong end), so we do the
          // math ourselves.
          const delta =
            el.getBoundingClientRect().top - scroller.getBoundingClientRect().top
          scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: 'smooth' })
        }
      } else {
        scroller?.scrollTo({ top: 0, left: 0 })
      }
    },
    [pages, total, viewMode],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault()
      goTo(current + 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault()
      goTo(current - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      goTo(1)
    } else if (e.key === 'End') {
      e.preventDefault()
      goTo(total)
    }
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
        {status === 'error' && error
          ? errorFallback
            ? errorFallback(error)
            : <DefaultError error={error} />
          : (loading ?? <DefaultLoading />)}
      </div>
    ) : null

  // --- Plain mode (backward compatible) -------------------------------------
  if (!pagination) {
    return (
      <div
        className={className}
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
  useToolbarStyles()
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #e6e6e9',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#fff',
        // Establish a container so the toolbar can adapt to the viewer's own
        // width (not the viewport) — works even when embedded in a sidebar.
        containerType: 'inline-size',
        containerName: 'odvpg',
        ...style,
      }}
    >
      {showToolbar && (
        <Toolbar
          current={current}
          total={total}
          zoom={zoom}
          viewMode={viewMode}
          disabled={status !== 'loaded'}
          onPrev={() => goTo(current - 1)}
          onNext={() => goTo(current + 1)}
          onJump={goTo}
          onZoomIn={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}
          onZoomOut={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}
          onZoomReset={() => setZoom(1)}
          onToggleMode={() =>
            setViewMode((m) => (m === 'continuous' ? 'paged' : 'continuous'))
          }
        />
      )}
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="odv-pg-stage"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        {host}
        {overlay}
      </div>
    </div>
  )
}

interface ToolbarProps {
  current: number
  total: number
  zoom: number
  viewMode: ViewMode
  disabled: boolean
  onPrev: () => void
  onNext: () => void
  onJump: (n: number) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onToggleMode: () => void
}

function Toolbar({
  current,
  total,
  zoom,
  viewMode,
  disabled,
  onPrev,
  onNext,
  onJump,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onToggleMode,
}: ToolbarProps): JSX.Element {
  const [draft, setDraft] = useState(String(current))
  // Keep the input in sync as the page changes via scroll / buttons.
  useEffect(() => setDraft(String(current)), [current])

  const commit = () => {
    const n = parseInt(draft, 10)
    if (Number.isFinite(n)) onJump(n)
    else setDraft(String(current))
  }

  return (
    <div className="odv-pg-bar" role="toolbar" aria-label="Document navigation">
      <div className="odv-pg-grp">
        <button
          type="button"
          className="odv-pg-btn"
          onClick={onPrev}
          disabled={disabled || current <= 1}
          aria-label="Previous page"
          title="Previous page"
        >
          <Icon d="M15 18l-6-6 6-6" />
        </button>
        <span className="odv-pg-pages">
          <input
            className="odv-pg-input"
            aria-label="Page number"
            inputMode="numeric"
            value={draft}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
          />
          <span className="odv-pg-total">/ {total}</span>
        </span>
        <button
          type="button"
          className="odv-pg-btn"
          onClick={onNext}
          disabled={disabled || current >= total}
          aria-label="Next page"
          title="Next page"
        >
          <Icon d="M9 18l6-6-6-6" />
        </button>
      </div>

      <span className="odv-pg-sep odv-pg-zoomsep" />

      <div className="odv-pg-grp odv-pg-zoomgrp">
        <button
          type="button"
          className="odv-pg-btn"
          onClick={onZoomOut}
          disabled={disabled || zoom <= MIN_ZOOM}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Icon d="M5 12h14" />
        </button>
        <button
          type="button"
          className="odv-pg-pct"
          onClick={onZoomReset}
          disabled={disabled}
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="odv-pg-btn"
          onClick={onZoomIn}
          disabled={disabled || zoom >= MAX_ZOOM}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Icon d="M12 5v14M5 12h14" />
        </button>
      </div>

      <span className="odv-pg-spacer" />

      <button
        type="button"
        className="odv-pg-mode"
        onClick={onToggleMode}
        disabled={disabled}
        title={
          viewMode === 'paged'
            ? 'Switch to continuous scrolling'
            : 'Switch to single page'
        }
      >
        {viewMode === 'paged' ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="6" y="3" width="12" height="18" rx="2" />
            </svg>
            <span className="odv-pg-modelabel">Single page</span>
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="5" y="4" width="14" height="6.5" rx="1.5" />
              <rect x="5" y="13.5" width="14" height="6.5" rx="1.5" />
            </svg>
            <span className="odv-pg-modelabel">Continuous</span>
          </>
        )}
      </button>
    </div>
  )
}

/** A 24×24 stroked-path icon used by the toolbar buttons. */
function Icon({ d }: { d: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

const TOOLBAR_CSS = `
.odv-pg-bar{display:flex;align-items:center;gap:4px;height:48px;flex:0 0 auto;padding:0 10px;
  background:#fff;border-bottom:1px solid #ececef;box-sizing:border-box;
  font:500 13px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#3a3a3c;
  -webkit-font-smoothing:antialiased;user-select:none}
.odv-pg-grp{display:flex;align-items:center;gap:2px}
.odv-pg-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;
  padding:0;border:0;border-radius:8px;background:transparent;color:#48484a;cursor:pointer;
  transition:background .12s ease,color .12s ease}
.odv-pg-btn:hover:not(:disabled){background:#f1f1f3;color:#1d1d1f}
.odv-pg-btn:active:not(:disabled){background:#e6e6ea}
.odv-pg-btn:disabled{opacity:.3;cursor:default}
.odv-pg-btn svg{width:18px;height:18px;display:block}
.odv-pg-pages{display:inline-flex;align-items:center;gap:7px;padding:0 4px}
.odv-pg-input{width:42px;height:30px;text-align:center;border:1px solid #dcdce0;border-radius:7px;
  font:600 13px/1 inherit;color:#1d1d1f;background:#fff;outline:none;box-sizing:border-box;
  font-variant-numeric:tabular-nums;transition:border-color .12s,box-shadow .12s;-moz-appearance:textfield}
.odv-pg-input::-webkit-outer-spin-button,.odv-pg-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.odv-pg-input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.18)}
.odv-pg-input:disabled{opacity:.5;background:#f5f5f7}
.odv-pg-total{color:#9a9aa0;white-space:nowrap;font-weight:500}
.odv-pg-pct{min-width:54px;height:30px;padding:0 8px;border:0;border-radius:7px;background:transparent;
  color:#48484a;cursor:pointer;font:600 13px/1 inherit;font-variant-numeric:tabular-nums;
  transition:background .12s}
.odv-pg-pct:hover:not(:disabled){background:#f1f1f3;color:#1d1d1f}
.odv-pg-pct:disabled{opacity:.4;cursor:default}
.odv-pg-sep{width:1px;height:22px;background:#ececef;margin:0 6px;flex:0 0 auto}
.odv-pg-spacer{flex:1 1 auto}
.odv-pg-mode{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;
  border:1px solid #dcdce0;border-radius:9px;background:#fff;color:#3a3a3c;cursor:pointer;
  font:600 13px/1 inherit;white-space:nowrap;transition:background .12s,border-color .12s,box-shadow .12s}
.odv-pg-mode:hover:not(:disabled){background:#f7f7f9;border-color:#cdced3}
.odv-pg-mode:active:not(:disabled){background:#eeeef1}
.odv-pg-mode:disabled{opacity:.4;cursor:default}
.odv-pg-mode svg{width:16px;height:16px;display:block;color:#6b6b70}
.odv-pg-stage{position:relative;overflow:auto;outline:none;display:flex;flex-direction:column;
  align-items:center;gap:14px;padding:18px;box-sizing:border-box;background:#f4f4f6;
  scroll-behavior:smooth}
.odv-pg-stage .pptx-preview-slide-wrapper,.odv-pg-stage .odv-pdf-page,.odv-pg-stage section{
  box-shadow:0 1px 3px rgba(0,0,0,.12),0 6px 16px rgba(0,0,0,.06)!important}

/* Adapt to the VIEWER's own width (container query), so it stays usable in a
   narrow column or on a phone. Progressively shed the least essential bits. */
@container odvpg (max-width: 560px){
  .odv-pg-modelabel{display:none}
  .odv-pg-mode{padding:0 9px;gap:0}
}
@container odvpg (max-width: 440px){
  .odv-pg-zoomgrp,.odv-pg-zoomsep{display:none}
  .odv-pg-stage{padding:10px;gap:10px}
}
@container odvpg (max-width: 340px){
  .odv-pg-bar{gap:2px;padding:0 6px}
  .odv-pg-mode{display:none}
}
/* Fallback for browsers without container queries: key off the viewport. */
@media (max-width: 560px){
  .odv-pg-modelabel{display:none}
}
`

let toolbarStylesInjected = false
/** Inject the toolbar stylesheet once per document. */
function useToolbarStyles(): void {
  useEffect(() => {
    if (toolbarStylesInjected || typeof document === 'undefined') return
    const el = document.createElement('style')
    el.id = 'odv-pg-styles'
    el.textContent = TOOLBAR_CSS
    document.head.appendChild(el)
    toolbarStylesInjected = true
  }, [])
}

function DefaultLoading(): JSX.Element {
  return (
    <div style={{ padding: 16, color: '#666', fontFamily: 'system-ui, sans-serif' }}>
      Loading document…
    </div>
  )
}

function DefaultError({ error }: { error: Error }): JSX.Element {
  return (
    <div
      role="alert"
      style={{
        padding: 16,
        color: '#b00020',
        fontFamily: 'system-ui, sans-serif',
        whiteSpace: 'pre-wrap',
      }}
    >
      Could not display document: {error.message}
    </div>
  )
}
