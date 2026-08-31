import { describe, it, expect, afterEach } from 'vitest'
import { renderDocument, createViewer, createThumbnailStrip } from '../../src/core'
import type { RenderResult, ViewerController } from '../../src/core'
import deckUrl from '../fixtures/generated/deck-4x3.pptx?url'

let result: RenderResult | undefined
let viewer: ViewerController | undefined
let root: HTMLDivElement
afterEach(() => {
  result?.destroy()
  viewer?.destroy()
  root?.remove()
})

async function until(cond: () => boolean, timeout = 10_000): Promise<void> {
  const start = performance.now()
  while (!cond()) {
    if (performance.now() - start > timeout) throw new Error('timeout')
    await new Promise((r) => setTimeout(r, 50))
  }
}

describe('pptx: 4:3 decks', () => {
  it('renders slides with the deck\'s own aspect ratio, not a forced 16:9 box', async () => {
    root = document.createElement('div')
    root.style.width = '800px'
    document.body.appendChild(root)
    result = await renderDocument({ container: root, source: deckUrl })
    expect(result.meta.pageCount).toBe(3)
    const slide = result.pages![0]!.getBoundingClientRect()
    expect(Math.abs(slide.height / slide.width - 0.75)).toBeLessThan(0.03)
    // Slide content stays inside the slide box.
    const el = result.pages![0]! as HTMLElement
    expect(el.scrollWidth).toBeLessThanOrEqual(Math.ceil(slide.width) + 1)
    expect(el.scrollHeight).toBeLessThanOrEqual(Math.ceil(slide.height) + 1)
  })

  it('thumbnails of a paged 4:3 deck are scaled to fit (no cropping)', async () => {
    root = document.createElement('div')
    root.innerHTML = '<div id="stage" style="width:800px;height:500px;overflow:auto"><div id="host"></div></div><aside id="thumbs" style="width:160px;height:500px;overflow:auto"></aside>'
    document.body.appendChild(root)
    viewer = createViewer({ host: root.querySelector<HTMLElement>('#host')!, scrollElement: root.querySelector<HTMLElement>('#stage')!, pagination: true, initialViewMode: 'paged' })
    await viewer.load(deckUrl)
    const aside = root.querySelector<HTMLElement>('#thumbs')!
    const strip = createThumbnailStrip(viewer, { container: aside, width: 120 })
    await until(() => aside.querySelectorAll('.odv-thumb-content').length === 3)
    for (const btn of aside.querySelectorAll<HTMLElement>('button.odv-thumb')) {
      const frame = btn.querySelector<HTMLElement>('.odv-thumb-frame')!.getBoundingClientRect()
      const content = btn.querySelector<HTMLElement>('.odv-thumb-content')!
      const c = content.getBoundingClientRect()
      expect(Math.round(frame.width)).toBe(120)
      expect(Math.abs(frame.height - 90)).toBeLessThan(3) // 4:3 of 120
      expect(Math.abs(c.width - 120)).toBeLessThan(2)
      expect(Math.abs(c.height - 90)).toBeLessThan(3)
      // Every descendant box lies inside the frame (nothing cut off).
      const fr = btn.querySelector<HTMLElement>('.odv-thumb-frame')!.getBoundingClientRect()
      for (const d of content.querySelectorAll<HTMLElement>('*')) {
        const r = d.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) continue
        expect(r.right).toBeLessThanOrEqual(fr.right + 1.5)
        expect(r.bottom).toBeLessThanOrEqual(fr.bottom + 1.5)
      }
    }
    strip.destroy()
  })
})
