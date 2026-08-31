import { describe, it, expect } from 'vitest'
import { renderDocument } from '../../src/core/render'
import { UnsupportedFormatError } from '../../src/core/types'
import type { Renderer } from '../../src/core/types'

const fake: Renderer = async ({ container, bytes }) => {
  container.textContent = `fake:${bytes.length}`
  return { type: 'fake', meta: { type: 'fake', pageCount: 1 }, destroy: () => container.replaceChildren() }
}

describe('renderDocument with custom renderers', () => {
  it('uses a per-call renderer for a custom type', async () => {
    const container = document.createElement('div')
    const r = await renderDocument({ container, source: new Uint8Array([1, 2, 3]), type: 'fake', renderers: { fake: async () => ({ render: fake }) } })
    expect(r.type).toBe('fake')
    expect(container.textContent).toBe('fake:3')
    r.destroy()
  })

  it('lets a per-call renderer override a built-in format', async () => {
    const container = document.createElement('div')
    const r = await renderDocument({ container, source: new File(['hi'], 'a.txt'), renderers: { text: async () => ({ render: fake }) } })
    expect(container.textContent).toBe('fake:2')
    r.destroy()
  })

  it('renders undetectable input with the fallback renderer', async () => {
    const container = document.createElement('div')
    const garbage = new Uint8Array([0, 1, 2, 3, 4])
    await expect(renderDocument({ container, source: garbage })).rejects.toThrow()
    const r = await renderDocument({ container, source: garbage, fallback: 'fake', renderers: { fake: async () => ({ render: fake }) } })
    expect(r.type).toBe('fake')
    r.destroy()
  })

  it('rejects an unknown type with UnsupportedFormatError', async () => {
    const container = document.createElement('div')
    await expect(renderDocument({ container, source: new Uint8Array([1]), type: 'nope' })).rejects.toBeInstanceOf(UnsupportedFormatError)
  })
})
