import type { SearchMatch, SearchOptions, SearchProvider, SearchResult } from '../types'
import { createHighlighter, type HighlightTarget } from './highlight'
import { buildIndex, findMatches, locate, splitMatch, type IndexMatch, type TextIndex } from './text-index'

export interface DomSearchOptions {
  /** Element whose text is searched. */
  root: HTMLElement
  /** Page elements, to attribute matches to pages (1-based). */
  pages?: HTMLElement[]
  /** Skip an element's subtree (e.g. UI chrome). */
  skip?: (el: Element) => boolean
}

const SKIP_SELECTOR = 'script,style,noscript,template'

/**
 * Search provider for HTML-based renderers (DOCX, PPTX, Markdown, CSV, text,
 * spreadsheets): walks the text nodes under `root`, matches across inline
 * elements, and highlights hits.
 */
export function createDomSearchProvider(opts: DomSearchOptions): SearchProvider {
  const { root, pages, skip } = opts
  const highlighter = createHighlighter('odv-search')
  let nodes: Text[] = []
  let index: TextIndex = buildIndex([])
  let matches: IndexMatch[] = []
  let query = ''
  let options: SearchOptions | undefined

  function collect(): void {
    nodes = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement
        if (!p || p.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT
        if (skip?.(p)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    })
    while (walker.nextNode()) nodes.push(walker.currentNode as Text)
    index = buildIndex(nodes.map((n) => n.data))
  }

  function pageOf(node: Node): number {
    if (!pages?.length) return 1
    const i = pages.findIndex((p) => p.contains(node))
    return i >= 0 ? i + 1 : 1
  }

  function rangesFor(m: IndexMatch): Range[] {
    return splitMatch(index, m).map((part) => {
      const r = document.createRange()
      const node = nodes[part.segment]!
      r.setStart(node, part.start)
      r.setEnd(node, part.end)
      return r
    })
  }

  /** Recompute from a clean DOM and paint highlights (marks mutate the DOM). */
  function apply(active: number): Range[] {
    highlighter.clear()
    collect()
    matches = findMatches(index, query, options)
    const targets: HighlightTarget[] = []
    let activeRanges: Range[] = []
    matches.forEach((m, i) => {
      const ranges = rangesFor(m)
      if (i === active) activeRanges = ranges
      for (const range of ranges) targets.push({ range, active: i === active })
    })
    highlighter.set(targets)
    return activeRanges
  }

  return {
    async search(q, o): Promise<SearchResult> {
      query = q
      options = o
      apply(-1)
      const out: SearchMatch[] = matches.map((m, i) => ({
        page: pageOf(nodes[locate(index, m.start).segment]!),
        locator: i,
      }))
      return { query, total: out.length, matches: out }
    },
    async select(i) {
      const ranges = apply(i)
      const m = matches[i]
      if (!m) return { page: 1 }
      const page = pageOf(nodes[locate(index, m.start).segment]!)
      return { page, element: ranges[0] }
    },
    clear() {
      highlighter.clear()
      query = ''
      matches = []
    },
  }
}
