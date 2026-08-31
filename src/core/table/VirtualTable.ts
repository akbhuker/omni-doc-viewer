import { ensureStyles } from '../styles'

export interface TableSource {
  rowCount: number
  colCount: number
  header?: string[]
  /** Rows `[start, end)` as text cells. */
  getRows(start: number, end: number): string[][]
  /** Column widths in px (optional; measured from the first rows otherwise). */
  colWidths?: number[]
  /**
   * Merged regions (0-based, relative to the data rows). Horizontal spans
   * render as `colspan`; vertical spans show their value in the anchor row.
   */
  merges?: Array<{ r: number; c: number; rows: number; cols: number }>
}

export interface VirtualTableOptions {
  /** Fixed row height in px. Default 28. */
  rowHeight?: number
  /** Extra rows rendered above/below the viewport. Default 20. */
  overscan?: number
  /** Max column width when measuring. Default 400. */
  maxColWidth?: number
  ariaLabel?: string
}

export interface VirtualTable {
  /** The scroll container (`.odv-table`). */
  el: HTMLElement
  /** Re-render the current window (e.g. after the source changed). */
  refresh(): void
  /** Scroll so that `row` (0-based) is in view, then render. */
  scrollToRow(row: number): void
  /** Currently rendered row range `[start, end)`. */
  renderedRange(): [number, number]
  /** Called after each window render (highlighting, tests). */
  onRender(listener: () => void): () => void
  destroy(): void
}

const TABLE_CSS = `
.odv-table{position:relative;overflow:auto;max-width:100%;max-height:var(--odv-table-max-height,none);
  color:var(--odv-fg,#1d1d1f);font:13px/1.5 var(--odv-font,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif)}
.odv-table table{border-collapse:separate;border-spacing:0;table-layout:fixed;min-width:100%}
.odv-table th,.odv-table td{box-sizing:border-box;border-right:1px solid var(--odv-border,#e2e5ea);border-bottom:1px solid var(--odv-border,#e2e5ea);
  padding:0 10px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
.odv-table th:first-child,.odv-table td:first-child{border-left:1px solid var(--odv-border,#e2e5ea)}
.odv-table thead th{position:sticky;top:0;background:var(--odv-surface-alt,#f6f8fa);font-weight:600;z-index:1;
  border-top:1px solid var(--odv-border,#e2e5ea)}
.odv-table tbody tr[data-row]:nth-child(even) td{background:var(--odv-surface-alt,#fbfcfd)}
.odv-table tbody tr[data-row] td{background:var(--odv-surface,#fff)}
.odv-table tr.odv-table-spacer td{border:0;padding:0;background:transparent}
.odv-table-notice{padding:6px 10px;font:12px/1.4 var(--odv-font,system-ui,sans-serif);color:var(--odv-fg-muted,#6b6b70);
  background:var(--odv-surface-alt,#f6f8fa);border:1px solid var(--odv-border,#e2e5ea);border-top:0}
`

/** Nearest scrollable ancestor, or null. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement
  while (p) {
    const oy = getComputedStyle(p).overflowY
    if (oy === 'auto' || oy === 'scroll') return p
    p = p.parentElement
  }
  return null
}

/** Estimate column widths (px) from the header and the first rows. */
function measureColumns(source: TableSource, maxColWidth: number): number[] {
  const sample = source.getRows(0, Math.min(source.rowCount, 100))
  const widths: number[] = []
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = document.createElement('canvas').getContext('2d')
    if (ctx) ctx.font = '13px system-ui, sans-serif'
  } catch {
    ctx = null
  }
  const measure = (s: string): number => {
    try {
      const w = ctx?.measureText?.(s)?.width
      if (typeof w === 'number' && w > 0) return w
    } catch {
      /* no canvas text metrics (happy-dom) */
    }
    return s.length * 7
  }
  for (let c = 0; c < source.colCount; c++) {
    let w = measure(source.header?.[c] ?? '') + 20
    for (const row of sample) w = Math.max(w, measure(row[c] ?? '') + 20)
    widths.push(Math.min(maxColWidth, Math.max(60, Math.ceil(w))))
  }
  return widths
}

/**
 * A windowed HTML table: only the rows near the viewport exist in the DOM,
 * with spacer rows keeping the scrollbar honest and a sticky header. Works
 * whether the table itself scrolls (capped height) or an ancestor does.
 */
