import { detect } from './detect'
import { detectionRegistry, resolveRendererLoader } from './registry'
import { normalizeSource } from './source'
import { setStyleNonce } from './styles'
import { applyTheme } from './theme'
import {
  type AnyDocType,
  FormatDetectionError,
  type RenderOptions,
  type RenderResult,
  type RenderWarning,
  UnsupportedFormatError,
} from './types'

function assertBrowser(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(
      'omni-doc-viewer renders in the browser only. On the server, defer rendering to ' +
        'the client (e.g. Next.js `dynamic(() => import(...), { ssr: false })`).',
    )
  }
}

/**
 * Render a document into a container element, fully client-side.
 *
 * Detects the format (override > extension > magic bytes), lazy-loads the
 * matching engine, and renders. Returns a handle whose `destroy()` tears
 * everything down.
 *
 * @example
 * const view = await renderDocument({ container, source: file })
 * // ...later
 * view.destroy()
 */
export async function renderDocument(options: RenderOptions): Promise<RenderResult> {
  const { container, source, type, signal, onError, fetchOptions, onProgress } = options
  try {
    assertBrowser()
    if (!container) throw new Error('`container` is required.')
    if (options.styleNonce) setStyleNonce(options.styleNonce)
    if (options.theme) applyTheme(container, options.theme)

    const { bytes, filename, mime } = await normalizeSource(source, {
      signal,
      fetchOptions,
      onProgress,
    })
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    let docType: AnyDocType
    let renderers = options.renderers
    try {
      docType = detect({ bytes, filename, mime, override: type, registry: detectionRegistry(renderers) })
    } catch (err) {
      if (!(err instanceof FormatDetectionError) || options.fallback === undefined) throw err
      if (typeof options.fallback === 'function') {
        renderers = { ...renderers, __fallback: options.fallback }
        docType = '__fallback'
      } else docType = options.fallback
    }
    const loader = resolveRendererLoader(docType, renderers)
    if (!loader) {
      throw new UnsupportedFormatError(`No renderer is registered for type "${docType}".`, docType)
    }
    const { render } = await loader()
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // Clear any previous content before drawing.
    container.replaceChildren()

    const warn = (w: Omit<RenderWarning, 'format'> & { format?: AnyDocType }): void => {
      options.onWarning?.({ ...w, format: w.format ?? docType })
    }
    const result = await render({ container, bytes, type: docType, filename, mime, options, signal, warn })
    // Keep the rendered bytes on the handle so download/print never need to
    // re-fetch (or hit cross-origin restrictions on the original URL).
    return Object.assign(result, { bytes, filename })
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    onError?.(error)
    throw error
  }
}
