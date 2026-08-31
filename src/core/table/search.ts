import type { SearchMatch, SearchOptions, SearchProvider, SearchResult } from '../types'
import { createHighlighter, type HighlightTarget } from '../search/highlight'
import { buildIndex, findMatches, type IndexMatch } from '../search/text-index'
import type { TableSource, VirtualTable } from './VirtualTable'

interface CellMatch {
  row: number // -1 = header
  col: number
  match: IndexMatch
}

/**
 * Search provider over table DATA (not the rendered window), so matches on
 * rows that aren't in the DOM are found; selecting one scrolls it into the
 * window and highlights the cell.
 */
export function createTableSearchProvider(source: TableSource, table: VirtualTable): SearchProvider {
  const highlighter = createHighlighter('odv-search')
  let matches: CellMatch[] = []
  let active = -1
  let query = ''

  function cellNode(row: number, col: number): Text | undefined {
    const tr =
      row === -1
        ? table.el.querySelector('thead tr')
        : table.el.querySelector(`tbody tr[data-row="${row}"]`)
    const cell = tr?.children[col]
    const text = cell?.firstChild
    return text && text.nodeType === Node.TEXT_NODE ? (text as Text) : undefined
  }

  function apply(): void {
    // Unwrap previous <mark>s first: they split text nodes, which would throw
    // the offsets off when re-collecting ranges.
    highlighter.clear()
    const targets: HighlightTarget[] = []
    matches.forEach((m, i) => {
      const node = cellNode(m.row, m.col)
      if (!node) return
      const len = node.data.length
      const start = Math.min(m.match.start, len)
      const end = Math.min(m.match.end, len)
      if (end <= start) return
      const range = document.createRange()
      range.setStart(node, start)
      range.setEnd(node, end)
      targets.push({ range, active: i === active })
    })
    highlighter.set(targets)
  }

  table.onRender(() => {
    if (query) apply()
  })

  return {
    async search(q: string, o?: SearchOptions): Promise<SearchResult> {
      query = q
      active = -1
      matches = []
      highlighter.clear()
      if (!q.trim()) return { query, total: 0, matches: [] }
      const scan = (row: number, cells: string[]): void => {
        cells.forEach((text, col) => {
          for (const match of findMatches(buildIndex([text]), q, o)) matches.push({ row, col, match })
        })
      }
      if (source.header) scan(-1, source.header)
      const CHUNK = 5000
      for (let start = 0; start < source.rowCount; start += CHUNK) {
        const rows = source.getRows(start, Math.min(source.rowCount, start + CHUNK))
        rows.forEach((cells, i) => scan(start + i, cells))
        if (start + CHUNK < source.rowCount) await new Promise((r) => setTimeout(r, 0)) // keep the UI responsive
      }
      apply()
      const out: SearchMatch[] = matches.map((_m, i) => ({ page: 1, locator: i }))
      return { query, total: out.length, matches: out }
    },
    async select(i: number) {
      const m = matches[i]
      if (!m) return { page: 1 }
      active = i
      if (m.row >= 0) table.scrollToRow(m.row)
      apply()
      const node = cellNode(m.row, m.col)
      return { page: 1, element: node?.parentElement ?? undefined }
    },
    clear() {
      highlighter.clear()
      query = ''
      matches = []
      active = -1
    },
  }
}
