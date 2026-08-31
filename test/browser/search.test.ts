/**
 * Real-engine search: pdf.js text content across virtualized pages, and the
 * DOM provider over a rendered DOCX.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { renderDocument } from '../../src/core'
import type { RenderResult } from '../../src/core'
import manyPagesUrl from '../fixtures/generated/many-pages.pdf?url'
import docxUrl from '../../demo/public/samples/sample.docx?url'

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

describe('search: pdf', () => {
  it('finds text on pages that are not rendered yet and materializes the selected match', async () => {
    mount()
    result = await renderDocument({ container, source: manyPagesUrl })
    expect(result.search).toBeDefined()

    const r = await result.search!.search('Page 150 of 200')
    expect(r.total).toBe(1)
    expect(r.matches[0]!.page).toBe(150)
    // Page 150 is far from the viewport: not rendered until selected.
    expect(container.querySelector('[data-odv-page="150"] canvas')).toBeNull()

    const sel = await result.search!.select(0)
    expect(sel.page).toBe(150)
    await until(() => container.querySelector('[data-odv-page="150"] .textLayer span') !== null)
    // Highlighted via the CSS Custom Highlight API (Chromium) or <mark>.
    const cssHighlights = (CSS as any).highlights
    const highlighted =
      (cssHighlights?.get('odv-search-active')?.size ?? 0) > 0 ||
      container.querySelector('[data-odv-page="150"] mark.odv-hl-active') !== null
    expect(highlighted).toBe(true)

    const many = await result.search!.search('Page')
    expect(many.total).toBe(200)
    result.search!.clear()
    expect(cssHighlights?.has('odv-search') ?? false).toBe(false)
  })
})

describe('search: docx (DOM provider)', () => {
  it('finds and highlights text in the rendered document', async () => {
    mount()
    result = await renderDocument({ container, source: docxUrl })
    const r = await result.search!.search('omni-doc-viewer')
    expect(r.total).toBeGreaterThanOrEqual(1)
    const sel = await result.search!.select(0)
    expect(sel.page).toBe(1)
    expect(sel.element).toBeTruthy()
    result.search!.clear()
  })
})
