import type { SearchMatch, SearchOptions, SearchProvider, SearchResult } from '../../types'
import { createHighlighter, type HighlightTarget } from '../../search/highlight'
import { buildIndex, findMatches, splitMatch, type IndexMatch, type TextIndex } from '../../search/text-index'

export interface PdfSearchContext {
  pdf: any
  numPages: number
  /** The rendered text layer for a page (undefined while virtualized away). */
  getTextLayer(page: number): { textDivs: HTMLElement[] } | undefined
  /** Render a page (idempotent) so its text layer exists. */
  ensureRendered(page: number): Promise<void>
  /** Re-apply highlights when virtualization re-creates a page's layers. */
  onPageRendered(listener: (page: number) => void): () => void
  signal?: AbortSignal
}

interface PageMatch {
  page: number
  match: IndexMatch
}

/**
 * Search provider for PDFs. Indexes every page through pdf.js `getTextContent`
 * (so results cover pages that are virtualized away), and highlights matches
 * inside the text layer's spans, which map 1:1 onto text-content items.
 */
export function createPdfSearchProvider(ctx: PdfSearchContext): SearchProvider {
  const highlighter = createHighlighter('odv-search')
  const indexes = new Map<number, TextIndex>()
  let matches: PageMatch[] = []
  let query = ''
  let options: SearchOptions | undefined
  let active = -1
  let indexing: Promise<void> | undefined

  async function indexPage(page: number): Promise<TextIndex> {
    const cached = indexes.get(page)
    if (cached) return cached
    const p = await ctx.pdf.getPage(page)
    const content = await p.getTextContent({ includeMarkedContent: false })
    const segments = (content.items as any[]).filter((i) => typeof i?.str === 'string').map((i) => i.str as string)
    const idx = buildIndex(segments)
    indexes.set(page, idx)
    return idx
  }

  async function indexAll(signal?: AbortSignal): Promise<void> {
    const BATCH = 8
    for (let start = 1; start <= ctx.numPages; start += BATCH) {
      if (signal?.aborted || ctx.signal?.aborted) return
      const nums: number[] = []
      for (let n = start; n < start + BATCH && n <= ctx.numPages; n++) if (!indexes.has(n)) nums.push(n)
      await Promise.all(nums.map((n) => indexPage(n)))
    }
  }

  /** Ranges for a match inside a rendered page's text layer. */
  function rangesFor(page: number, m: IndexMatch): Range[] {
    const layer = ctx.getTextLayer(page)
    const idx = indexes.get(page)
    if (!layer || !idx) return []
    const out: Range[] = []
    for (const part of splitMatch(idx, m)) {
      const div = layer.textDivs[part.segment]
      const text = div?.firstChild
      if (!text || text.nodeType !== Node.TEXT_NODE) continue
      const len = (text as Text).data.length
      const start = Math.min(part.start, len)
      const end = Math.min(part.end, len)
      if (end <= start) continue
      const r = document.createRange()
      r.setStart(text, start)
      r.setEnd(text, end)
      out.push(r)
    }
    return out
  }

  function applyHighlights(): void {
    highlighter.clear() // marks split text nodes; start from a clean layer
    const targets: HighlightTarget[] = []
    matches.forEach((pm, i) => {
      for (const range of rangesFor(pm.page, pm.match)) targets.push({ range, active: i === active })
    })
    highlighter.set(targets)
  }

  ctx.onPageRendered(() => {
    if (query) applyHighlights()
  })

  return {
    async search(q, o): Promise<SearchResult> {
      query = q
      options = o
      active = -1
      matches = []
      highlighter.clear()
      indexing ??= indexAll(o?.signal)
      await indexing
      if (!q.trim()) return { query, total: 0, matches: [] }
      for (let page = 1; page <= ctx.numPages; page++) {
        const idx = indexes.get(page)
        if (!idx) continue
        for (const match of findMatches(idx, q, options)) matches.push({ page, match })
      }
      applyHighlights()
      const out: SearchMatch[] = matches.map((pm, i) => ({ page: pm.page, locator: i }))
      return { query, total: out.length, matches: out }
    },
    async select(i) {
      const pm = matches[i]
      if (!pm) return { page: 1 }
      active = i
      await ctx.ensureRendered(pm.page)
      applyHighlights()
      const layer = ctx.getTextLayer(pm.page)
      const idx = indexes.get(pm.page)
      const first = layer && idx ? splitMatch(idx, pm.match)[0] : undefined
      const element = first ? layer!.textDivs[first.segment] : undefined
      return { page: pm.page, element }
    },
    clear() {
      highlighter.clear()
      query = ''
      matches = []
      active = -1
    },
  }
}
