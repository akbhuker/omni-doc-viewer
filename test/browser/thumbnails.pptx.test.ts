import { describe, it, expect, afterEach } from 'vitest'
import { createViewer, createThumbnailStrip } from '../../src/core'
import type { ViewerController } from '../../src/core'
import sampleUrl from '../../demo/public/samples/sample.pptx?url'

let viewer: ViewerController | undefined
let root: HTMLDivElement
afterEach(() => {
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

describe('thumbnail strip with hidden (paged-mode) slides', () => {
  it('scales every slide to the thumbnail width, including slides that are display:none', async () => {
    root = document.createElement('div')
    root.innerHTML = '<div id="stage" style="width:800px;height:500px;overflow:auto"><div id="host"></div></div><aside id="thumbs" style="width:160px;height:500px;overflow:auto"></aside>'
    document.body.appendChild(root)
    const host = root.querySelector<HTMLElement>('#host')!
    const stage = root.querySelector<HTMLElement>('#stage')!
    viewer = createViewer({ host, scrollElement: stage, pagination: true, initialViewMode: 'paged' })
    await viewer.load(sampleUrl)
    const slides = viewer.getResult()!.pages!
    expect(slides).toHaveLength(2)
    expect(slides[1]!.style.display).toBe('none') // paged mode hides slide 2

    const aside = root.querySelector<HTMLElement>('#thumbs')!
    const strip = createThumbnailStrip(viewer, { container: aside, width: 120 })
    await until(() => aside.querySelectorAll('.odv-thumb-content').length === 2)

    const slideRect = slides[0]!.getBoundingClientRect()
    const expectedH = (120 * slideRect.height) / slideRect.width
    for (const btn of aside.querySelectorAll<HTMLElement>('button.odv-thumb')) {
      const frame = btn.querySelector<HTMLElement>('.odv-thumb-frame')!
      const content = btn.querySelector<HTMLElement>('.odv-thumb-content')!
      const f = frame.getBoundingClientRect()
      const c = content.getBoundingClientRect()
      expect(Math.round(f.width)).toBe(120)
      expect(Math.abs(f.height - expectedH)).toBeLessThan(2)
      // The scaled clone fills the frame exactly — nothing is cut off.
      expect(Math.abs(c.width - 120)).toBeLessThan(2)
      expect(Math.abs(c.height - expectedH)).toBeLessThan(2)
      for (const d of content.querySelectorAll<HTMLElement>('*')) {
        const r = d.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) continue
        expect(r.right).toBeLessThanOrEqual(f.right + 1.5)
        expect(r.bottom).toBeLessThanOrEqual(f.bottom + 1.5)
      }
    }
    strip.destroy()
  })
})

describe('thumbnail strip on pages that contain images', () => {
  it('scales by the page box, not by the first image inside it', async () => {
    const { default: imageUrl } = await import('../fixtures/generated/image.pptx?url')
    root = document.createElement('div')
    root.innerHTML = '<div id="stage" style="width:800px;height:500px;overflow:auto"><div id="host"></div></div><aside id="thumbs" style="width:160px;height:500px;overflow:auto"></aside>'
    document.body.appendChild(root)
    viewer = createViewer({ host: root.querySelector<HTMLElement>('#host')!, scrollElement: root.querySelector<HTMLElement>('#stage')!, pagination: true })
    await viewer.load(imageUrl)
    const aside = root.querySelector<HTMLElement>('#thumbs')!
    const strip = createThumbnailStrip(viewer, { container: aside, width: 120 })
    await until(() => aside.querySelectorAll('.odv-thumb-content').length === 1)
    const slide = viewer.getResult()!.pages![0]!.getBoundingClientRect()
    const btn = aside.querySelector<HTMLElement>('button.odv-thumb')!
    const f = btn.querySelector<HTMLElement>('.odv-thumb-frame')!.getBoundingClientRect()
    expect(Math.abs(f.height - (120 * slide.height) / slide.width)).toBeLessThan(2)
    for (const d of btn.querySelectorAll<HTMLElement>('.odv-thumb-content *')) {
      const r = d.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      expect(r.right, d.tagName).toBeLessThanOrEqual(f.right + 1.5)
      expect(r.bottom, d.tagName).toBeLessThanOrEqual(f.bottom + 1.5)
    }
    strip.destroy()
  })
})
