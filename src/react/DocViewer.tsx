'use client'

import {
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
  className?: string
  style?: CSSProperties
}

type Status = 'loading' | 'loaded' | 'error'

/**
 * Client-side document viewer for PDF / DOCX / XLSX / PPTX.
 *
 * SSR-safe: rendering is deferred to a layout effect, so it is inert on the
 * server. In Next.js App Router this works in a Client Component; if you hit a
 * bundler/SSR edge, wrap it with `dynamic(() => import(...), { ssr: false })`.
 */
export function DocViewer({
  source,
  type,
  loading,
  errorFallback,
  onLoad,
  onError,
  className,
  style,
  pdf,
  pptx,
}: DocViewerProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let result: RenderResult | null = null
    let cancelled = false
    const controller = new AbortController()

    setStatus('loading')
    setError(null)

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

  return (
    <div
      className={className}
      style={{ position: 'relative', minHeight: status === 'loaded' ? undefined : 120, ...style }}
    >
      {/* The host stays in the layout (so renderers can measure its real
          width — e.g. PPTX); we only fade it in once loaded. */}
      <div
        ref={hostRef}
        style={{ width: '100%', opacity: status === 'loaded' ? 1 : 0 }}
      />
      {status !== 'loaded' && (
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
      )}
    </div>
  )
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
