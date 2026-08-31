import { describe, it, expect } from 'vitest'
import { RenderError, UnsupportedFormatError } from '../../src/core/types'

describe('RenderError', () => {
  it('carries a machine-readable code, the format and structured details', () => {
    const err = new RenderError('engine parsed 0 slides', 'PPTX_NO_SLIDES', 'pptx', {
      slideParts: 3,
    })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('RenderError')
    expect(err.code).toBe('PPTX_NO_SLIDES')
    expect(err.format).toBe('pptx')
    expect(err.details).toEqual({ slideParts: 3 })
    expect(err.message).toBe('engine parsed 0 slides')
  })

  it('keeps the existing error classes distinct', () => {
    expect(new UnsupportedFormatError('x')).not.toBeInstanceOf(RenderError)
  })
})
