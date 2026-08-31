/**
 * Pure text indexing for in-document search. A document is a list of text
 * segments (DOM text nodes, or pdf.js text items); the index concatenates them
 * so a query can match across segment boundaries, and maps hits back to
 * (segment, offset) pairs so they can be highlighted.
 *
 * Case folding is length-preserving (per UTF-16 unit), so offsets in the
 * folded text are offsets in the original text.
 */
export interface TextIndex {
  /** All segments concatenated (no separators). */
  text: string
  /** `starts[i]` = offset in `text` where segment i begins. */
  starts: number[]
  segments: string[]
}

export interface IndexMatch {
  start: number
  end: number
}

export interface MatchPart {
  segment: number
  /** Offsets within the segment. */
  start: number
  end: number
}

export interface FindOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
}

export function buildIndex(segments: string[]): TextIndex {
  const starts: number[] = []
  let text = ''
  for (const s of segments) {
    starts.push(text.length)
    text += s
  }
  return { text, starts, segments }
}

/** Lower-case without changing string length (drops folds that would expand). */
export function fold(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    const l = c.toLowerCase()
    out += l.length === 1 ? l : c
  }
  return out
}

const WORD_CHAR = /[\p{L}\p{N}_]/u

export function findMatches(index: TextIndex, query: string, options: FindOptions = {}): IndexMatch[] {
  if (!query || !query.trim()) return []
  const hay = options.caseSensitive ? index.text : fold(index.text)
  const needle = options.caseSensitive ? query : fold(query)
  const out: IndexMatch[] = []
  let from = 0
  for (;;) {
    const at = hay.indexOf(needle, from)
    if (at < 0) break
    const end = at + needle.length
    if (options.wholeWord) {
      const before = at > 0 ? hay[at - 1]! : ''
      const after = end < hay.length ? hay[end]! : ''
      if (WORD_CHAR.test(before) || WORD_CHAR.test(after)) {
        from = at + 1
        continue
      }
    }
    out.push({ start: at, end })
    from = end || at + 1
  }
  return out
}

/** Map a global offset to (segment, local offset). */
export function locate(index: TextIndex, offset: number): { segment: number; offset: number } {
  const { starts } = index
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid]! <= offset) lo = mid
    else hi = mid - 1
  }
  return { segment: lo, offset: offset - (starts[lo] ?? 0) }
}

/** Split a match into per-segment parts (a match may span several segments). */
export function splitMatch(index: TextIndex, match: IndexMatch): MatchPart[] {
  const parts: MatchPart[] = []
  let pos = match.start
  while (pos < match.end) {
    const { segment, offset } = locate(index, pos)
    const segLen = index.segments[segment]!.length
    const take = Math.min(segLen - offset, match.end - pos)
    if (take <= 0) {
      // Empty segment; move to the next one.
      pos = (index.starts[segment + 1] ?? match.end)
      continue
    }
    parts.push({ segment, start: offset, end: offset + take })
    pos += take
  }
  return parts
}
