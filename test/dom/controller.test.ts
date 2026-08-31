import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeRenderDocument } from '../helpers/fake-render'

const fake = createFakeRenderDocument({ pages: 3, width: 800, height: 1000 })
vi.mock('../../src/core/render', () => ({
  renderDocument: (...args: unknown[]) => (fake.impl as any)(...args),
}))

import { createViewer } from '../../src/core/viewer/controller'
import type { ViewerController, ViewerState } from '../../src/core/viewer/types'

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

function mount(pagination = true) {
  const scroller = document.createElement('div')
  Object.defineProperty(scroller, 'clientWidth', { value: 636, configurable: true })
  Object.defineProperty(scroller, 'clientHeight', { value: 500, configurable: true })
  scroller.scrollTo = vi.fn() as any
  const host = document.createElement('div')
  scroller.appendChild(host)
  document.body.appendChild(scroller)
  return { scroller, host, pagination }
}

let viewer: ViewerController | undefined
beforeEach(() => {
  fake.impl.mockClear()
  fake.destroy.mockClear()
  viewer?.destroy()
  viewer = undefined
})

describe('createViewer — loading', () => {
  it('loads a document, exposes pages/state and notifies subscribers + onLoad', async () => {
    const { host, scroller } = mount()
    const onLoad = vi.fn()
    const states: ViewerState[] = []
    viewer = createViewer({ host, scrollElement: scroller, pagination: true, onLoad })
    viewer.subscribe((s) => states.push(s))

    expect(viewer.getState().status).toBe('idle')
    const result = await viewer.load(bytes, { type: 'pdf' })

    expect(result.pages).toHaveLength(3)
    expect(viewer.getState()).toMatchObject({ status: 'loaded', page: 1, pageCount: 3, type: 'pdf' })
    expect(onLoad).toHaveBeenCalledWith({ type: 'pdf', pageCount: 3 })
    expect(states.some((s) => s.status === 'loading')).toBe(true)
    expect(states.at(-1)?.status).toBe('loaded')
    // Each notification is a fresh object (React can compare by reference).
    expect(new Set(states).size).toBe(states.length)
  })

  it('reports errors through state and onError', async () => {
    const { host, scroller } = mount()
    const onError = vi.fn()
    fake.impl.mockRejectedValueOnce(new Error('boom'))
    viewer = createViewer({ host, scrollElement: scroller, onError })
    await expect(viewer.load(bytes)).rejects.toThrow('boom')
    expect(viewer.getState().status).toBe('error')
    expect(viewer.getState().error?.message).toBe('boom')
    expect(onError).toHaveBeenCalledOnce()
  })

  it('destroys the previous result when a new source is loaded, and everything on destroy()', async () => {
    const { host, scroller } = mount()
    viewer = createViewer({ host, scrollElement: scroller })
    await viewer.load(bytes)
    await viewer.load(new Uint8Array([1, 2, 3]), { type: 'text' })
    expect(fake.destroy).toHaveBeenCalledTimes(1)
    viewer.destroy()
    expect(fake.destroy).toHaveBeenCalledTimes(2)
    expect(viewer.getState().status).toBe('idle')
  })

  it('forwards download progress to state and onProgress', async () => {
    const { host, scroller } = mount()
    const onProgress = vi.fn()
    fake.impl.mockImplementationOnce(async (options) => {
      options.onProgress?.(10, 100)
      return { type: 'pdf', meta: { type: 'pdf', pageCount: 1 }, pages: [], destroy: () => {} }
    })
    viewer = createViewer({ host, scrollElement: scroller, onProgress })
    await viewer.load(bytes)
    expect(onProgress).toHaveBeenCalledWith(10, 100)
  })
})

