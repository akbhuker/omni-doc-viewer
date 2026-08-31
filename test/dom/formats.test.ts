import { describe, it, expect } from 'vitest'
import { renderDocument } from '../../src/core/render'

const mount = () => {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('video / audio', () => {
  it('renders a <video controls> from a blob URL', async () => {
    const container = mount()
    const r = await renderDocument({ container, source: new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' }) })
    const video = container.querySelector('video')!
    expect(r.type).toBe('video')
    expect(video.hasAttribute('controls')).toBe(true)
    expect(video.getAttribute('src')).toMatch(/^blob:/)
    r.destroy()
    expect(container.childElementCount).toBe(0)
  })

  it('renders an <audio controls> element', async () => {
    const container = mount()
    const r = await renderDocument({ container, source: new File([new Uint8Array([1])], 'song.mp3') })
    expect(r.type).toBe('audio')
    expect(container.querySelector('audio')?.hasAttribute('controls')).toBe(true)
    r.destroy()
  })
})

describe('html', () => {
  it('renders in a fully sandboxed iframe (sanitization itself is verified in the browser suite)', async () => {
    const container = mount()
    const html = '<h1>Hello</h1><script>window.pwned = 1</script>'
    const warnings: string[] = []
    const r = await renderDocument({ container, source: new File([html], 'page.html'), onWarning: (w) => warnings.push(w.code) })
    const iframe = container.querySelector('iframe')!
    expect(r.type).toBe('html')
    expect(iframe.getAttribute('sandbox')).toBe('')
    expect(iframe.getAttribute('srcdoc') ?? '').toContain('<h1>Hello</h1>')
    // happy-dom can't run DOMPurify; the renderer must say so rather than pretend.
    if ((iframe.getAttribute('srcdoc') ?? '').includes('<script')) expect(warnings).toContain('html/unsanitized')
    r.destroy()
  })

  it('can skip sanitization explicitly', async () => {
    const container = mount()
    const r = await renderDocument({ container, source: new File(['<b>x</b>'], 'page.html'), html: { sanitize: false, height: '300px' } })
    const iframe = container.querySelector('iframe')!
    expect(iframe.style.height).toBe('300px')
    r.destroy()
  })
})

describe('json', () => {
  it('pretty-prints valid JSON with line numbers', async () => {
    const container = mount()
    const r = await renderDocument({ container, source: new File(['{"a":1,"b":[1,2]}'], 'data.json') })
    expect(r.type).toBe('json')
    const pre = container.querySelector('pre.odv-code')!
    expect(pre.textContent).toContain('"a": 1')
    expect(container.querySelectorAll('.odv-code-line').length).toBeGreaterThan(3)
    r.destroy()
  })

  it('falls back to the raw text for invalid JSON', async () => {
    const container = mount()
    const r = await renderDocument({ container, source: new File(['{not json'], 'data.json') })
    expect(container.textContent).toContain('{not json')
    r.destroy()
  })
})

describe('code', () => {
  it('renders source with line numbers and a language class', async () => {
    const container = mount()
    const r = await renderDocument({ container, source: new File(['const a = 1\nconst b = 2\n'], 'index.ts') })
    expect(r.type).toBe('code')
    const pre = container.querySelector('pre.odv-code')!
    expect(pre.getAttribute('data-language')).toBe('ts')
    const lines = container.querySelectorAll('.odv-code-line')
    expect(lines).toHaveLength(2)
    expect(lines[1]!.querySelector('.odv-code-ln')?.textContent).toBe('2')
    expect(r.search).toBeDefined()
    r.destroy()
  })
})
