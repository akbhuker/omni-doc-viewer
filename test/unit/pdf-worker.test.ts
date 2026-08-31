import { describe, it, expect, vi } from 'vitest'
import {
  resolvePdfWorker,
  cdnBaseFor,
  assetUrlsFrom,
  workerBaseOf,
  type WorkerProbe,
} from '../../src/core/renderers/pdf/worker'

const ok: WorkerProbe = vi.fn(async () => ({ ok: true }))
const notFound: WorkerProbe = vi.fn(async () => ({ ok: false, reason: 'HTTP 404' }))
const html: WorkerProbe = vi.fn(async () => ({ ok: false, reason: 'content-type text/html' }))

describe('resolvePdfWorker', () => {
  it('uses an explicit workerSrc as-is, without probing it', async () => {
    const probe = vi.fn(async () => ({ ok: true }))
    const r = await resolvePdfWorker({ explicit: '/pdf.worker.min.mjs', bundled: 'http://x/b.mjs', version: '6.3.289', probe })
    expect(r).toEqual({ strategy: 'explicit', src: '/pdf.worker.min.mjs' })
    expect(probe).not.toHaveBeenCalled()
  })

  it('uses the bundler-resolved worker when the probe succeeds', async () => {
    const r = await resolvePdfWorker({ bundled: 'http://app/assets/pdf.worker.min-abc.mjs', version: '6.3.289', probe: ok })
    expect(r).toEqual({ strategy: 'bundled', src: 'http://app/assets/pdf.worker.min-abc.mjs' })
  })

  it('falls back to the version-matched jsDelivr worker when the bundled URL fails and cdn is enabled', async () => {
    const r = await resolvePdfWorker({ bundled: 'http://app/pdf.worker.min.mjs', version: '6.3.289', cdn: true, probe: notFound })
    expect(r.strategy).toBe('cdn')
    expect(r.src).toBe('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs')
    expect(r.warning?.code).toBe('pdf/worker-fallback-cdn')
  })

  it('supports a custom CDN template with {version}', async () => {
    const r = await resolvePdfWorker({
      bundled: 'http://app/w.mjs',
      version: '6.3.289',
      cdn: 'https://unpkg.com/pdfjs-dist@{version}/',
      probe: html,
    })
    expect(r.src).toBe('https://unpkg.com/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs')
  })

  it('ends with the fake-worker strategy (and a warning) when nothing loads and cdn is off', async () => {
    const r = await resolvePdfWorker({ bundled: 'http://app/w.mjs', version: '6.3.289', probe: html })
    expect(r.strategy).toBe('fake')
    expect(r.src).toBe('http://app/w.mjs')
    expect(r.warning?.code).toBe('pdf/fake-worker')
    expect(r.warning?.message).toMatch(/content-type text\/html/)
  })

  it('goes straight to the CDN/fake path when no bundled URL could be resolved', async () => {
    const r = await resolvePdfWorker({ version: '6.3.289', cdn: true, probe: ok })
    expect(r.strategy).toBe('cdn')
  })
})

describe('worker/asset URL helpers', () => {
  it('cdnBaseFor builds a jsDelivr base by default and honours a template', () => {
    expect(cdnBaseFor('6.3.289', true)).toBe('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/')
    expect(cdnBaseFor('6.3.289', 'https://unpkg.com/pdfjs-dist@{version}')).toBe('https://unpkg.com/pdfjs-dist@6.3.289/')
  })

  it('workerBaseOf derives the package base from a build/ worker URL, else undefined', () => {
    expect(workerBaseOf('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs')).toBe(
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/',
    )
    expect(workerBaseOf('/vendor/pdfjs/build/pdf.worker.mjs')).toBe('/vendor/pdfjs/')
    expect(workerBaseOf('http://app/assets/pdf.worker.min-abc123.mjs')).toBeUndefined()
  })

  it('assetUrlsFrom points at the cmaps/, standard_fonts/, wasm/ and iccs/ folders', () => {
    expect(assetUrlsFrom('https://cdn/pdfjs-dist@6/')).toEqual({
      cMapUrl: 'https://cdn/pdfjs-dist@6/cmaps/',
      standardFontDataUrl: 'https://cdn/pdfjs-dist@6/standard_fonts/',
      wasmUrl: 'https://cdn/pdfjs-dist@6/wasm/',
      iccUrl: 'https://cdn/pdfjs-dist@6/iccs/',
    })
    expect(assetUrlsFrom('/pdfjs')).toEqual({
      cMapUrl: '/pdfjs/cmaps/',
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      wasmUrl: '/pdfjs/wasm/',
      iccUrl: '/pdfjs/iccs/',
    })
  })
})
