import { vi, type Mock } from 'vitest'
import type { RenderOptions, RenderResult } from '../../src/core/types'
import { filenameFromUrl } from '../../src/core/viewer/download'

export interface FakeRenderOptions {
  pages?: number
  width?: number
  height?: number
  type?: RenderResult['type']
  /** Reject instead of resolving. */
  error?: Error
}

/**
 * Builds a `renderDocument` stand-in that synchronously fills the container
 * with N page elements and resolves a RenderResult, so component tests can
 * exercise navigation, zoom and actions without a real engine.
 */
export interface FakeRenderDocument {
  impl: Mock<(options: RenderOptions) => Promise<RenderResult>>
  destroy: Mock<() => void>
}

export function createFakeRenderDocument(opts: FakeRenderOptions = {}): FakeRenderDocument {
  const { pages = 3, width = 800, height = 1000, type = 'pdf', error } = opts
  const destroy = vi.fn()
  const impl = vi.fn(async (options: RenderOptions): Promise<RenderResult> => {
    if (error) throw error
    options.container.replaceChildren()
    const els: HTMLElement[] = []
    for (let i = 0; i < pages; i++) {
      const el = document.createElement('div')
      el.className = 'fake-page'
      el.dataset.page = String(i + 1)
      el.style.width = `${width}px`
      el.style.height = `${height}px`
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      el.appendChild(canvas)
      options.container.appendChild(el)
      els.push(el)
    }
    // Mirror renderDocument(): the handle carries the bytes + filename hint.
    const src = options.source
    const filename =
      typeof src === 'string'
        ? filenameFromUrl(src)
        : typeof File !== 'undefined' && src instanceof File
          ? src.name
          : undefined
    return {
      type,
      meta: { type, pageCount: pages },
      pages: els,
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      filename,
      destroy,
    }
  })
  return { impl, destroy }
}
