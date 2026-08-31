import { describe, it, expect } from 'vitest'
import { renderDocument } from '../../src/core/render'
import { makeWorkbook } from '../helpers/xlsx-fixtures'

function mount(): HTMLDivElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true })
  document.body.appendChild(el)
  return el
}

describe('xlsx renderer — virtualized sheets', () => {
  it('renders a large sheet as a windowed table with column-letter headers', async () => {
    const rows = Array.from({ length: 5000 }, (_, r) => [r, `name ${r}`, r * 1.5])
    const container = mount()
    const result = await renderDocument({ container, source: makeWorkbook([{ name: 'Data', rows }]), type: 'xlsx' })
    expect(result.meta.pageCount).toBe(1)
    const ths = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent)
    expect(ths).toEqual(['A', 'B', 'C'])
    const rendered = container.querySelectorAll('tbody tr[data-row]')
    expect(rendered.length).toBeGreaterThan(5)
    expect(rendered.length).toBeLessThan(200)
    expect(rendered[0]!.textContent).toContain('name 0')
    result.destroy()
  })

  it('hides sheets flagged hidden unless xlsx.showHiddenSheets is set', async () => {
    const bytes = makeWorkbook([
      { name: 'Visible', rows: [['a']] },
      { name: 'Secret', rows: [['b']], hidden: 1 },
    ])
    const container = mount()
    const r1 = await renderDocument({ container, source: bytes, type: 'xlsx' })
    expect(Array.from(container.querySelectorAll('[role="tab"]')).map((t) => t.textContent)).toEqual(['Visible'])
    expect(r1.meta.pageCount).toBe(1)
    r1.destroy()
    const r2 = await renderDocument({ container, source: bytes, type: 'xlsx', xlsx: { showHiddenSheets: true } })
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2)
    r2.destroy()
  })

  it('renders horizontal merges as colspan and applies column widths', async () => {
    const bytes = makeWorkbook([
      { name: 'S', rows: [['Title', '', ''], ['a', 'b', 'c']], merges: ['A1:C1'], colWidths: [200, 80, 80] },
    ])
    const container = mount()
    const result = await renderDocument({ container, source: bytes, type: 'xlsx' })
    const first = container.querySelector('tbody tr[data-row="0"]')!
    expect(first.children).toHaveLength(1)
    expect((first.children[0] as HTMLTableCellElement).colSpan).toBe(3)
    expect(first.textContent).toBe('Title')
    const cols = container.querySelectorAll('colgroup col')
    expect((cols[0] as HTMLElement).style.width).toBe('200px')
    expect((cols[1] as HTMLElement).style.width).toBe('80px')
    result.destroy()
  })

  it('switches sheets via tabs and result.goToPage, and searches the active sheet', async () => {
    const bytes = makeWorkbook([
      { name: 'One', rows: [['apple', 'pear']] },
      { name: 'Two', rows: [['banana', 'kiwi']] },
    ])
    const container = mount()
    const result = await renderDocument({ container, source: bytes, type: 'xlsx' })
    expect((await result.search!.search('banana')).total).toBe(0)
    result.goToPage!(2)
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Two')
    expect((await result.search!.search('banana')).total).toBe(1)
    result.destroy()
  })

  it('caps rows with xlsx.maxRows and reports the truncation', async () => {
    const rows = Array.from({ length: 300 }, (_, r) => [r])
    const container = mount()
    const result = await renderDocument({ container, source: makeWorkbook([{ name: 'S', rows }]), type: 'xlsx', xlsx: { maxRows: 50 } })
    expect(result.meta.truncated).toEqual({ rows: 50, total: 300 })
    expect(container.querySelector('.odv-table-notice')?.textContent).toMatch(/50 of 300/)
    result.destroy()
  })
})
