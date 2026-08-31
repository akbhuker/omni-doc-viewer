/**
 * Real pdf.js: crisp re-rasterization, rotation, and clickable links.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { renderDocument } from '../../src/core'
import type { RenderResult } from '../../src/core'
import sampleUrl from '../../demo/public/samples/sample.pdf?url'
import linksUrl from '../fixtures/generated/links.pdf?url'

let result: RenderResult | undefined
let container: HTMLDivElement

function mount(): HTMLDivElement {
  container = document.createElement('div')
  container.style.width = '800px'
  container.style.height = '600px'
  container.style.overflow = 'auto'
  document.body.appendChild(container)
  return container
}

afterEach(() => {
  result?.destroy()
  result = undefined
  container?.remove()
})

async function until(cond: () => boolean, timeout = 15_000): Promise<void> {
  const start = performance.now()
  while (!cond()) {
    if (performance.now() - start > timeout) throw new Error('timeout')
    await new Promise((r) => setTimeout(r, 50))
  }
}

describe('pdf: setScale / rotate', () => {
  it('setScale re-rasterizes the visible page at the new scale', async () => {
    mount()
    result = await renderDocument({ container, source: sampleUrl, pdf: { scale: 1 } })
    await until(() => container.querySelector('canvas') !== null)
    const before = container.querySelector('canvas')!.width

    await result.setScale!(2)
    await until(() => (container.querySelector('canvas')?.width ?? 0) > before)
    const after = container.querySelector('canvas')!.width
    expect(after).toBeGreaterThanOrEqual(before * 1.9)
    // Text layer follows the new geometry.
    await until(() => container.querySelectorAll('.textLayer span').length > 0)
  })

  it('rotate(90) swaps the page box orientation and re-renders', async () => {
    mount()
    result = await renderDocument({ container, source: sampleUrl })
    await until(() => container.querySelector('canvas') !== null)
    const page = container.querySelector<HTMLElement>('.odv-pdf-page')!
    const portrait = page.getBoundingClientRect()
    expect(portrait.height).toBeGreaterThan(portrait.width)

    await result.rotate!(90)
    await until(() => {
      const r = page.getBoundingClientRect()
      return r.width > r.height && page.querySelector('canvas') !== null
    })
  })
})

describe('pdf: link annotations', () => {
  it('renders external links as anchors that open in a new tab', async () => {
    mount()
    result = await renderDocument({ container, source: linksUrl })
    await until(() => container.querySelector('.annotationLayer a[href="https://example.com/"]') !== null)
    const a = container.querySelector<HTMLAnchorElement>('.annotationLayer a[href="https://example.com/"]')!
    expect(a.target).toBe('_blank')
    expect(a.rel).toContain('noopener')
    // The link box sits inside page 1.
    const page1 = container.querySelector('[data-odv-page="1"]')!.getBoundingClientRect()
    const box = a.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(20)
    expect(box.top).toBeGreaterThanOrEqual(page1.top)
    expect(box.bottom).toBeLessThanOrEqual(page1.bottom)
  })

  it('navigates to the target page when an internal link is clicked', async () => {
    mount()
    const navigated: number[] = []
    result = await renderDocument({ container, source: linksUrl, onNavigate: (page) => navigated.push(page) })
    await until(() => container.querySelectorAll('.annotationLayer a').length >= 2)
    const internal = Array.from(container.querySelectorAll<HTMLAnchorElement>('.annotationLayer a')).find(
      (a) => !a.href.startsWith('https://example.com'),
    )!
    internal.click()
    await until(() => navigated.length > 0)
    expect(navigated).toEqual([2])
  })

  it('can be disabled with pdf.annotations: false', async () => {
    mount()
    result = await renderDocument({ container, source: linksUrl, pdf: { annotations: false } })
    await until(() => container.querySelector('canvas') !== null)
    await new Promise((r) => setTimeout(r, 300))
    expect(container.querySelector('.annotationLayer')).toBeNull()
  })
})
