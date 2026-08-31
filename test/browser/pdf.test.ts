/**
 * Real pdf.js tests: text layer geometry under the v6 CSS, password handling,
 * and virtualization on a 200-page document.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { renderDocument, RenderError } from '../../src/core'
import type { RenderResult } from '../../src/core'
import sampleUrl from '../../demo/public/samples/sample.pdf?url'
import passwordUrl from '../fixtures/generated/password.pdf?url'
import manyPagesUrl from '../fixtures/generated/many-pages.pdf?url'

let result: RenderResult | undefined
let container: HTMLDivElement

function mount(width = '800px'): HTMLDivElement {
  container = document.createElement('div')
  container.style.width = width
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

describe('pdf: text layer', () => {
  it('positions selectable text spans over the canvas with non-zero boxes', async () => {
    mount()
    result = await renderDocument({ container, source: sampleUrl })
    await until(() => container.querySelectorAll('.textLayer span').length > 0)

    const spans = Array.from(container.querySelectorAll<HTMLElement>('.textLayer span')).filter(
      (s) => (s.textContent ?? '').trim().length > 0,
    )
    expect(spans.length).toBeGreaterThan(0)
    const box = spans[0]!.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(5)
    expect(box.height).toBeGreaterThan(5)
    // The span sits inside the page box.
    const page = container.querySelector('.odv-pdf-page')!.getBoundingClientRect()
    expect(box.top).toBeGreaterThanOrEqual(page.top - 1)
    expect(box.bottom).toBeLessThanOrEqual(page.bottom + 1)
    expect(container.textContent).toContain('omni-doc-viewer')
  })

  it('destroy() clears the DOM and releases the document without throwing', async () => {
    mount()
    result = await renderDocument({ container, source: sampleUrl })
    expect(() => result!.destroy()).not.toThrow()
    expect(container.childElementCount).toBe(0)
    result = undefined
  })
})

describe('pdf: password-protected documents', () => {
  it('rejects with RenderError(PDF_PASSWORD_REQUIRED) when no password is provided', async () => {
    mount()
    const err = await renderDocument({ container, source: passwordUrl }).catch((e) => e)
    expect(err).toBeInstanceOf(RenderError)
    expect(err.code).toBe('PDF_PASSWORD_REQUIRED')
    expect(err.format).toBe('pdf')
  })

  it('opens with a static password', async () => {
    mount()
    result = await renderDocument({ container, source: passwordUrl, pdf: { password: 'secret' } })
    expect(result.meta.pageCount).toBe(1)
    await until(() => container.querySelector('.odv-pdf-page canvas') !== null)
  })

  it('asks a password callback, reporting "incorrect" after a wrong attempt', async () => {
    mount()
    const reasons: string[] = []
    result = await renderDocument({
      container,
      source: passwordUrl,
      pdf: {
        password: async (reason) => {
          reasons.push(reason)
          return reason === 'need' ? 'wrong' : 'secret'
        },
      },
    })
    expect(reasons).toEqual(['need', 'incorrect'])
    expect(result.meta.pageCount).toBe(1)
  })

  it('rejects with PDF_PASSWORD_REQUIRED when the callback returns null (user cancelled)', async () => {
    mount()
    const err = await renderDocument({ container, source: passwordUrl, pdf: { password: async () => null } }).catch((e) => e)
    expect(err).toBeInstanceOf(RenderError)
    expect(err.code).toBe('PDF_PASSWORD_REQUIRED')
  })
})

describe('pdf: large documents', () => {
  it('reports the page count, reserves every page box, and rasterizes only pages near the viewport', async () => {
    mount()
    const started = performance.now()
    result = await renderDocument({ container, source: manyPagesUrl })
    await until(() => container.querySelector('.odv-pdf-page canvas') !== null)
    const firstPaint = performance.now() - started

    expect(result.meta.pageCount).toBe(200)
    expect(container.querySelectorAll('.odv-pdf-page')).toHaveLength(200)
    // Virtualized: far pages are placeholders, not canvases.
    await new Promise((r) => setTimeout(r, 500))
    const rendered = container.querySelectorAll('.odv-pdf-page canvas').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(60)
    // Page sizing is lazy: the first canvas should not wait for 200 round-trips.
    expect(firstPaint).toBeLessThan(5_000)
    // Mixed page sizes (every 10th page is A5) are reflected once sized.
    await until(() => {
      const p10 = container.querySelector<HTMLElement>('[data-odv-page="10"]')!
      const p1 = container.querySelector<HTMLElement>('[data-odv-page="1"]')!
      return p10.getBoundingClientRect().width < p1.getBoundingClientRect().width
    })
  })
})
