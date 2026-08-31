import { describe, it, expect, vi, afterEach } from 'vitest'
import { normalizeSource } from '../../src/core/source'

const enc = (s: string) => new TextEncoder().encode(s)

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]!)
      else controller.close()
    },
  })
}

describe('normalizeSource — fetch options', () => {
  afterEach(() => vi.restoreAllMocks())

  it('forwards headers and credentials from a RequestInit object', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(enc('%PDF-1.7'), { status: 200 }))

    await normalizeSource('https://files.example.com/a.pdf', {
      fetchOptions: { headers: { Authorization: 'Bearer t' }, credentials: 'include' },
    })

    const init = fetchSpy.mock.calls[0]![1] as RequestInit
    expect(init.headers).toEqual({ Authorization: 'Bearer t' })
    expect(init.credentials).toBe('include')
    expect(init.signal).toBeUndefined()
  })

  it('accepts a function that builds the RequestInit per URL (e.g. signing)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(enc('x')))
    const fetchOptions = vi.fn(async (url: string) => ({ headers: { 'X-Url': url } }))

    await normalizeSource('https://x.test/doc.txt', { fetchOptions })

    expect(fetchOptions).toHaveBeenCalledWith('https://x.test/doc.txt')
    expect((fetchSpy.mock.calls[0]![1] as RequestInit).headers).toEqual({
      'X-Url': 'https://x.test/doc.txt',
    })
  })

  it('keeps the abort signal ours even when the caller passes one in fetchOptions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(enc('x')))
    const ours = new AbortController()
    const theirs = new AbortController()

    await normalizeSource('https://x.test/a.txt', {
      signal: ours.signal,
      fetchOptions: { signal: theirs.signal },
    })

    expect((fetchSpy.mock.calls[0]![1] as RequestInit).signal).toBe(ours.signal)
  })

  it('still supports the legacy positional (source, signal) call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(enc('x')))
    const c = new AbortController()
    await normalizeSource('https://x.test/a.txt', c.signal)
    expect((fetchSpy.mock.calls[0]![1] as RequestInit).signal).toBe(c.signal)
  })
})

describe('normalizeSource — progress', () => {
  afterEach(() => vi.restoreAllMocks())

  it('streams the body and reports loaded/total from Content-Length', async () => {
    const chunks = [enc('ab'), enc('cd'), enc('ef')]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(streamOf(chunks), { headers: { 'content-length': '6' } }),
    )
    const onProgress = vi.fn()

    const { bytes } = await normalizeSource('https://x.test/a.txt', { onProgress })

    expect(new TextDecoder().decode(bytes)).toBe('abcdef')
    expect(onProgress.mock.calls).toEqual([
      [2, 6],
      [4, 6],
      [6, 6],
    ])
  })

  it('reports an unknown total when the response is content-encoded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(streamOf([enc('abc')]), {
        headers: { 'content-length': '20', 'content-encoding': 'gzip' },
      }),
    )
    const onProgress = vi.fn()
    await normalizeSource('https://x.test/a.txt', { onProgress })
    expect(onProgress).toHaveBeenLastCalledWith(3, undefined)
  })

  it('reports 100% once for File/Blob sources', async () => {
    const onProgress = vi.fn()
    await normalizeSource(new Blob([enc('hello')]), { onProgress })
    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith(5, 5)
  })
})

describe('normalizeSource — new source kinds', () => {
  afterEach(() => vi.restoreAllMocks())

  it('decodes base64 data: URLs locally without fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { bytes, mime } = await normalizeSource('data:text/plain;base64,aGVsbG8=')
    expect(new TextDecoder().decode(bytes)).toBe('hello')
    expect(mime).toBe('text/plain')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('decodes percent-encoded data: URLs', async () => {
    const { bytes, mime } = await normalizeSource('data:text/csv,a%2Cb%0A1%2C2')
    expect(new TextDecoder().decode(bytes)).toBe('a,b\n1,2')
    expect(mime).toBe('text/csv')
  })

  it('accepts a { base64 } object with filename and mime hints', async () => {
    const { bytes, filename, mime } = await normalizeSource({
      base64: 'aGVsbG8=',
      filename: 'greeting.txt',
      mime: 'text/plain',
    })
    expect(new TextDecoder().decode(bytes)).toBe('hello')
    expect(filename).toBe('greeting.txt')
    expect(mime).toBe('text/plain')
  })

  it('accepts an already-fetched Response, taking filename from Content-Disposition and mime from Content-Type', async () => {
    const res = new Response(enc('%PDF-1.7'), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="quarterly report.pdf"',
      },
    })
    const { bytes, filename, mime } = await normalizeSource(res)
    expect(new TextDecoder().decode(bytes)).toBe('%PDF-1.7')
    expect(filename).toBe('quarterly report.pdf')
    expect(mime).toBe('application/pdf')
  })

  it('prefers the RFC 5987 filename* form when present', async () => {
    const res = new Response(enc('x'), {
      headers: { 'content-disposition': "attachment; filename=\"fallback.txt\"; filename*=UTF-8''r%C3%A9sum%C3%A9.txt" },
    })
    expect((await normalizeSource(res)).filename).toBe('résumé.txt')
  })

  it('ignores a generic application/octet-stream content type', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(enc('x'), { headers: { 'content-type': 'application/octet-stream' } }),
    )
    expect((await normalizeSource('https://x.test/file')).mime).toBeUndefined()
  })

  it('still rejects unsupported input with a TypeError', async () => {
    await expect(normalizeSource(42 as any)).rejects.toBeInstanceOf(TypeError)
  })
})
