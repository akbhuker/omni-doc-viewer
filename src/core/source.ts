import { type DocSource } from './types'

export interface NormalizedSource {
  bytes: Uint8Array
  /** Best-effort filename for extension-based detection, if known. */
  filename?: string
}

function filenameFromUrl(url: string): string | undefined {
  try {
    // Works for absolute URLs; for relative ones, fall back to the raw string.
    const u = new URL(url, 'http://localhost')
    const last = u.pathname.split('/').filter(Boolean).pop()
    return last || undefined
  } catch {
    const last = url.split(/[?#]/)[0]?.split('/').filter(Boolean).pop()
    return last || undefined
  }
}

/**
 * Turn any {@link DocSource} into raw bytes (+ a filename hint when available).
 * URLs are fetched; `File`/`Blob` are read via `arrayBuffer()`.
 */
export async function normalizeSource(
  source: DocSource,
  signal?: AbortSignal,
): Promise<NormalizedSource> {
  if (typeof source === 'string') {
    const res = await fetch(source, { signal })
    if (!res.ok) {
      throw new Error(`Failed to fetch document: ${res.status} ${res.statusText} (${source})`)
    }
    const buf = await res.arrayBuffer()
    return { bytes: new Uint8Array(buf), filename: filenameFromUrl(source) }
  }

  // File extends Blob and carries a name.
  if (typeof File !== 'undefined' && source instanceof File) {
    const buf = await source.arrayBuffer()
    return { bytes: new Uint8Array(buf), filename: source.name || undefined }
  }

  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    const buf = await source.arrayBuffer()
    return { bytes: new Uint8Array(buf) }
  }

  if (source instanceof Uint8Array) {
    return { bytes: source }
  }

  if (source instanceof ArrayBuffer) {
    return { bytes: new Uint8Array(source) }
  }

  throw new TypeError(
    'Unsupported source. Expected a URL string, File, Blob, ArrayBuffer, or Uint8Array.',
  )
}
