import type { ThumbnailProvider } from '../../types'

export interface PdfThumbnailContext {
  pdf: any
  numPages: number
  rotation: () => number
  signal?: AbortSignal
}

/**
 * Thumbnails rasterized by pdf.js at the requested width. Renders one at a
 * time (never competing with the main render), keeps an LRU of bitmaps, and
 * always returns a fresh element (a copy of the cached bitmap).
 */
export function createPdfThumbnailProvider(ctx: PdfThumbnailContext): ThumbnailProvider {
  const cache = new Map<string, HTMLCanvasElement>()
  const MAX = 40
  let queue: Promise<unknown> = Promise.resolve()

  async function raster(index: number, width: number): Promise<HTMLCanvasElement> {
    const rotation = ctx.rotation()
    const key = `${index}:${width}:${rotation}`
    const hit = cache.get(key)
    if (hit) {
      cache.delete(key)
      cache.set(key, hit)
      return hit
    }
    const page = await ctx.pdf.getPage(index + 1)
    const base = page.getViewport({ scale: 1, rotation })
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
    const viewport = page.getViewport({ scale: width / base.width, rotation })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width * dpr))
    canvas.height = Math.max(1, Math.floor(viewport.height * dpr))
    const ctx2d = canvas.getContext('2d')
    if (ctx2d) {
      await page.render({
        canvasContext: ctx2d,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise
    }
    page.cleanup()
    cache.set(key, canvas)
    while (cache.size > MAX) cache.delete(cache.keys().next().value as string)
    return canvas
  }

  return {
    count: ctx.numPages,
    async render(index, { width }) {
      const task = queue.then(() => raster(index, width))
      queue = task.catch(() => {})
      const src = await task
      const el = document.createElement('div')
      el.style.width = `${width}px`
      const copy = document.createElement('canvas')
      copy.width = src.width
      copy.height = src.height
      copy.style.display = 'block'
      copy.style.width = '100%'
      copy.style.height = 'auto'
      copy.getContext('2d')?.drawImage(src, 0, 0)
      el.appendChild(copy)
      return el
    },
    destroy() {
      cache.clear()
    },
  }
}
