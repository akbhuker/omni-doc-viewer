/**
 * pdf.js integration options, verified against a fake `pdfjs-dist` so the
 * expectations are about what WE pass to the engine.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface FakeState {
  getDocumentArgs: any[]
  loadingTask: any
  workerSrc: string | undefined
}
const state: FakeState = { getDocumentArgs: [], loadingTask: null, workerSrc: undefined }

vi.mock('pdfjs-dist', () => {
  const GlobalWorkerOptions = {
    get workerSrc() {
      return state.workerSrc
    },
    set workerSrc(v: string | undefined) {
      state.workerSrc = v
    },
    workerPort: null as unknown,
  }
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({ width: 612 * scale, height: 792 * scale, scale }),
    render: () => ({ promise: Promise.resolve(), cancel() {} }),
    streamTextContent: () => new ReadableStream({ start: (c) => c.close() }),
    getTextContent: async () => ({ items: [] }),
    getAnnotations: async () => [],
    cleanup() {},
    userUnit: 1,
  }
  const pdf = { numPages: 1, getPage: async () => page }
  return {
    version: '6.3.289',
    GlobalWorkerOptions,
    PasswordResponses: { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 },
    TextLayer: class {
      constructor(_o: unknown) {}
      async render() {}
      update() {}
      static cleanup() {}
    },
    AnnotationLayer: class {
      constructor(_o: unknown) {}
      async render() {}
    },
    getDocument: (params: any) => {
      state.getDocumentArgs.push(params)
      const task: any = {
        onPassword: undefined as undefined | ((update: (p: string | Error) => void, reason: number) => void),
        destroy: vi.fn(async () => {}),
      }
      task.promise = new Promise((resolve, reject) => {
        queueMicrotask(() => {
          const encrypted = new TextDecoder().decode(params.data).includes('ENCRYPTED')
          if (!encrypted) return resolve(pdf)
          const attempt = (reason: number) => {
            if (!task.onPassword) return reject(Object.assign(new Error('No password given'), { name: 'PasswordException', code: reason }))
            task.onPassword((pw: string | Error) => {
              if (pw instanceof Error) return reject(Object.assign(pw, { name: 'PasswordException', code: reason }))
              if (pw === 'secret') resolve(pdf)
              else attempt(2)
            }, reason)
          }
          attempt(1)
        })
      })
      state.loadingTask = task
      return task
    },
  }
})

import { renderDocument } from '../../src/core/render'
import { RenderError } from '../../src/core/types'
import { setPdfWorkerSrc } from '../../src/core/renderers/pdf'

const pdfBytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
const encryptedBytes = new TextEncoder().encode('%PDF-1.7 ENCRYPTED')

describe('pdf renderer options', () => {
  beforeEach(() => {
    state.getDocumentArgs = []
    state.workerSrc = undefined
    setPdfWorkerSrc('/test-worker.mjs') // explicit → no network probe in tests
  })

  it('passes a static password through to getDocument', async () => {
    const container = document.createElement('div')
    const r = await renderDocument({ container, source: pdfBytes, pdf: { password: 'secret' } })
    expect(state.getDocumentArgs[0].password).toBe('secret')
    r.destroy()
  })

  it('derives cMapUrl / standardFontDataUrl / wasmUrl from an explicit assetsUrl', async () => {
    const container = document.createElement('div')
    const r = await renderDocument({ container, source: pdfBytes, pdf: { assetsUrl: '/vendor/pdfjs/' } })
    expect(state.getDocumentArgs[0]).toMatchObject({
      cMapUrl: '/vendor/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/vendor/pdfjs/standard_fonts/',
      wasmUrl: '/vendor/pdfjs/wasm/',
      iccUrl: '/vendor/pdfjs/iccs/',
    })
    r.destroy()
  })

  it('derives the asset folders from a build/ worker URL when no assetsUrl is given', async () => {
    setPdfWorkerSrc('/vendor/pdfjs/build/pdf.worker.min.mjs')
    const container = document.createElement('div')
    const r = await renderDocument({ container, source: pdfBytes })
    expect(state.getDocumentArgs[0].cMapUrl).toBe('/vendor/pdfjs/cmaps/')
    r.destroy()
  })

  it('leaves the asset URLs unset (engine defaults) when nothing can be derived', async () => {
    const container = document.createElement('div')
    const r = await renderDocument({ container, source: pdfBytes })
    expect(state.getDocumentArgs[0].cMapUrl).toBeUndefined()
    r.destroy()
  })

  it('destroys the loading task (v6 API) on destroy()', async () => {
    const container = document.createElement('div')
    const r = await renderDocument({ container, source: pdfBytes })
    r.destroy()
    expect(state.loadingTask.destroy).toHaveBeenCalled()
  })

  it('maps a missing password to RenderError(PDF_PASSWORD_REQUIRED)', async () => {
    const container = document.createElement('div')
    const err = await renderDocument({ container, source: encryptedBytes, type: 'pdf' }).catch((e) => e)
    expect(err).toBeInstanceOf(RenderError)
    expect(err.code).toBe('PDF_PASSWORD_REQUIRED')
  })

  it('drives the password callback with "need" then "incorrect"', async () => {
    const container = document.createElement('div')
    const reasons: string[] = []
    const r = await renderDocument({
      container,
      source: encryptedBytes,
      type: 'pdf',
      pdf: {
        password: async (reason: string) => {
          reasons.push(reason)
          return reason === 'need' ? 'nope' : 'secret'
        },
      },
    })
    expect(reasons).toEqual(['need', 'incorrect'])
    r.destroy()
  })
})
