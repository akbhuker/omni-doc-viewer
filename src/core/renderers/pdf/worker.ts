/**
 * pdf.js worker resolution.
 *
 * The #1 support burden of every pdf.js wrapper is "the worker didn't load":
 * a 404 from a bundler that didn't emit it, an SPA fallback returning
 * `index.html` with status 200, a CSP that blocks the URL, or an API/worker
 * version mismatch. We resolve the worker through a chain — explicit →
 * bundler-resolved (verified) → CDN (opt-in) → let pdf.js try anyway — and
 * report what happened through `onWarning`.
 */
import type { RenderWarning } from '../../types'

export interface WorkerProbeResult {
  ok: boolean
  reason?: string
}

/** Checks that `url` serves JavaScript. Injected so it can be faked in tests. */
export type WorkerProbe = (url: string) => Promise<WorkerProbeResult>

export interface ResolveWorkerInput {
  /** `pdf.workerSrc` / `setPdfWorkerSrc()` — trusted, never probed. */
  explicit?: string
  /** URL resolved by the bundler via `new URL('pdfjs-dist/build/…', import.meta.url)`. */
  bundled?: string
  /** `pdfjs.version`, for a version-matched CDN URL. */
  version: string
  /** CDN fallback: `true` for jsDelivr, or a URL template with `{version}`. */
  cdn?: boolean | string
  /** Whether to use the `legacy/` build paths. */
  legacy?: boolean
  probe: WorkerProbe
}

export type WorkerStrategy = 'explicit' | 'bundled' | 'cdn' | 'fake'

export interface WorkerResolution {
  strategy: WorkerStrategy
  /** URL to assign to `GlobalWorkerOptions.workerSrc` (undefined only if nothing at all is known). */
  src?: string
  warning?: Pick<RenderWarning, 'code' | 'message' | 'details'>
}

const JSDELIVR = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@{version}/'

/** The package base URL on a CDN for this pdf.js version (always ends with `/`). */
export function cdnBaseFor(version: string, cdn: boolean | string): string {
  const template = typeof cdn === 'string' && cdn.trim() ? cdn.trim() : JSDELIVR
  const base = template.replace(/\{version\}/g, version)
  return base.endsWith('/') ? base : `${base}/`
}

export function workerPathFor(legacy?: boolean): string {
  return `${legacy ? 'legacy/' : ''}build/pdf.worker.min.mjs`
}

/**
 * If `src` points at a worker inside a pdfjs-dist package layout
 * (`…/build/pdf.worker[.min].mjs`), return the package base (`…/`); otherwise
 * undefined (hashed bundler assets don't sit next to `cmaps/`).
 */
