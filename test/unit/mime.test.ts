import { describe, it, expect } from 'vitest'
import { detect } from '../../src/core/detect'
import { docTypeFromMime } from '../../src/core/mime'

describe('docTypeFromMime', () => {
  it('maps common document MIME types', () => {
    expect(docTypeFromMime('application/pdf')).toBe('pdf')
    expect(docTypeFromMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('docx')
    expect(docTypeFromMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('xlsx')
    expect(docTypeFromMime('application/vnd.ms-excel')).toBe('xlsx')
    expect(docTypeFromMime('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('pptx')
    expect(docTypeFromMime('image/png')).toBe('image')
    expect(docTypeFromMime('image/svg+xml')).toBe('image')
    expect(docTypeFromMime('text/markdown')).toBe('markdown')
    expect(docTypeFromMime('text/csv')).toBe('csv')
    expect(docTypeFromMime('text/plain; charset=utf-8')).toBe('text')
  })

  it('returns undefined for generic or unknown types', () => {
    expect(docTypeFromMime('application/octet-stream')).toBeUndefined()
    expect(docTypeFromMime('application/zip')).toBeUndefined()
    expect(docTypeFromMime(undefined)).toBeUndefined()
  })
})

describe('detect() with a mime hint', () => {
  it('uses the mime type when the filename has no usable extension', () => {
    const bytes = Uint8Array.from([0, 0, 0, 0])
    expect(detect({ bytes, filename: 'download', mime: 'application/pdf' })).toBe('pdf')
  })

  it('lets the extension win over the mime type', () => {
    const bytes = Uint8Array.from([0, 0, 0, 0])
    expect(detect({ bytes, filename: 'a.csv', mime: 'text/plain' })).toBe('csv')
  })

  it('still falls back to magic bytes when the mime is generic', () => {
    const bytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46])
    expect(detect({ bytes, mime: 'application/octet-stream' })).toBe('pdf')
  })
})
