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

  const pages: HTMLElement[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (signal?.aborted) break
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.className = 'odv-pdf-page'
    canvas.style.maxWidth = '100%'
    canvas.style.height = 'auto'
    canvas.style.boxShadow = '0 1px 4px rgba(0,0,0,0.18)'
    // Render at device-pixel resolution for crispness, display at CSS size.
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)
    canvas.style.width = `${Math.floor(viewport.width)}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get a 2D canvas context for PDF rendering.')
    wrapper.appendChild(canvas)
    pages.push(canvas)

    await page.render({
      canvasContext: ctx,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    }).promise
    page.cleanup()
  }

  return {
    type: 'pdf',
    meta: { type: 'pdf', pageCount: pdf.numPages },
    pages,
    destroy() {
      try {
        pdf.destroy()
        loadingTask.destroy?.()
      } catch {
        /* ignore */
      }
      container.replaceChildren()
    },
  }
}
