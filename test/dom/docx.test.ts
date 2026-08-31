import { describe, it, expect, vi, beforeEach } from 'vitest'

type RenderAsync = (
  data: unknown,
  container: HTMLElement,
  styleContainer?: HTMLElement,
  options?: Record<string, unknown>,
) => Promise<void>

const renderAsync = vi.fn<RenderAsync>(async (_data, container) => {
  const section = document.createElement('section')
  section.textContent = 'page 1'
  container.appendChild(section)
})
vi.mock('docx-preview', () => ({ renderAsync }))

import { renderDocument } from '../../src/core/render'

// A minimal zip signature + `word/` marker so detection resolves to docx.
const docxBytes = Uint8Array.from([
  0x50, 0x4b, 0x03, 0x04, ...new Array(16).fill(0), ...[...'word/document.xml'].map((c) => c.charCodeAt(0)),
])

describe('docx renderer options', () => {
  beforeEach(() => {
    renderAsync.mockClear()
  })

  it('forwards the docx tuning options (headers, footers, comments, …) to docx-preview', async () => {
    const container = document.createElement('div')
    await renderDocument({
      container,
      source: docxBytes,
      docx: { renderHeaders: false, renderFooters: false, renderComments: true, ignoreLastRenderedPageBreak: false },
    })
    const opts = renderAsync.mock.calls[0]![3]!
    expect(opts).toMatchObject({
      renderHeaders: false,
      renderFooters: false,
      renderComments: true,
      ignoreLastRenderedPageBreak: false,
      breakPages: true,
    })
  })

  it('keeps the previous defaults when no docx options are given', async () => {
    const container = document.createElement('div')
    const result = await renderDocument({ container, source: docxBytes })
    const opts = renderAsync.mock.calls[0]![3]!
    expect(opts).toMatchObject({ breakPages: true, inWrapper: true, useBase64URL: true })
    expect(result.meta.pageCount).toBe(1)
  })
})
