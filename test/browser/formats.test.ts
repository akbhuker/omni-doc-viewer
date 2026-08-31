import { describe, it, expect, afterEach } from 'vitest'
import { renderDocument } from '../../src/core'
import type { RenderResult } from '../../src/core'

let result: RenderResult | undefined
let container: HTMLDivElement
afterEach(() => {
  result?.destroy()
  container?.remove()
})

describe('html renderer (real DOMPurify + iframe sandbox)', () => {
  it('strips scripts and event handlers and never lets them run', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    ;(window as any).pwned = 0
    const html = '<h1>Hello</h1><script>parent.pwned = 1</script><img src=x onerror="parent.pwned=2"><a href="javascript:parent.pwned=3">x</a>'
    const warnings: string[] = []
    result = await renderDocument({ container, source: new File([html], 'page.html'), onWarning: (w) => warnings.push(w.code) })
    const iframe = container.querySelector('iframe')!
    const doc = iframe.getAttribute('srcdoc') ?? ''
    expect(doc).toContain('<h1>Hello</h1>')
    expect(doc).not.toContain('<script')
    expect(doc).not.toContain('onerror')
    expect(doc).not.toContain('javascript:')
    expect(warnings).not.toContain('html/unsanitized')
    await new Promise((r) => setTimeout(r, 200))
    expect((window as any).pwned).toBe(0)
  })
})

describe('media renderers', () => {
  it('renders a playable <video> from bytes', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    // A tiny valid-looking mp4 header is enough for detection; playback isn't asserted.
    const bytes = new Uint8Array([0, 0, 0, 0x18, ...[...'ftypisom'].map((c) => c.charCodeAt(0)), 0, 0, 0, 0])
    result = await renderDocument({ container, source: bytes })
    expect(result.type).toBe('video')
    expect(container.querySelector('video')?.src).toMatch(/^blob:/)
  })
})