describe('createViewer — navigation', () => {
  it('goToPage clamps, toggles page visibility in paged mode and fires onPageChange', async () => {
    const { host, scroller } = mount()
    const onPageChange = vi.fn()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true, initialViewMode: 'paged', onPageChange })
    const r = await viewer.load(bytes)
    expect(onPageChange).toHaveBeenLastCalledWith(1, 3)

    viewer.goToPage(2)
    expect(viewer.getPage()).toBe(2)
    expect(r.pages![0]!.style.display).toBe('none')
    expect(r.pages![1]!.style.display).toBe('')
    expect(onPageChange).toHaveBeenLastCalledWith(2, 3)

    viewer.goToPage(99)
    expect(viewer.getPage()).toBe(3)
    viewer.prevPage()
    expect(viewer.getPage()).toBe(2)
    viewer.nextPage()
    viewer.nextPage()
    expect(viewer.getPage()).toBe(3)
    expect(viewer.getPageCount()).toBe(3)
  })

  it('shows all pages in continuous mode', async () => {
    const { host, scroller } = mount()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true, initialViewMode: 'continuous' })
    const r = await viewer.load(bytes)
    viewer.goToPage(2)
    expect(r.pages!.every((p) => p.style.display === '')).toBe(true)
    viewer.toggleViewMode()
    expect(viewer.getState().viewMode).toBe('paged')
    expect(r.pages![0]!.style.display).toBe('none')
  })

  it('handles keyboard navigation and reports whether it consumed the key', async () => {
    const { host, scroller } = mount()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true })
    await viewer.load(bytes)
    const key = (k: string) => new KeyboardEvent('keydown', { key: k, cancelable: true })
    expect(viewer.handleKeyDown(key('ArrowRight'))).toBe(true)
    expect(viewer.getPage()).toBe(2)
    expect(viewer.handleKeyDown(key('End'))).toBe(true)
    expect(viewer.getPage()).toBe(3)
    expect(viewer.handleKeyDown(key('Home'))).toBe(true)
    expect(viewer.getPage()).toBe(1)
    expect(viewer.handleKeyDown(key('a'))).toBe(false)
  })
})

describe('createViewer — zoom & rotation', () => {
  it('zooms in steps within the limits and applies CSS zoom to the host', async () => {
    const { host, scroller } = mount()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true })
    await viewer.load(bytes)
    viewer.zoomIn()
    expect(viewer.getState().zoom).toBe(1.2)
    expect(host.style.getPropertyValue('zoom')).toBe('1.2')
    viewer.setZoom(10)
    expect(viewer.getState().zoom).toBe(4)
    viewer.setZoom(0)
    expect(viewer.getState().zoom).toBe(0.25)
    viewer.resetZoom()
    expect(viewer.getState().zoom).toBe(1)
  })

  it('fitWidth uses the canvas pixel width so the page fills the scroller', async () => {
    const { host, scroller } = mount()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true })
    await viewer.load(bytes)
    viewer.fitWidth() // (636 - 36) / 800
    expect(viewer.getState().zoom).toBe(0.75)
  })

  it('rotate is a no-op without native support and calls result.rotate when available', async () => {
    const { host, scroller } = mount()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true })
    await viewer.load(bytes)
    expect(viewer.getState().capabilities.rotate).toBe(false)
    viewer.rotate()
    expect(viewer.getState().rotation).toBe(0)

    const rotate = vi.fn(async () => {})
    fake.impl.mockImplementationOnce(async (options) => {
      const r = await fake.impl.getMockImplementation()!(options)
      return { ...r, rotate }
    })
    await viewer.load(new Uint8Array([9]), { type: 'pdf' })
    expect(viewer.getState().capabilities.rotate).toBe(true)
    viewer.rotate()
    expect(viewer.getState().rotation).toBe(90)
    viewer.rotate(-90)
    viewer.rotate(-90)
    expect(viewer.getState().rotation).toBe(270)
    expect(rotate).toHaveBeenLastCalledWith(270)
  })
})

describe('createViewer — actions', () => {
  it('download builds a same-origin blob from the rendered bytes', async () => {
    const { host, scroller } = mount()
    const clicks: string[] = []
    const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(`${this.getAttribute('download')}|${this.href}`)
    })
    viewer = createViewer({ host, scrollElement: scroller })
    await viewer.load('https://cdn.example.com/a/report.pdf?x=1')
    viewer.download()
    expect(clicks[0]).toMatch(/^report\.pdf\|blob:/)
    viewer.download('renamed.pdf')
    expect(clicks[1]).toMatch(/^renamed\.pdf\|blob:/)
    spy.mockRestore()
  })
})

