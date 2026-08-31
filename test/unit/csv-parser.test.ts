import { describe, it, expect } from 'vitest'
import { parseDelimited, parseRows, sniffDelimiter } from '../../src/core/renderers/csv/parser'

describe('parseDelimited', () => {
  it('handles quoted fields, escaped quotes and newlines inside quotes (RFC 4180)', () => {
    const rows = parseDelimited('a,"b ""quoted""","multi\nline"\r\n1,2,3\n', ',')
    expect(rows).toEqual([
      ['a', 'b "quoted"', 'multi\nline'],
      ['1', '2', '3'],
    ])
  })

  it('keeps a trailing empty field and ragged rows as-is', () => {
    expect(parseDelimited('a,b,\n1,2\n', ',')).toEqual([
      ['a', 'b', ''],
      ['1', '2'],
    ])
  })

  it('treats a quote inside an unquoted field as a literal character', () => {
    expect(parseDelimited('5" screen,x\n', ',')).toEqual([['5" screen', 'x']])
  })

  it('skips completely empty lines', () => {
    expect(parseDelimited('a,b\n\n1,2\n\n', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('supports a maximum row count and reports the total', () => {
    const text = Array.from({ length: 10 }, (_, i) => `${i},x`).join('\n')
    const r = parseRows(text, ',', { maxRows: 4 })
    expect(r.rows).toHaveLength(4)
    expect(r.total).toBe(10)
  })
})

describe('sniffDelimiter', () => {
  it('picks the delimiter whose field count is consistent across lines', () => {
    expect(sniffDelimiter('a,b,c\n1,2,3\n4,5,6')).toBe(',')
    expect(sniffDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
    expect(sniffDelimiter('a|b|c\n1|2|3')).toBe('|')
  })

  it('handles European files: semicolons with decimal commas', () => {
    expect(sniffDelimiter('Name;Preis;Menge\nApfel;1,5;3\nBirne;2,25;10')).toBe(';')
  })

  it('ignores delimiters inside quotes', () => {
    expect(sniffDelimiter('"a;b",c\n"d;e",f')).toBe(',')
  })

  it('falls back to comma for a single column', () => {
    expect(sniffDelimiter('just\none\ncolumn')).toBe(',')
  })
})
