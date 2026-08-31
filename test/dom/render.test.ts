import { describe, it, expect, vi } from 'vitest'
import { renderDocument } from '../../src/core/render'

describe('renderDocument result', () => {
  it('exposes the rendered bytes and the filename so callers can download/print without re-fetching', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const file = new File(['hello world'], 'notes.txt', { type: 'text/plain' })

    const result = await renderDocument({ container, source: file })

    expect(result.type).toBe('text')
    expect(result.filename).toBe('notes.txt')
    expect(new TextDecoder().decode(result.bytes)).toBe('hello world')
    result.destroy()
  })

  it('accepts an onWarning callback (used by renderers to report recoverable problems)', async () => {
    const container = document.createElement('div')
    const onWarning = vi.fn()
    const result = await renderDocument({
      container,
      source: new File(['x'], 'a.txt'),
      onWarning,
    })
    expect(result.type).toBe('text')
    expect(onWarning).not.toHaveBeenCalled()
  })
})
