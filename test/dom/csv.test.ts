import { describe, it, expect } from 'vitest'
import { renderDocument } from '../../src/core/render'

function bigCsv(rows: number, cols = 5): Uint8Array {
  const header = Array.from({ length: cols }, (_, c) => `col${c}`).join(',')
  const lines = [header]
  for (let r = 0; r < rows; r++) lines.push(Array.from({ length: cols }, (_, c) => `r${r}c${c}`).join(','))
  return new TextEncoder().encode(lines.join('\n'))
}

function mount(): HTMLDivElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true })
  document.body.appendChild(el)
  return el
}

describe('csv renderer — virtualization', () => {
  it('renders only a window of rows for large files and updates it on scroll', async () => {
    const container = mount()
    const result = await renderDocument({ container, source: bigCsv(5000), type: 'csv' })
    expect(result.meta.pageCount).toBe(1)
    expect(container.querySelectorAll('thead th')).toHaveLength(5)
    const rendered = container.querySelectorAll('tbody tr[data-row]')
    expect(rendered.length).toBeGreaterThan(5)
    expect(rendered.length).toBeLessThan(200)
    expect(rendered[0]!.getAttribute('data-row')).toBe('0')
    expect(rendered[0]!.textContent).toContain('r0c0')

    const scroller = container.querySelector<HTMLElement>('.odv-table')!
    scroller.scrollTop = 28 * 3000
    scroller.dispatchEvent(new Event('scroll'))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    const first = Number(container.querySelector('tbody tr[data-row]')!.getAttribute('data-row'))
    expect(first).toBeGreaterThan(2500)
    expect(container.querySelectorAll('tbody tr[data-row]').length).toBeLessThan(200)
    result.destroy()
  })

  it('caps rows with csv.maxRows and reports the truncation', async () => {
    const container = mount()
    const result = await renderDocument({ container, source: bigCsv(500), type: 'csv', csv: { maxRows: 100 } })
    expect(result.meta.truncated).toEqual({ rows: 100, total: 500 })
    expect(container.querySelector('.odv-table-notice')?.textContent).toMatch(/100 of 500/)
    result.destroy()
  })

  it('honours an explicit delimiter and sniffs semicolons otherwise', async () => {
    const container = mount()
    const r1 = await renderDocument({ container, source: new TextEncoder().encode('a;b\n1,5;2'), type: 'csv' })
    expect(container.querySelectorAll('thead th')).toHaveLength(2)
    r1.destroy()
    const r2 = await renderDocument({ container, source: new TextEncoder().encode('a|b\n1|2'), type: 'csv', csv: { delimiter: '|' } })
    expect(container.querySelectorAll('thead th')).toHaveLength(2)
    r2.destroy()
  })

  it('searches the whole data set, not just the rendered window', async () => {
    const container = mount()
    const result = await renderDocument({ container, source: bigCsv(3000), type: 'csv' })
    const r = await result.search!.search('r2999c1')
    expect(r.total).toBe(1)
    const sel = await result.search!.select(0)
    expect(sel.page).toBe(1)
    // The match's row is now rendered and highlighted.
    const row = container.querySelector('tbody tr[data-row="2999"]')
    expect(row).not.toBeNull()
    expect(row!.querySelector('mark.odv-hl-active, .odv-hl-active') ?? (CSS as any).highlights?.get('odv-search-active')).toBeTruthy()
    result.destroy()
  })
})
