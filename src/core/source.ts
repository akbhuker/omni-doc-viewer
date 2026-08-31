import {
  type Base64Source,
  type DocSource,
  type FetchOptions,
  type ProgressCallback,
} from './types'

export interface NormalizedSource {
  bytes: Uint8Array
  /** Best-effort filename for extension-based detection, if known. */
  filename?: string
  /** MIME type hint (Content-Type / data: URL / Blob.type), if specific. */
  mime?: string
}

export interface NormalizeOptions {
  signal?: AbortSignal
  fetchOptions?: FetchOptions
  onProgress?: ProgressCallback
}

/** Filename from a URL path (query/hash stripped), or undefined. */
export function filenameFromUrl(url: string): string | undefined {
  try {
    // Works for absolute URLs; for relative ones, fall back to the raw string.
    const u = new URL(url, 'http://localhost')
    const last = u.pathname.split('/').filter(Boolean).pop()
    return last ? safeDecode(last) : undefined
  } catch {
    const last = url.split(/[?#]/)[0]?.split('/').filter(Boolean).pop()
    return last || undefined
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Parse `Content-Disposition` for a filename (RFC 6266 / RFC 5987 `filename*`). */
export function filenameFromContentDisposition(header: string | null): string | undefined {
  if (!header) return undefined
  const star = /filename\*\s*=\s*(?:[\w-]+)?'[^']*'([^;]+)/i.exec(header)
  if (star?.[1]) return safeDecode(star[1].trim())
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header)
  const value = plain?.[1] ?? plain?.[2]
  return value ? value.trim() : undefined
}

/** A specific MIME type from a Content-Type-like string, or undefined. */
function specificMime(type: string | null | undefined): string | undefined {
  if (!type) return undefined
  const essence = type.split(';')[0]!.trim().toLowerCase()
  if (!essence || essence === 'application/octet-stream' || essence === 'binary/octet-stream') {
    return undefined
  }
  return essence
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '')
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Percent-decode to bytes (handles UTF-8 and raw %XX sequences alike). */
function percentDecodeToBytes(s: string): Uint8Array {
  const out: number[] = []
  const enc = new TextEncoder()
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (c === '%' && /^[0-9a-f]{2}$/i.test(s.slice(i + 1, i + 3))) {
      out.push(parseInt(s.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      out.push(...enc.encode(c))
    }
  }
  return Uint8Array.from(out)
}

/** Decode a `data:` URL locally (never fetched, so no CSP `connect-src` needed). */
export function decodeDataUrl(url: string): NormalizedSource {
  const m = /^data:([^,]*?)(;base64)?,([\s\S]*)$/i.exec(url)
  if (!m) throw new TypeError('Malformed data: URL.')
  const [, mediaType = '', isBase64, payload = ''] = m
  const mime = specificMime(mediaType.split(';')[0] || 'text/plain')
  const bytes = isBase64 ? base64ToBytes(payload) : percentDecodeToBytes(payload)
  return { bytes, mime }
}

/** Read a Response body, streaming with progress when possible. */
async function readBody(
  res: Response,
  onProgress: ProgressCallback | undefined,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (!onProgress || !res.body || typeof res.body.getReader !== 'function') {
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    onProgress?.(bytes.byteLength, bytes.byteLength)
    return bytes
  }
  // Content-Length is the *encoded* size when a Content-Encoding is applied,
  // which is not comparable to the decoded bytes we count — report unknown.
  const encoded = res.headers.get('content-encoding')
  const lengthHeader = Number(res.headers.get('content-length'))
  const total = !encoded && Number.isFinite(lengthHeader) && lengthHeader > 0 ? lengthHeader : undefined

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => {})
      throw new DOMException('Aborted', 'AbortError')
    }
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loaded += value.byteLength
      onProgress(loaded, total)
    }
  }
  const out = new Uint8Array(loaded)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

async function fromResponse(
  res: Response,
  url: string | undefined,
  opts: NormalizeOptions,
): Promise<NormalizedSource> {
  if (!res.ok) {
    throw new Error(
      `Failed to fetch document: ${res.status} ${res.statusText}${url ? ` (${url})` : ''}`,
    )
  }
  const bytes = await readBody(res, opts.onProgress, opts.signal)
  const filename =
    filenameFromContentDisposition(res.headers.get('content-disposition')) ??
    (url ? filenameFromUrl(url) : res.url ? filenameFromUrl(res.url) : undefined)
  return { bytes, filename, mime: specificMime(res.headers.get('content-type')) }
}

function isBase64Source(x: unknown): x is Base64Source {
  return typeof x === 'object' && x !== null && typeof (x as Base64Source).base64 === 'string'
}

function isAbortSignal(x: unknown): x is AbortSignal {
  return typeof AbortSignal !== 'undefined' && x instanceof AbortSignal
}

/**
 * Turn any {@link DocSource} into raw bytes (+ filename / MIME hints when
 * available). URLs are fetched (with `fetchOptions` and progress);
 * `data:` URLs and base64 are decoded locally; `File`/`Blob`/`Response`
 * bodies are read.
 */
export async function normalizeSource(
  source: DocSource,
  options?: AbortSignal | NormalizeOptions,
): Promise<NormalizedSource> {
  const opts: NormalizeOptions = isAbortSignal(options) ? { signal: options } : (options ?? {})
  const { signal, onProgress } = opts

  if (typeof source === 'string') {
    if (/^data:/i.test(source)) {
      const decoded = decodeDataUrl(source)
      onProgress?.(decoded.bytes.byteLength, decoded.bytes.byteLength)
      return decoded
    }
    const init =
      typeof opts.fetchOptions === 'function'
        ? await opts.fetchOptions(source)
        : opts.fetchOptions
    // Our signal always wins so cancellation stays under the library's control.
    const res = await fetch(source, { ...init, signal })
    return fromResponse(res, source, opts)
  }

  if (typeof Response !== 'undefined' && source instanceof Response) {
    return fromResponse(source, undefined, opts)
  }

  // File extends Blob and carries a name.
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    const buf = await source.arrayBuffer()
    const bytes = new Uint8Array(buf)
    onProgress?.(bytes.byteLength, bytes.byteLength)
    const filename =
      typeof File !== 'undefined' && source instanceof File ? source.name || undefined : undefined
    return { bytes, filename, mime: specificMime(source.type) }
  }

  if (source instanceof Uint8Array) {
    onProgress?.(source.byteLength, source.byteLength)
    return { bytes: source }
  }

  if (source instanceof ArrayBuffer) {
    onProgress?.(source.byteLength, source.byteLength)
    return { bytes: new Uint8Array(source) }
  }

  if (isBase64Source(source)) {
    const bytes = base64ToBytes(source.base64)
    onProgress?.(bytes.byteLength, bytes.byteLength)
    return { bytes, filename: source.filename, mime: specificMime(source.mime) }
  }

  throw new TypeError(
    'Unsupported source. Expected a URL string, File, Blob, ArrayBuffer, Uint8Array, Response, or { base64 }.',
  )
}
