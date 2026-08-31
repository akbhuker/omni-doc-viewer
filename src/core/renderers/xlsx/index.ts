import { type Renderer, type SearchProvider } from '../../types'
import { createVirtualTable, type TableSource, type VirtualTable } from '../../table/VirtualTable'
import { createTableSearchProvider } from '../../table/search'

export const DEFAULT_MAX_ROWS = 200_000

interface SheetInfo {
  name: string
  hidden: number
  ws: any
}

/** A lazily-built TableSource over one worksheet (rows decoded on demand). */
function sheetSource(XLSX: any, ws: any, maxRows: number): { source: TableSource; truncated?: { rows: number; total: number } } {
  const ref: string | undefined = ws?.['!ref']
  if (!ref) return { source: { rowCount: 0, colCount: 1, header: ['A'], getRows: () => [] } }
  const range = XLSX.utils.decode_range(ref)
  const full = ws['!fullref'] ? XLSX.utils.decode_range(ws['!fullref']) : range
  const parsedRows = range.e.r - range.s.r + 1
  const totalRows = full.e.r - full.s.r + 1
  const rowCount = Math.min(parsedRows, maxRows)
  const colCount = Math.max(1, Math.max(range.e.c, full.e.c) - range.s.c + 1)
  const header = Array.from({ length: colCount }, (_, c) => String(XLSX.utils.encode_col(range.s.c + c)))
  const cols: Array<{ wpx?: number; wch?: number } | undefined> = ws['!cols'] ?? []
  const colWidths = cols.length
    ? Array.from({ length: colCount }, (_, c) => {
        const col = cols[range.s.c + c]
        return col?.wpx ?? (col?.wch ? Math.round(col.wch * 7 + 5) : 100)
      })
    : undefined
  const merges = (ws['!merges'] ?? []).map((m: any) => ({
    r: m.s.r - range.s.r,
    c: m.s.c - range.s.c,
    rows: m.e.r - m.s.r + 1,
    cols: m.e.c - m.s.c + 1,
  }))
  const source: TableSource = {
    rowCount,
    colCount,
    header,
    colWidths,
    merges,
    getRows(start, end) {
      if (end <= start) return []
      return XLSX.utils.sheet_to_json(ws, {
        header: 1,
        raw: false, // formatted text (number formats, dates)
        defval: '',
        blankrows: true,
        range: { s: { r: range.s.r + start, c: range.s.c }, e: { r: range.s.r + end - 1, c: range.s.c + colCount - 1 } },
      }) as string[][]
    },
  }
  const truncated = totalRows > rowCount ? { rows: rowCount, total: totalRows } : undefined
  return { source, truncated }
}

