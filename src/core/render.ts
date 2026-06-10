import { detect } from './detect'
import { normalizeSource } from './source'
import { type DocType, type Renderer, type RenderOptions, type RenderResult } from './types'

/**
 * Lazy per-format loaders. Each renderer (and its heavy engine) is only
 * imported the first time that format is actually rendered, so a consumer who
 * only ever shows PDFs never ships the SheetJS or PPTX code.
 */
const RENDERER_LOADERS: Record<DocType, () => Promise<{ render: Renderer }>> = {
  pdf: () => import('./renderers/pdf'),
  docx: () => import('./renderers/docx'),
  xlsx: () => import('./renderers/xlsx'),
  pptx: () => import('./renderers/pptx'),
}

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
  const { container, source, type, signal, onError } = options
  try {
    assertBrowser()
    if (!container) throw new Error('`container` is required.')

    const { bytes, filename } = await normalizeSource(source, signal)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const docType = detect({ bytes, filename, override: type })
    const { render } = await RENDERER_LOADERS[docType]()
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // Clear any previous content before drawing.
    container.replaceChildren()

    return await render({ container, bytes, options, signal })
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    onError?.(error)
    throw error
  }
}
