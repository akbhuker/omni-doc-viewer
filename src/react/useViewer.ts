import { useEffect, useRef, useState, type RefObject } from 'react'
import { createViewer, initialViewerState } from '../core/viewer/controller'
import type { ViewerController, ViewerState, ViewMode } from '../core/viewer/types'
import type {
  AnyDocType,
  DocSource,
  FetchOptions,
  RendererLoader,
  RendererRegistration,
  RenderMeta,
  RenderTuning,
  RenderWarning,
} from '../core/types'

export interface UseViewerInput extends RenderTuning {
  hostRef: RefObject<HTMLElement | null>
  stageRef: RefObject<HTMLElement | null>
  source: DocSource
  type?: AnyDocType
  renderers?: Record<string, RendererLoader | RendererRegistration>
  fallback?: AnyDocType | RendererLoader
  fetchOptions?: FetchOptions
  pagination: boolean
  initialViewMode: ViewMode
  onLoad?: (meta: RenderMeta) => void
  onError?: (error: Error) => void
  onWarning?: (warning: RenderWarning) => void
  onPageChange?: (page: number, total: number) => void
  onProgress?: (loaded: number, total?: number) => void
  theme?: 'light' | 'dark' | 'auto'
  initialZoom?: number | 'fit-width' | 'auto'
  gestures?: boolean
}

/** Always-current ref to a value (safe to read from async callbacks). */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

/**
 * Serialize per-format tuning by VALUE so a fresh object literal on every
 * render (`pdf={{ scale: 2 }}`) doesn't reload the document, while a real
 * change (e.g. `textLayer: false`) does. Functions are excluded.
 */
export function tuningKey(tuning: RenderTuning): string {
  return JSON.stringify(tuning, (_k, v) => (typeof v === 'function' ? undefined : v))
}

/**
 * Owns a {@link ViewerController} for a component: creates it once the host
 * element exists (re-creating only when the DOM shape changes, i.e.
 * `pagination` flips), loads whenever the source or tuning VALUES change, and
 * mirrors its state into React.
 */
export function useViewer(input: UseViewerInput): {
  controllerRef: RefObject<ViewerController | null>
  state: ViewerState
} {
  const { hostRef, stageRef, source, type, pagination, initialViewMode, theme, initialZoom, gestures } = input
  const controllerRef = useRef<ViewerController | null>(null)
  const createdFor = useRef<{ pagination: boolean } | null>(null)
  const [state, setState] = useState<ViewerState>(() =>
    initialViewerState({ initialViewMode }),
  )

  const latest = useLatest(input)
  const key = tuningKey({ pdf: input.pdf, pptx: input.pptx, docx: input.docx, csv: input.csv, xlsx: input.xlsx, html: input.html })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let controller = controllerRef.current
    if (!controller || createdFor.current?.pagination !== pagination) {
      const previous = controller
      controller = createViewer({
        host,
        scrollElement: stageRef.current ?? undefined,
        pagination,
        initialViewMode,
        initialZoom: previous ? previous.getState().zoom : initialZoom,
        gestures,
        onLoad: (m) => latest.current.onLoad?.(m),
        onError: (e) => latest.current.onError?.(e),
        onWarning: (w) => latest.current.onWarning?.(w),
        onPageChange: (p, t) => latest.current.onPageChange?.(p, t),
        onProgress: (l, t) => latest.current.onProgress?.(l, t),
      })
      previous?.destroy()
      controllerRef.current = controller
      createdFor.current = { pagination }
      controller.subscribe(setState)
    }
    const { pdf, pptx, docx, csv, xlsx, html, fetchOptions, theme, renderers, fallback } = latest.current
    controller
      .load(source, { type, pdf, pptx, docx, csv, xlsx, html, fetchOptions, theme, renderers, fallback })
      .catch(() => {
      /* surfaced through state + onError */
    })
    // `key` stands in for pdf/pptx/docx (compared by value); callbacks are read via `latest`.
    // initialZoom/gestures are read when the controller is created.
  }, [hostRef, stageRef, source, type, key, pagination, initialViewMode, theme, initialZoom, gestures, latest])

  useEffect(
    () => () => {
      controllerRef.current?.destroy()
      controllerRef.current = null
      createdFor.current = null
    },
    [],
  )

  return { controllerRef, state }
}