export const render: Renderer = async ({ container, bytes, options, warn }) => {
  const XLSX: any = await import('@e965/xlsx')
  const maxRows = options.xlsx?.maxRows ?? DEFAULT_MAX_ROWS
  // sheetRows bounds parsing work/memory; `!fullref` still tells us the real size.
  const wb = XLSX.read(bytes, { type: 'array', sheetRows: maxRows + 1, cellStyles: true })
  const flags: Array<{ Hidden?: number }> = wb.Workbook?.Sheets ?? []
  const all: SheetInfo[] = (wb.SheetNames as string[]).map((name, i) => ({
    name,
    hidden: flags[i]?.Hidden ?? 0,
    ws: wb.Sheets[name],
  }))
  const sheets = options.xlsx?.showHiddenSheets ? all : all.filter((s) => !s.hidden)
  if (sheets.length === 0 && all.length > 0) sheets.push(...all) // everything hidden: show anyway

  const root = document.createElement('div')
  root.className = 'odv-xlsx'
  root.style.display = 'flex'
  root.style.flexDirection = 'column'
  root.style.height = '100%'

  // --- Sheet tab bar ---
  const tabs = document.createElement('div')
  tabs.className = 'odv-xlsx-tabs'
  tabs.setAttribute('role', 'tablist')
  tabs.style.display = 'flex'
  tabs.style.flexWrap = 'wrap'
  tabs.style.gap = '2px'
  tabs.style.borderBottom = '1px solid var(--odv-border, #d0d0d0)'
  tabs.style.padding = '4px 4px 0'
  tabs.style.flex = '0 0 auto'

  // --- Sheet content area ---
  const content = document.createElement('div')
  content.className = 'odv-xlsx-content'
  content.style.overflow = 'auto'
  content.style.flex = '1 1 auto'
  content.style.padding = '8px'

  const buttons: HTMLButtonElement[] = []
  let table: VirtualTable | undefined
  let activeSearch: SearchProvider | undefined
  let truncated: { rows: number; total: number } | undefined
  const warned = new Set<number>()

  function showSheet(index: number): void {
    const sheet = sheets[index]
    if (!sheet) return
    activeSearch?.clear()
    table?.destroy()
    content.replaceChildren()
    const { source, truncated: cut } = sheetSource(XLSX, sheet.ws, maxRows)
    table = createVirtualTable(content, source, { ariaLabel: sheet.name })
    activeSearch = createTableSearchProvider(source, table)
    if (cut) {
      truncated ??= cut
      const notice = document.createElement('div')
      notice.className = 'odv-table-notice'
      notice.setAttribute('role', 'note')
      notice.textContent = `Showing first ${cut.rows.toLocaleString()} of ${cut.total.toLocaleString()} rows`
      content.appendChild(notice)
      if (!warned.has(index)) {
        warned.add(index)
        warn({
          code: 'xlsx/truncated',
          message: `Sheet "${sheet.name}": showing the first ${cut.rows.toLocaleString()} of ${cut.total.toLocaleString()} rows (xlsx.maxRows).`,
          details: { sheet: sheet.name, ...cut },
        })
      }
    }
    buttons.forEach((b, i) => {
      const active = i === index
      b.setAttribute('aria-selected', String(active))
      b.style.background = active ? 'var(--odv-surface, #fff)' : 'var(--odv-surface-alt, #ececec)'
      b.style.fontWeight = active ? '600' : '400'
      b.style.borderBottomColor = active ? 'var(--odv-surface, #fff)' : 'var(--odv-border, #d0d0d0)'
    })
  }

  sheets.forEach((sheet, i) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.setAttribute('role', 'tab')
    btn.textContent = sheet.name
    if (sheet.hidden) btn.title = 'Hidden sheet'
    btn.style.border = '1px solid var(--odv-border, #d0d0d0)'
    btn.style.color = 'var(--odv-fg, #1d1d1f)'
    btn.style.borderBottom = 'none'
    btn.style.borderRadius = '4px 4px 0 0'
    btn.style.padding = '4px 12px'
    btn.style.cursor = 'pointer'
    btn.style.background = 'var(--odv-surface-alt, #ececec)'
    btn.addEventListener('click', () => showSheet(i))
    buttons.push(btn)
    tabs.appendChild(btn)
  })

  root.appendChild(tabs)
  root.appendChild(content)
  container.appendChild(root)

  // Detect truncation on every sheet up front (cheap: reads two range strings).
  for (const s of sheets) {
    const cut = sheetSource(XLSX, s.ws, maxRows).truncated
    if (cut) {
      truncated = cut
      break
    }
  }
  if (sheets.length > 0) showSheet(0)

  // Search delegates to the active sheet (switch tabs to search another).
  const search: SearchProvider = {
    search: (q, o) => (activeSearch ? activeSearch.search(q, o) : Promise.resolve({ query: q, total: 0, matches: [] })),
    select: (i) => (activeSearch ? activeSearch.select(i) : Promise.resolve({ page: 1 })),
    clear: () => activeSearch?.clear(),
  }

  return {
    type: 'xlsx',
    meta: { type: 'xlsx', pageCount: sheets.length, truncated },
    search,
    goToPage: (n) => showSheet(n - 1),
    destroy() {
      activeSearch?.clear()
      table?.destroy()
      container.replaceChildren()
    },
  }
}
