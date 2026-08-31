import { describe, it, expect, vi } from 'vitest'
import { rasterizeMetafile } from '../../src/core/renderers/pptx/metafile'

describe('rasterizeMetafile', () => {
  const buffer = new Uint8Array([1, 2, 3]).buffer

  it('converts EMF with the v2 options object (size cap + 2x dpi for crisp slides)', async () => {
    const converter = {
      convertEmfToDataUrl: vi.fn(async () => 'data:image/png;base64,AAA'),
      convertWmfToDataUrl: vi.fn(async () => null),
    }
    const url = await rasterizeMetafile(buffer, 'emf', converter)
    expect(url).toBe('data:image/png;base64,AAA')
    expect(converter.convertEmfToDataUrl).toHaveBeenCalledWith(buffer, {
      maxWidth: 2000,
      maxHeight: 2000,
      dpiScale: 2,
    })
    expect(converter.convertWmfToDataUrl).not.toHaveBeenCalled()
  })

  it('routes WMF to the WMF converter and maps a null result to undefined', async () => {
    const converter = {
      convertEmfToDataUrl: vi.fn(async () => 'x'),
      convertWmfToDataUrl: vi.fn(async () => null),
    }
    const url = await rasterizeMetafile(buffer, 'wmf', converter)
    expect(url).toBeUndefined()
    expect(converter.convertWmfToDataUrl).toHaveBeenCalledOnce()
  })

  it('never throws — a converter failure yields undefined so the image is hidden, not broken', async () => {
    const converter = {
      convertEmfToDataUrl: vi.fn(async () => {
        throw new Error('bad header')
      }),
      convertWmfToDataUrl: vi.fn(async () => null),
    }
    await expect(rasterizeMetafile(buffer, 'emf', converter)).resolves.toBeUndefined()
  })
})
