import { describe, it, expect } from 'vitest'
import { buildIndex, findMatches, locate, splitMatch } from '../../src/core/search/text-index'

describe('buildIndex', () => {
  it('concatenates segments and records where each starts', () => {
    const idx = buildIndex(['Hello ', 'World'])
    expect(idx.text).toBe('Hello World')
    expect(idx.starts).toEqual([0, 6])
  })
})

describe('findMatches', () => {
  it('is case-insensitive by default and keeps offsets aligned with the original text', () => {
    const idx = buildIndex(['Straße İstanbul', ' straße'])
    const m = findMatches(idx, 'STRASSE')
    expect(m).toEqual([]) // no length-changing folding: ß stays ß
    const m2 = findMatches(idx, 'straße')
    expect(m2.map((x) => [x.start, x.end])).toEqual([
      [0, 6],
      [16, 22],
    ])
  })

  it('supports case-sensitive and whole-word matching', () => {
    const idx = buildIndex(['cat concatenate Cat'])
    expect(findMatches(idx, 'cat').length).toBe(3)
    expect(findMatches(idx, 'cat', { caseSensitive: true }).length).toBe(2)
    expect(findMatches(idx, 'cat', { wholeWord: true }).map((m) => m.start)).toEqual([0, 16])
  })

  it('returns nothing for an empty or whitespace-only query', () => {
    const idx = buildIndex(['anything'])
    expect(findMatches(idx, '')).toEqual([])
    expect(findMatches(idx, '   ')).toEqual([])
  })

  it('finds matches that span segment boundaries', () => {
    const idx = buildIndex(['Page ', '150', ' of 200'])
    const m = findMatches(idx, 'Page 150')
    expect(m).toHaveLength(1)
    expect(splitMatch(idx, m[0]!)).toEqual([
      { segment: 0, start: 0, end: 5 },
      { segment: 1, start: 0, end: 3 },
    ])
  })
})

describe('locate', () => {
  it('maps a global offset to a segment and local offset', () => {
    const idx = buildIndex(['ab', 'cde', 'f'])
    expect(locate(idx, 0)).toEqual({ segment: 0, offset: 0 })
    expect(locate(idx, 2)).toEqual({ segment: 1, offset: 0 })
    expect(locate(idx, 4)).toEqual({ segment: 1, offset: 2 })
    expect(locate(idx, 5)).toEqual({ segment: 2, offset: 0 })
  })
})
