import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeRenderDocument } from '../helpers/fake-render'
import { intersectionObservers } from '../setup.dom'

const fake = createFakeRenderDocument({ pages: 3, width: 800, height: 1000 })
vi.mock('../../src/core/render', () => ({
  renderDocument: (...args: unknown[]) => (fake.impl as any)(...args),
}))

import { createViewer } from '../../src/core/viewer/controller'
import { createThumbnailStrip } from '../../src/core/viewer/thumbnails'
import type { ViewerController } from '../../src/core/viewer/types'

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])
let viewer: ViewerController | undefined

function mount() {
  const scroller = document.createElement('div')
  Object.defineProperty(scroller, 'clientWidth', { value: 636, configurable: true })
  scroller.scrollTo = vi.fn() as any
  const host = document.createElement('div')
  scroller.appendChild(host)
  const aside = document.createElement('aside')
  document.body.append(scroller, aside)
  return { scroller, host, aside }
}

beforeEach(() => {
  fake.impl.mockClear()
  viewer?.destroy()
  intersectionObservers.length = 0
})

describe('createThumbnailStrip', () => {
  it('builds one button per page, renders lazily, and follows/drives the current page', async () => {
    const { scroller, host, aside } = mount()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true })
    await viewer.load(bytes, { type: 'pdf' })
    expect(viewer.getState().capabilities.thumbnails).toBe(true)

    const strip = createThumbnailStrip(viewer, { container: aside, width: 120 })
    const buttons = aside.querySelectorAll<HTMLButtonElement>('button.odv-thumb')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]!.getAttribute('aria-label')).toBe('Page 1')
    expect(buttons[0]!.getAttribute('aria-current')).toBe('page')
    // Nothing is rendered until a thumbnail nears the viewport.
    expect(aside.querySelector('.odv-thumb-content')).toBeNull()

    const io = intersectionObservers.at(-1)!
    io.trigger(buttons[0]!, true)
    await vi.waitFor(() => expect(buttons[0]!.querySelector('.odv-thumb-content')).not.toBeNull())
    // Generic fallback: a scaled clone of the page (the fake page has a canvas).
    expect(buttons[0]!.querySelector('.odv-thumb-content canvas')).not.toBeNull()

    buttons[2]!.click()
    expect(viewer.getPage()).toBe(3)
    expect(buttons[2]!.getAttribute('aria-current')).toBe('page')
    expect(buttons[0]!.getAttribute('aria-current')).toBeNull()

    strip.destroy()
    expect(aside.childElementCount).toBe(0)
  })

  it('uses the renderer\'s thumbnail provider when available', async () => {
    const { scroller, host, aside } = mount()
    const render = vi.fn(async (_i: number, { width }: { width: number }) => {
      const img = document.createElement('img')
      img.width = width
      return img
    })
    fake.impl.mockImplementationOnce(async (options) => {
      const r = await fake.impl.getMockImplementation()!(options)
      return { ...r, thumbnails: { count: 3, render } }
    })
    viewer = createViewer({ host, scrollElement: scroller, pagination: true })
    await viewer.load(bytes, { type: 'pdf' })
    createThumbnailStrip(viewer, { container: aside, width: 100 })
    const buttons = aside.querySelectorAll<HTMLButtonElement>('button.odv-thumb')
    intersectionObservers.at(-1)!.trigger(buttons[1]!, true)
    await vi.waitFor(() => expect(buttons[1]!.querySelector('img')).not.toBeNull())
    expect(render).toHaveBeenCalledWith(1, expect.objectContaining({ width: 100 }))
  })

  it('rebuilds when a new document loads', async () => {
    const { scroller, host, aside } = mount()
    viewer = createViewer({ host, scrollElement: scroller, pagination: true })
    await viewer.load(bytes, { type: 'pdf' })
    createThumbnailStrip(viewer, { container: aside })
    expect(aside.querySelectorAll('button.odv-thumb')).toHaveLength(3)
    fake.impl.mockImplementationOnce(async (options) => {
      const r = await fake.impl.getMockImplementation()!(options)
      return { ...r, pages: r.pages!.slice(0, 1), meta: { type: 'pdf', pageCount: 1 } }
    })
    await viewer.load(new Uint8Array([1]), { type: 'pdf' })
    expect(aside.querySelectorAll('button.odv-thumb')).toHaveLength(1)
  })
})
