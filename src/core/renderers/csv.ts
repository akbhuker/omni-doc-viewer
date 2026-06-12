import { type Renderer } from '../types'
import { decodeText } from './text'

/**
 * Parse delimited text (CSV/TSV) into rows. Handles quoted fields, escaped
 * quotes (`""`), and newlines inside quotes per RFC 4180.
 */
export function parseDelimited(input: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      quoted = true
    } else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c === '\r') {
      // swallow; the following \n closes the row
    } else {
      field += c
    }
  }
  // Flush the final field/row unless the input ended on a clean newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Pick the delimiter (tab vs comma) by whichever the first line has more of. */
function sniffDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf('\n') + 1 || text.length)
  const tabs = (firstLine.match(/\t/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  return tabs > commas ? '\t' : ','
}

/** Render CSV/TSV as a scrollable HTML table with a sticky header row. */
export const render: Renderer = async ({ container, bytes }) => {
  const text = decodeText(bytes)
  const rows = parseDelimited(text, sniffDelimiter(text))

  injectCsvStyles()
  const scroller = document.createElement('div')
  scroller.className = 'odv-csv'

  const table = document.createElement('table')
  const [head, ...body] = rows
  if (head) {
    const thead = document.createElement('thead')
    const tr = document.createElement('tr')
    head.forEach((cell) => {
      const th = document.createElement('th')
      th.textContent = cell
      tr.appendChild(th)
    })
    thead.appendChild(tr)
    table.appendChild(thead)
  }
  const tbody = document.createElement('tbody')
  for (const r of body) {
    const tr = document.createElement('tr')
    for (const cell of r) {
      const td = document.createElement('td')
      td.textContent = cell
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  scroller.appendChild(table)
  container.appendChild(scroller)

  return {
    type: 'csv',
    meta: { type: 'csv', pageCount: 1 },
    destroy() {
      container.replaceChildren()
    },
  }
}

const CSV_CSS = `
.odv-csv{overflow:auto;max-width:100%;padding:8px;
  font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.odv-csv table{border-collapse:collapse;white-space:nowrap}
.odv-csv th,.odv-csv td{border:1px solid #e2e5ea;padding:5px 10px;text-align:left}
.odv-csv thead th{position:sticky;top:0;background:#f6f8fa;font-weight:600;z-index:1}
.odv-csv tbody tr:nth-child(even){background:#fbfcfd}
`

let csvStylesInjected = false
function injectCsvStyles(): void {
  if (csvStylesInjected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.id = 'odv-csv-styles'
  el.textContent = CSV_CSS
  document.head.appendChild(el)
  csvStylesInjected = true
}
