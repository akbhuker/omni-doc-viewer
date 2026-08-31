/**
 * Real-engine smoke tests: every sample document must render in a real
 * browser with the expected page count and DOM, without console errors.
 * This is the regression net for engine upgrades and renderer changes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderDocument } from '../../src/core'
import type { DocType, RenderResult } from '../../src/core'

import pdfUrl from '../../demo/public/samples/sample.pdf?url'
import docxUrl from '../../demo/public/samples/sample.docx?url'
import xlsxUrl from '../../demo/public/samples/sample.xlsx?url'
import pptxUrl from '../../demo/public/samples/sample.pptx?url'
import svgUrl from '../../demo/public/samples/sample.svg?url'
import mdUrl from '../../demo/public/samples/sample.md?url'
import csvUrl from '../../demo/public/samples/sample.csv?url'

interface Sample {
  url: string
  type: DocType
  /** Expected `meta.pageCount` (undefined = not reported for this format). */
  pageCount?: number
  /** A selector that must exist inside the container after render. */
  selector: string
}

const SAMPLES: Sample[] = [
  { url: pdfUrl, type: 'pdf', pageCount: 1, selector: '.odv-pdf-page canvas' },
  { url: docxUrl, type: 'docx', selector: '.odv-docx section' },
  { url: xlsxUrl, type: 'xlsx', pageCount: 2, selector: '.odv-xlsx table td' },
  { url: pptxUrl, type: 'pptx', pageCount: 2, selector: '.pptx-preview-slide-wrapper' },
  { url: svgUrl, type: 'image', pageCount: 1, selector: 'img.odv-image-img' },
  { url: mdUrl, type: 'markdown', selector: '.odv-markdown h1' },
  { url: csvUrl, type: 'csv', pageCount: 1, selector: '.odv-csv table tbody tr' },
]

let container: HTMLDivElement
let result: RenderResult | undefined
let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  container = document.createElement('div')
  container.style.width = '800px'
  document.body.appendChild(container)
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  result?.destroy()
  result = undefined
  container.remove()
  consoleError.mockRestore()
})

/** Wait until `selector` matches inside `root` (virtualized renderers paint async). */
async function waitFor(root: Element, selector: string, timeout = 15_000): Promise<Element> {
  const start = performance.now()
  while (performance.now() - start < timeout) {
    const el = root.querySelector(selector)
    if (el) return el
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`Timed out waiting for "${selector}"`)
}

describe('renderDocument() renders every sample format', () => {
  for (const sample of SAMPLES) {
    it(`renders ${sample.type}`, async () => {
      result = await renderDocument({ container, source: sample.url })

      expect(result.type).toBe(sample.type)
      expect(result.meta.type).toBe(sample.type)
      if (sample.pageCount !== undefined) expect(result.meta.pageCount).toBe(sample.pageCount)
      expect(result.bytes?.byteLength ?? 0).toBeGreaterThan(0)
      // Vite may inline tiny assets as data: URLs, which carry no filename.
      if (!sample.url.startsWith('data:')) {
        expect(result.filename).toBe(sample.url.split('/').pop()?.split('?')[0])
      }

      await waitFor(container, sample.selector)
      if (result.pages) expect(result.pages.length).toBeGreaterThan(0)
      expect(consoleError).not.toHaveBeenCalled()
    })
  }

  it('neutralizes docx-preview\'s grey padded wrapper inside the viewer', async () => {
    result = await renderDocument({ container, source: docxUrl })
    const wrapper = container.querySelector<HTMLElement>('.odv-docx > div')!
    const cs = getComputedStyle(wrapper)
    expect(cs.backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(cs.paddingTop).toBe('0px')
    const section = container.querySelector<HTMLElement>('.odv-docx section')!
    expect(section.getBoundingClientRect().width).toBeLessThanOrEqual(container.getBoundingClientRect().width + 1)
  })

  it('destroy() clears the container and can render again into it', async () => {
    result = await renderDocument({ container, source: csvUrl })
    result.destroy()
    expect(container.childElementCount).toBe(0)
    result = await renderDocument({ container, source: mdUrl })
    expect(result.type).toBe('markdown')
  })
})
