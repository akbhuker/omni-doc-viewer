import { describe, it, expect, afterEach } from 'vitest'
import { registerRenderer, unregisterRenderer, resolveRendererLoader, getRegisteredRenderers } from '../../src/core/registry'
import { detect, detectFromExtension } from '../../src/core/detect'
import type { Renderer } from '../../src/core/types'

const fakeRender: Renderer = async ({ container }) => {
  container.textContent = 'fake'
  return { type: 'fake', meta: { type: 'fake' }, destroy: () => container.replaceChildren() }
}
const load = async () => ({ render: fakeRender })

afterEach(() => {
  for (const type of getRegisteredRenderers().keys()) unregisterRenderer(type)
})

describe('registerRenderer', () => {
  it('maps extensions and mime types to a custom type', () => {
    registerRenderer('dicom', { load, extensions: ['dcm', 'DICOM'], mimeTypes: ['application/dicom'] })
    expect(detect({ bytes: new Uint8Array([0, 0, 0]), filename: 'scan.dcm' })).toBe('dicom')
    expect(detect({ bytes: new Uint8Array([0, 0, 0]), filename: 'x.dicom' })).toBe('dicom')
    expect(detect({ bytes: new Uint8Array([0, 0, 0]), mime: 'application/dicom' })).toBe('dicom')
  })

  it('lets a magic-byte sniffer win over the built-in text fallback', () => {
    registerRenderer('dicom', { load, sniff: (b) => b.length > 131 && b[128] === 0x44 && b[129] === 0x49 && b[130] === 0x43 && b[131] === 0x4d })
    const bytes = new Uint8Array(140)
    bytes.set([0x44, 0x49, 0x43, 0x4d], 128) // "DICM" at offset 128 (rest is text-like zeros → would be 'text')
    bytes.fill(0x20, 0, 128)
    expect(detect({ bytes })).toBe('dicom')
  })

  it('can override a built-in extension, and unregister restores it', () => {
    registerRenderer('svg-pro', { load, extensions: ['svg'] })
    expect(detect({ bytes: new Uint8Array([0x3c]), filename: 'a.svg' })).toBe('svg-pro')
    unregisterRenderer('svg-pro')
    expect(detect({ bytes: new Uint8Array([0x3c]), filename: 'a.svg' })).toBe('image')
    expect(detectFromExtension('a.svg')).toBe('image')
  })

  it('returns an unregister function', () => {
    const off = registerRenderer('x', { load, extensions: ['xx'] })
    expect(detect({ bytes: new Uint8Array([1]), filename: 'a.xx' })).toBe('x')
    off()
    expect(() => detect({ bytes: new Uint8Array([1]), filename: 'a.xx' })).toThrow()
  })
})

describe('resolveRendererLoader precedence', () => {
  it('prefers per-call renderers over the global registry over built-ins', async () => {
    const local = async () => ({ render: fakeRender })
    const global = async () => ({ render: fakeRender })
    registerRenderer('pdf', global)
    expect(resolveRendererLoader('pdf', { pdf: local })).toBe(local)
    expect(resolveRendererLoader('pdf')).toBe(global)
    unregisterRenderer('pdf')
    const builtin = resolveRendererLoader('pdf')
    expect(builtin).toBeTypeOf('function')
    expect(builtin).not.toBe(global)
    expect(resolveRendererLoader('nope')).toBeUndefined()
  })
})
