import { type Renderer } from '../../types'
import { decodeText } from '../text'
import { createVirtualTable, type TableSource } from '../../table/VirtualTable'
import { createTableSearchProvider } from '../../table/search'
import { parseRows, sniffDelimiter } from './parser'

export { parseDelimited, parseRows, sniffDelimiter } from './parser'

export const DEFAULT_MAX_ROWS = 200_000

/** Render CSV/TSV as a virtualized table with a sticky header. */
export const render: Renderer = async ({ container, bytes, options, warn }) => {
  const text = decodeText(bytes)
  const delimiter = options.csv?.delimiter ?? sniffDelimiter(text)
  const maxRows = options.csv?.maxRows ?? DEFAULT_MAX_ROWS
  // +1 so the header doesn't count against the row cap.
  const parsed = parseRows(text, delimiter, { maxRows: maxRows + 1 })
  const [header, ...body] = parsed.rows
  const total = Math.max(0, parsed.total - 1)
  const truncated = total > body.length ? { rows: body.length, total } : undefined
  if (truncated) {
    warn({
      code: 'csv/truncated',
      message: `Showing the first ${truncated.rows.toLocaleString()} of ${truncated.total.toLocaleString()} rows (csv.maxRows).`,
      details: truncated,
    })
  }

  const colCount = Math.max(header?.length ?? 0, ...body.slice(0, 1000).map((r) => r.length), 1)
  const source: TableSource = {
    rowCount: body.length,
    colCount,
    header,
    getRows: (start, end) => body.slice(start, end),
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'odv-csv'
  container.appendChild(wrapper)
  const table = createVirtualTable(wrapper, source, { ariaLabel: 'CSV data' })
  if (truncated) {
    const notice = document.createElement('div')
    notice.className = 'odv-table-notice'
    notice.setAttribute('role', 'note')
    notice.textContent = `Showing first ${truncated.rows.toLocaleString()} of ${truncated.total.toLocaleString()} rows`
    wrapper.appendChild(notice)
  }

  return {
    type: 'csv',
    meta: { type: 'csv', pageCount: 1, truncated },
    search: createTableSearchProvider(source, table),
    destroy() {
      table.destroy()
      container.replaceChildren()
    },
  }
}