describe('createViewer — crisp zoom via result.setScale', () => {
  it('re-rasterizes at base × zoom after a short debounce and resets CSS zoom to 1', async () => {
    vi.useFakeTimers()
    try {
      const { host, scroller } = mount()
      const setScale = vi.fn(async () => {})
      fake.impl.mockImplementationOnce(async (options) => {
        const r = await fake.impl.getMockImplementation()!(options)
        return { ...r, setScale }
      })
      viewer = createViewer({ host, scrollElement: scroller, pagination: true, pdf: { scale: 1.5 } })
      await viewer.load(bytes, { type: 'pdf' })
      expect(viewer.getState().capabilities.rescale).toBe(true)

      viewer.setZoom(2)
      // Immediately: CSS zoom gives instant feedback.
      expect(host.style.getPropertyValue('zoom')).toBe('2')
      expect(setScale).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(200)
      expect(setScale).toHaveBeenCalledWith(3) // 1.5 × 2
      // After the re-raster the layout is natively 2× so CSS zoom returns to 1.
      expect(host.style.getPropertyValue('zoom')).toBe('1')
      expect(viewer.getState().zoom).toBe(2)

      // fitWidth stays zoom-independent: the canvas is now 2× wider natively.
      const canvas = host.querySelector('canvas')!
      canvas.width = 1600
      viewer.fitWidth() // (636-36) / (1600 / 2) = 0.75
      await vi.advanceTimersByTimeAsync(200)
      expect(viewer.getState().zoom).toBe(0.75)
      expect(setScale).toHaveBeenLastCalledWith(1.13) // 1.5 × 0.75, 2 decimals
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('createViewer — search', () => {
  it('drives the renderer search provider and navigates to the active match', async () => {
    const { host, scroller } = mount()
    const el1 = document.createElement('span')
    const el2 = document.createElement('span')
    const provider = {
      search: vi.fn(async (q: string) => ({
        query: q,
        total: 2,
        matches: [
          { page: 1, locator: 0 },
          { page: 3, locator: 1 },
        ],
      })),
      select: vi.fn(async (i: number) => ({ page: i === 0 ? 1 : 3, element: i === 0 ? el1 : el2 })),
      clear: vi.fn(),
    }
    fake.impl.mockImplementationOnce(async (options) => {
      const r = await fake.impl.getMockImplementation()!(options)
      r.pages![0]!.appendChild(el1)
      r.pages![2]!.appendChild(el2)
      return { ...r, search: provider }
    })
    viewer = createViewer({ host, scrollElement: scroller, pagination: true, initialViewMode: 'paged' })
    await viewer.load(bytes, { type: 'pdf' })
    expect(viewer.getState().capabilities.search).toBe(true)

    const total = await viewer.search('fox')
    expect(total).toBe(2)
    expect(viewer.getState().search).toMatchObject({ query: 'fox', status: 'done', total: 2, current: 1 })
    expect(provider.select).toHaveBeenLastCalledWith(0)
    expect(viewer.getPage()).toBe(1)

    await viewer.findNext()
    expect(viewer.getState().search.current).toBe(2)
    expect(viewer.getPage()).toBe(3) // paged mode: jumped to the match's page
    await viewer.findNext() // wraps around
    expect(viewer.getState().search.current).toBe(1)
    await viewer.findPrev()
    expect(viewer.getState().search.current).toBe(2)

    viewer.clearSearch()
    expect(provider.clear).toHaveBeenCalled()
    expect(viewer.getState().search).toMatchObject({ query: '', total: 0, current: 0, status: 'idle' })
  })

  it('resolves 0 and marks the capability false when the renderer has no search', async () => {
    const { host, scroller } = mount()
    viewer = createViewer({ host, scrollElement: scroller })
    await viewer.load(bytes)
    expect(viewer.getState().capabilities.search).toBe(false)
    expect(await viewer.search('x')).toBe(0)
  })
})

describe('createViewer — touch & trackpad gestures', () => {
  function pointer(type: string, id: number, x: number, y: number): PointerEvent {
    return new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch' })
  }

  it('zooms with ctrl/cmd + wheel (trackpad pinch) and keeps the browser from zooming the page', async () => {
    const { host, scroller } = mount()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true, gestures: true })
    await viewer.load(bytes)
    // happy-dom ignores ctrlKey in WheelEventInit; set it explicitly.
    const ctrlWheel = (deltaY: number) => {
      const ev = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
      Object.defineProperty(ev, 'ctrlKey', { value: true })
      return ev
    }
    const e = ctrlWheel(-100)
    scroller.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    expect(viewer.getState().zoom).toBeGreaterThan(1)
    const before = viewer.getState().zoom
    scroller.dispatchEvent(ctrlWheel(100))
    expect(viewer.getState().zoom).toBeLessThan(before)
    // Plain wheel scrolls; it must not zoom.
    const plain = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })
    const z = viewer.getState().zoom
    scroller.dispatchEvent(plain)
    expect(plain.defaultPrevented).toBe(false)
    expect(viewer.getState().zoom).toBe(z)
  })

  it('pinch-zooms with two pointers', async () => {
    const { host, scroller } = mount()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true, gestures: true })
    await viewer.load(bytes)
    scroller.dispatchEvent(pointer('pointerdown', 1, 100, 100))
    scroller.dispatchEvent(pointer('pointerdown', 2, 200, 100)) // distance 100
    scroller.dispatchEvent(pointer('pointermove', 2, 300, 100)) // distance 200 → ×2
    expect(viewer.getState().zoom).toBe(2)
    scroller.dispatchEvent(pointer('pointerup', 2, 300, 100))
    scroller.dispatchEvent(pointer('pointerup', 1, 100, 100))
    expect(scroller.style.touchAction).toBe('pan-x pan-y')
  })

  it('swipes between pages in paged mode', async () => {
    const { host, scroller } = mount()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true, initialViewMode: 'paged', gestures: true })
    await viewer.load(bytes)
    scroller.dispatchEvent(pointer('pointerdown', 1, 300, 200))
    scroller.dispatchEvent(pointer('pointermove', 1, 200, 205))
    scroller.dispatchEvent(pointer('pointerup', 1, 180, 205)) // left swipe → next page
    expect(viewer.getPage()).toBe(2)
    scroller.dispatchEvent(pointer('pointerdown', 1, 100, 200))
    scroller.dispatchEvent(pointer('pointerup', 1, 260, 200)) // right swipe → previous page
    expect(viewer.getPage()).toBe(1)
    // Mostly-vertical drags are scrolling, not swipes.
    scroller.dispatchEvent(pointer('pointerdown', 1, 100, 100))
    scroller.dispatchEvent(pointer('pointerup', 1, 130, 300))
    expect(viewer.getPage()).toBe(1)
  })

  it('does not attach gestures unless enabled, and removes them on destroy', async () => {
    const { host, scroller } = mount()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true })
    await viewer.load(bytes)
    const ev = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'ctrlKey', { value: true })
    scroller.dispatchEvent(ev)
    expect(viewer.getState().zoom).toBe(1)
  })
})

