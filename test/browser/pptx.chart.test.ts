import { describe, it, expect, afterEach } from 'vitest'
import { renderDocument } from '../../src/core'
import type { RenderResult } from '../../src/core'
import chartUrl from '../fixtures/generated/chart.pptx?url'

let result: RenderResult | undefined
afterEach(() => result?.destroy())

describe('pptx: native charts', () => {
  it('renders a deck whose slide contains a bar chart (engine chart path)', async () => {
    const container = document.createElement('div')
    container.style.width = '800px'
    document.body.appendChild(container)

    result = await renderDocument({ container, source: chartUrl })

    expect(result.meta.pageCount).toBe(1)
    const slide = container.querySelector('.pptx-preview-slide-wrapper')
    expect(slide).not.toBeNull()
    // The chart is drawn by the engine's chart library into a canvas/svg.
    expect(slide!.querySelector('canvas, svg')).not.toBeNull()
    container.remove()
  })
})
