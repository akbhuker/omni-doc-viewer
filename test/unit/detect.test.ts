import { describe, it, expect } from 'vitest'
import {
  detect,
  detectFromBytes,
  detectFromExtension,
} from '../../src/core/detect'
import { UnsupportedFormatError, FormatDetectionError } from '../../src/core/types'

function ascii(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0))
}

function utf16le(s: string): number[] {
  const out: number[] = []
  for (const c of s) {
    out.push(c.charCodeAt(0), 0)
  }
  return out
}

function buf(...parts: number[][]): Uint8Array {
  return Uint8Array.from(parts.flat())
}

const PDF_SIG = [0x25, 0x50, 0x44, 0x46] // %PDF
const ZIP_SIG = [0x50, 0x4b, 0x03, 0x04] // PK\x03\x04
const OLE_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const PAD = new Array(16).fill(0)

describe('detectFromExtension', () => {
  it('maps known extensions', () => {
    expect(detectFromExtension('a.pdf')).toBe('pdf')
    expect(detectFromExtension('a.docx')).toBe('docx')
    expect(detectFromExtension('a.xlsx')).toBe('xlsx')
    expect(detectFromExtension('a.xls')).toBe('xlsx')
    expect(detectFromExtension('a.pptx')).toBe('pptx')
  })

  it('handles URLs with query/hash and casing', () => {
    expect(detectFromExtension('https://x.com/My.PDF?token=1#p2')).toBe('pdf')
  })

  it('maps text, image and data extensions', () => {
    expect(detectFromExtension('a.txt')).toBe('text')
    expect(detectFromExtension('a.md')).toBe('markdown')
    expect(detectFromExtension('a.csv')).toBe('csv')
    expect(detectFromExtension('a.tsv')).toBe('csv')
    expect(detectFromExtension('a.png')).toBe('image')
    expect(detectFromExtension('a.svg')).toBe('image')
  })

  it('returns undefined for unknown/legacy extensions', () => {
    expect(detectFromExtension('a.doc')).toBeUndefined()
    expect(detectFromExtension('a.ppt')).toBeUndefined()
    expect(detectFromExtension('a.xyz')).toBeUndefined()
  })
})

describe('detectFromBytes (no filename)', () => {
  it('detects PDF by magic', () => {
    expect(detectFromBytes(buf(PDF_SIG, ascii('-1.7')))).toBe('pdf')
  })

  it('disambiguates OOXML by internal path', () => {
    expect(detectFromBytes(buf(ZIP_SIG, PAD, ascii('word/document.xml')))).toBe('docx')
    expect(detectFromBytes(buf(ZIP_SIG, PAD, ascii('ppt/presentation.xml')))).toBe('pptx')
    expect(detectFromBytes(buf(ZIP_SIG, PAD, ascii('xl/workbook.xml')))).toBe('xlsx')
  })

  it('throws for an unrecognizable zip', () => {
    expect(() => detectFromBytes(buf(ZIP_SIG, PAD, ascii('foo/bar.txt')))).toThrow(
      FormatDetectionError,
    )
  })

  it('reads legacy .xls (OLE Workbook stream) as xlsx', () => {
    expect(detectFromBytes(buf(OLE_SIG, PAD, utf16le('Workbook')))).toBe('xlsx')
  })

  it('throws UnsupportedFormatError for legacy .doc', () => {
    expect(() => detectFromBytes(buf(OLE_SIG, PAD, utf16le('WordDocument')))).toThrow(
      UnsupportedFormatError,
    )
  })

  it('throws UnsupportedFormatError for legacy .ppt', () => {
    expect(() =>
      detectFromBytes(buf(OLE_SIG, PAD, utf16le('PowerPoint Document'))),
    ).toThrow(UnsupportedFormatError)
  })

  it('detects images by magic bytes', () => {
    expect(detectFromBytes(buf([0x89, 0x50, 0x4e, 0x47]))).toBe('image') // PNG
    expect(detectFromBytes(buf([0xff, 0xd8, 0xff, 0xe0]))).toBe('image') // JPEG
    expect(detectFromBytes(buf([0x47, 0x49, 0x46, 0x38]))).toBe('image') // GIF
  })

  it('falls back to text for plain UTF-8 content', () => {
    expect(detectFromBytes(buf(ascii('hello, just some plain text\n')))).toBe('text')
  })

  it('returns undefined for garbage', () => {
    expect(detectFromBytes(buf([0x00, 0x01, 0x02, 0x03]))).toBeUndefined()
  })
})

describe('detect (priority: override > extension > bytes)', () => {
  it('honors an explicit override over everything', () => {
    expect(detect({ bytes: buf(PDF_SIG), filename: 'x.docx', override: 'pdf' })).toBe('pdf')
  })

  it('uses the extension when present', () => {
    expect(detect({ bytes: buf([0, 0, 0, 0]), filename: 'report.pdf' })).toBe('pdf')
  })

  it('falls back to bytes when no usable extension', () => {
    expect(detect({ bytes: buf(ZIP_SIG, PAD, ascii('xl/workbook.xml')), filename: 'data' })).toBe(
      'xlsx',
    )
  })

  it('throws the precise error for a .doc filename', () => {
    expect(() => detect({ bytes: buf(OLE_SIG), filename: 'old.doc' })).toThrow(
      UnsupportedFormatError,
    )
  })

  it('throws FormatDetectionError when nothing matches', () => {
    expect(() => detect({ bytes: buf([1, 2, 3, 4]) })).toThrow(FormatDetectionError)
  })
})
