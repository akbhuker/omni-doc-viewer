import { describe, it, expect, afterEach } from 'vitest'
import { renderDocument } from '../../src/core'
import type { RenderResult } from '../../src/core'
import manyPagesUrl from '../fixtures/generated/many-pages.pdf?url'

let result: RenderResult | undefined
let container: HTMLDivElement
afterEach(() => {
  result?.destroy()
  container?.remove()
})

describe('pdf thumbnails provider', () => {
  it('renders a page thumbnail canvas at the requested width, cached on repeat', async () => {
    container = document.createElement('div')
    container.style.width = '800px'
    document.body.appendChild(container)
    result = await renderDocument({ container, source: manyPagesUrl })
    expect(result.thumbnails?.count).toBe(200)

    const el = await result.thumbnails!.render(9, { width: 120 }) // page 10 is A5 (narrower)
    const canvas = el.querySelector('canvas') ?? (el as HTMLCanvasElement)
    expect(canvas.tagName).toBe('CANVAS')
    const rect = el.getBoundingClientRect
    expect(Number(el.style.width.replace('px', ''))).toBe(120)
    expect(canvas.width).toBeGreaterThanOrEqual(120)
    expect(canvas.height).toBeGreaterThan(canvas.width) // portrait
    void rect

    const again = await result.thumbnails!.render(9, { width: 120 })
    expect(again).not.toBe(el) // always a fresh element…
    expect(again.querySelector('canvas')?.width).toBe(canvas.width) // …from the cached raster
  })
})