describe('createViewer — mobile defaults', () => {
  it("initialZoom: 'fit-width' fits the first page once loaded", async () => {
    const { host, scroller } = mount() // clientWidth 636 → (636-36)/800
    viewer = createViewer({ host, scrollElement: scroller, pagination: true, initialZoom: 'fit-width' })
    await viewer.load(bytes)
    expect(viewer.getState().zoom).toBe(0.75)
  })

  it("initialZoom: 'auto' fits width only in narrow containers", async () => {
    const narrow = mount()
    Object.defineProperty(narrow.scroller, 'clientWidth', { value: 400, configurable: true })
    viewer = createViewer({ host: narrow.host, scrollElement: narrow.scroller, pagination: true, initialZoom: 'auto' })
    await viewer.load(bytes)
    expect(viewer.getState().zoom).toBe(0.46) // (400-36)/800 → 0.455 → 0.46
    viewer.destroy()

    const wide = mount()
    Object.defineProperty(wide.scroller, 'clientWidth', { value: 1200, configurable: true })
    viewer = createViewer({ host: wide.host, scrollElement: wide.scroller, pagination: true, initialZoom: 'auto' })
    await viewer.load(bytes)
    expect(viewer.getState().zoom).toBe(1)
  })
})

describe('createViewer — per-format capabilities', () => {
  it('marks single-page media as not paged/zoomable/printable so the toolbar can hide those controls', async () => {
    const { host, scroller } = mount()
    fake.impl.mockImplementationOnce(async (options) => {
      const r = await fake.impl.getMockImplementation()!(options)
      return { ...r, type: 'video', meta: { type: 'video', pageCount: 1 }, pages: undefined, search: undefined }
    })
    viewer = createViewer({ host, scrollElement: scroller, pagination: true, gestures: true })
    await viewer.load(bytes, { type: 'video' })
    const caps = viewer.getState().capabilities
    expect(caps).toMatchObject({ paged: false, zoom: false, print: false, thumbnails: false, search: false, rotate: false })
    viewer.zoomIn() // no-op when zoom is unsupported
    expect(viewer.getState().zoom).toBe(1)
  })

  it('keeps paged/zoom/print for multi-page documents', async () => {
    const { host, scroller } = mount()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true })
    await viewer.load(bytes, { type: 'pdf' })
    expect(viewer.getState().capabilities).toMatchObject({ paged: true, zoom: true, print: true })
  })

  it('treats a single-page image as zoomable but not paged', async () => {
    const { host, scroller } = mount()
    fake.impl.mockImplementationOnce(async (options) => {
      const r = await fake.impl.getMockImplementation()!(options)
      return { ...r, type: 'image', meta: { type: 'image', pageCount: 1 }, pages: r.pages!.slice(0, 1) }
    })
    viewer = createViewer({ host, scrollElement: scroller, pagination: true })
    await viewer.load(bytes, { type: 'image' })
    expect(viewer.getState().capabilities).toMatchObject({ paged: false, zoom: true, print: true, rotate: true })
  })
})