export function createVirtualTable(host: HTMLElement, source: TableSource, opts: VirtualTableOptions = {}): VirtualTable {
  const rowHeight = opts.rowHeight ?? 28
  const overscan = opts.overscan ?? 20
  ensureStyles('odv-table-styles', TABLE_CSS)

  const scroller = document.createElement('div')
  scroller.className = 'odv-table'
  if (opts.ariaLabel) scroller.setAttribute('aria-label', opts.ariaLabel)
  const table = document.createElement('table')
  const colgroup = document.createElement('colgroup')
  const thead = document.createElement('thead')
  const tbody = document.createElement('tbody')
  table.append(colgroup, thead, tbody)
  scroller.appendChild(table)
  host.appendChild(scroller)

  const widths = source.colWidths ?? measureColumns(source, opts.maxColWidth ?? 400)
  for (let c = 0; c < source.colCount; c++) {
    const col = document.createElement('col')
    col.style.width = `${widths[c] ?? 120}px`
    colgroup.appendChild(col)
  }
  if (source.header) {
    const tr = document.createElement('tr')
    for (let c = 0; c < source.colCount; c++) {
      const th = document.createElement('th')
      th.scope = 'col'
      th.textContent = source.header[c] ?? ''
      th.style.height = `${rowHeight}px`
      tr.appendChild(th)
    }
    thead.appendChild(tr)
  }

  // Horizontal merges: anchor → colspan, covered cells skipped.
  const spanAt = new Map<string, number>()
  const covered = new Set<string>()
  for (const m of source.merges ?? []) {
    if (m.cols <= 1) continue
    for (let r = m.r; r < m.r + m.rows; r++) {
      spanAt.set(`${r}:${m.c}`, m.cols)
      for (let c = m.c + 1; c < m.c + m.cols; c++) covered.add(`${r}:${c}`)
    }
  }

  const listeners = new Set<() => void>()
  let range: [number, number] = [0, 0]
  let raf: number | undefined
  let destroyed = false
  const ancestor = scrollParent(host)

  /** Where the viewport sits relative to the table body, in px. */
  function viewport(): { top: number; height: number } {
    // Own scrolling (capped height) …
    if (scroller.scrollTop > 0 || scroller.scrollHeight > scroller.clientHeight + 1) {
      return { top: scroller.scrollTop, height: scroller.clientHeight || 600 }
    }
    // … or an ancestor / the window scrolls past us.
    const rect = scroller.getBoundingClientRect()
    const viewTop = ancestor ? ancestor.getBoundingClientRect().top : 0
    const viewHeight = ancestor ? ancestor.clientHeight : typeof window !== 'undefined' ? window.innerHeight : 600
    return { top: Math.max(0, viewTop - rect.top), height: viewHeight || 600 }
  }

  function render(): void {
    if (destroyed) return
    const { top, height } = viewport()
    const headerH = source.header ? rowHeight : 0
    const first = Math.max(0, Math.floor((top - headerH) / rowHeight) - overscan)
    const count = Math.ceil(height / rowHeight) + overscan * 2
    const last = Math.min(source.rowCount, first + count)
    range = [first, last]

    const rows = source.getRows(first, last)
    const frag = document.createDocumentFragment()
    const spacer = (px: number): HTMLTableRowElement => {
      const tr = document.createElement('tr')
      tr.className = 'odv-table-spacer'
      tr.setAttribute('aria-hidden', 'true')
      const td = document.createElement('td')
      td.colSpan = Math.max(1, source.colCount)
      td.style.height = `${px}px`
      tr.appendChild(td)
      return tr
    }
    if (first > 0) frag.appendChild(spacer(first * rowHeight))
    rows.forEach((cells, i) => {
      const tr = document.createElement('tr')
      tr.dataset.row = String(first + i)
      tr.style.height = `${rowHeight}px`
      const rowIndex = first + i
      for (let c = 0; c < source.colCount; c++) {
        if (covered.has(`${rowIndex}:${c}`)) continue
        const td = document.createElement('td')
        const span = spanAt.get(`${rowIndex}:${c}`)
        if (span) td.colSpan = span
        td.textContent = cells[c] ?? ''
        tr.appendChild(td)
      }
      frag.appendChild(tr)
    })
    if (last < source.rowCount) frag.appendChild(spacer((source.rowCount - last) * rowHeight))
    tbody.replaceChildren(frag)
    for (const l of listeners) l()
  }

  const schedule = (): void => {
    if (raf !== undefined) return
    raf = requestAnimationFrame(() => {
      raf = undefined
      render()
    })
  }
  scroller.addEventListener('scroll', schedule, { passive: true })
  const outer: EventTarget | null = ancestor ?? (typeof window !== 'undefined' ? window : null)
  outer?.addEventListener('scroll', schedule, { passive: true })
  render()

  return {
    el: scroller,
    refresh: render,
    scrollToRow(row) {
      const y = (source.header ? rowHeight : 0) + Math.max(0, row) * rowHeight
      const { height } = viewport()
      const target = Math.max(0, y - Math.max(0, height / 2 - rowHeight))
      if (scroller.scrollHeight > scroller.clientHeight + 1 || !ancestor) scroller.scrollTop = target
      else ancestor.scrollTop += scroller.getBoundingClientRect().top - ancestor.getBoundingClientRect().top + target
      render()
    },
    renderedRange: () => range,
    onRender(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    destroy() {
      destroyed = true
      if (raf !== undefined) cancelAnimationFrame(raf)
      scroller.removeEventListener('scroll', schedule)
      outer?.removeEventListener('scroll', schedule)
      listeners.clear()
      scroller.remove()
    },
  }
}