export function workerBaseOf(src: string | undefined): string | undefined {
  if (!src) return undefined
  const m = /^(.*?)(?:legacy\/)?build\/pdf\.worker(?:\.min)?\.mjs(?:[?#].*)?$/.exec(src)
  return m ? m[1] || '/' : undefined
}

export interface PdfAssetUrls {
  cMapUrl: string
  standardFontDataUrl: string
  wasmUrl: string
  iccUrl: string
}

/** Folder URLs pdf.js needs for CJK fonts, standard fonts and wasm decoders. */
export function assetUrlsFrom(base: string): PdfAssetUrls {
  const b = base.endsWith('/') ? base : `${base}/`
  return {
    cMapUrl: `${b}cmaps/`,
    standardFontDataUrl: `${b}standard_fonts/`,
    wasmUrl: `${b}wasm/`,
    iccUrl: `${b}iccs/`,
  }
}

/** Default probe: a HEAD (then ranged GET) request that must return JavaScript. */
export const defaultProbe: WorkerProbe = async (url) => {
  const timeout = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(4000) : undefined
  const check = (res: Response): WorkerProbeResult => {
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }
    const type = (res.headers.get('content-type') ?? '').toLowerCase()
    if (type && !/javascript|ecmascript/.test(type)) return { ok: false, reason: `content-type ${type}` }
    return { ok: true }
  }
  try {
    let res = await fetch(url, { method: 'HEAD', cache: 'force-cache', signal: timeout })
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { headers: { Range: 'bytes=0-0' }, cache: 'force-cache', signal: timeout })
    }
    return check(res)
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

/** Resolve which worker URL to use. Pure apart from the injected probe. */
export async function resolvePdfWorker(input: ResolveWorkerInput): Promise<WorkerResolution> {
  const { explicit, bundled, version, cdn, legacy, probe } = input
  if (explicit) return { strategy: 'explicit', src: explicit }

  let bundledReason: string | undefined
  if (bundled) {
    const r = await probe(bundled)
    if (r.ok) return { strategy: 'bundled', src: bundled }
    bundledReason = r.reason
  }

  if (cdn) {
    const src = `${cdnBaseFor(version, cdn)}${workerPathFor(legacy)}`
    return {
      strategy: 'cdn',
      src,
      warning: {
        code: 'pdf/worker-fallback-cdn',
        message: bundled
          ? `The bundled pdf.js worker could not be loaded (${bundledReason}); using the CDN copy ${src}.`
          : `No bundled pdf.js worker URL could be resolved; using the CDN copy ${src}.`,
        details: { bundled, reason: bundledReason },
      },
    }
  }

  return {
    strategy: 'fake',
    src: bundled,
    warning: {
      code: 'pdf/fake-worker',
      message: bundled
        ? `The pdf.js worker at ${bundled} could not be loaded (${bundledReason}). pdf.js will try to run on the main thread, which is slow and may fail. Set pdf.workerSrc, or enable pdf.workerFallbackCdn.`
        : 'No pdf.js worker URL could be resolved. Set pdf.workerSrc (see README → The pdf.js worker), or enable pdf.workerFallbackCdn.',
      details: { bundled, reason: bundledReason },
    },
  }
}

// ---------------------------------------------------------------------------
// Global configuration + memoized resolution
// ---------------------------------------------------------------------------

let explicitWorkerSrc: string | undefined
let memo: { key: string; result: Promise<WorkerResolution> } | undefined

/**
 * Override the pdf.js worker URL globally. Call once before rendering any PDF.
 * Most bundlers don't need this — we resolve the bundled worker automatically —
 * but it's the escape hatch when yours can't.
 */
export function setPdfWorkerSrc(src: string): void {
  explicitWorkerSrc = src
  memo = undefined
}

export function getPdfWorkerSrc(): string | undefined {
  return explicitWorkerSrc
}

/** Bundler-resolved URL of the worker shipped in `pdfjs-dist`, if resolvable. */
export function bundledWorkerUrl(legacy?: boolean): string | undefined {
  try {
    // Modern bundlers understand `new URL(specifier, import.meta.url)` and
    // emit the worker as an asset; no CDN, works offline.
    return legacy
      ? new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
      : new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  } catch {
    return undefined
  }
}

export interface ConfigureWorkerOptions {
  explicit?: string
  cdn?: boolean | string
  legacy?: boolean
  probe?: WorkerProbe
}

/**
 * Resolve (once per configuration) and apply the worker URL to
 * `pdfjs.GlobalWorkerOptions`. Returns the resolution so the caller can derive
 * asset URLs and report warnings.
 */
export async function configureWorker(pdfjs: any, opts: ConfigureWorkerOptions = {}): Promise<WorkerResolution> {
  const explicit = opts.explicit ?? explicitWorkerSrc
  const key = JSON.stringify([explicit, opts.cdn, opts.legacy])
  if (!memo || memo.key !== key) {
    const result = resolvePdfWorker({
      explicit,
      bundled: explicit ? undefined : bundledWorkerUrl(opts.legacy),
      version: String(pdfjs.version ?? ''),
      cdn: opts.cdn,
      legacy: opts.legacy,
      probe: opts.probe ?? defaultProbe,
    })
    memo = { key, result }
  }
  const resolution = await memo.result
  if (resolution.src && pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = resolution.src
  }
  return resolution
}

/** Test hook: forget the memoized resolution. */
export function resetWorkerResolution(): void {
  memo = undefined
}
