/**
 * Highlighting for search matches. Uses the CSS Custom Highlight API when
 * available (no DOM mutation), otherwise wraps each single-text-node range in
 * a `<mark>`; `clear()` restores the DOM byte-for-byte.
 */
import { ensureStyles } from '../styles'

export interface HighlightTarget {
  /** Must start and end inside the same Text node. */
  range: Range
  active?: boolean
}

export interface Highlighter {
  readonly mode: 'css-highlight' | 'mark'
  set(targets: HighlightTarget[]): void
  clear(): void
}

export const HIGHLIGHT_CSS = `
::highlight(odv-search){background:var(--odv-highlight,rgba(255,213,0,.45))}
::highlight(odv-search-active){background:var(--odv-highlight-active,rgba(255,120,0,.65))}
mark.odv-hl{background:var(--odv-highlight,rgba(255,213,0,.45));color:inherit;padding:0;border-radius:2px}
mark.odv-hl-active{background:var(--odv-highlight-active,rgba(255,120,0,.65))}
.textLayer mark.odv-hl{color:transparent}
`

export function injectHighlightStyles(): void {
  ensureStyles('odv-search-styles', HIGHLIGHT_CSS)
}

function supportsCssHighlights(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof (globalThis as any).Highlight === 'function' &&
    typeof (CSS as any).highlights?.set === 'function'
  )
}

export function createHighlighter(name = 'odv-search'): Highlighter {
  injectHighlightStyles()
  if (supportsCssHighlights()) {
    const registry = (CSS as any).highlights
    const HighlightCtor = (globalThis as any).Highlight
    return {
      mode: 'css-highlight',
      set(targets) {
        registry.delete(name)
        registry.delete(`${name}-active`)
        const all = targets.map((t) => t.range)
        const active = targets.filter((t) => t.active).map((t) => t.range)
        if (all.length) registry.set(name, new HighlightCtor(...all))
        if (active.length) registry.set(`${name}-active`, new HighlightCtor(...active))
      },
      clear() {
        registry.delete(name)
        registry.delete(`${name}-active`)
      },
    }
  }

  const marks: HTMLElement[] = []
  const wrap = (t: HighlightTarget): void => {
    const node = t.range.startContainer
    if (node.nodeType !== Node.TEXT_NODE || node !== t.range.endContainer) return
    const text = node as Text
    const start = t.range.startOffset
    const end = t.range.endOffset
    if (end <= start) return
    const mid = start > 0 ? text.splitText(start) : text
    if (end - start < mid.data.length) mid.splitText(end - start)
    const mark = document.createElement('mark')
    mark.className = t.active ? 'odv-hl odv-hl-active' : 'odv-hl'
    mid.replaceWith(mark)
    mark.appendChild(mid)
    marks.push(mark)
  }
  return {
    mode: 'mark',
    set(targets) {
      this.clear()
      // Wrap from the end of the document backwards so earlier offsets stay valid.
      const ordered = [...targets].sort((a, b) => {
        const c = a.range.compareBoundaryPoints(Range.START_TO_START, b.range)
        return -c
      })
      for (const t of ordered) wrap(t)
    },
    clear() {
      const parents = new Set<Node>()
      for (const mark of marks.splice(0)) {
        const parent = mark.parentNode
        if (!parent) continue
        mark.replaceWith(...Array.from(mark.childNodes))
        parents.add(parent)
      }
      for (const p of parents) p.normalize()
    },
  }
}
