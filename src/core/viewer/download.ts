import { DEFAULT_MIME, defaultFilename } from '../mime'
import { filenameFromUrl } from '../source'
import { type AnyDocType, type DocSource } from '../types'

export { filenameFromUrl }

export interface DocumentBlobInput {
  /** The rendered bytes (preferred — always yields a same-origin Blob URL). */
  bytes?: Uint8Array
  /** The original source, used only when `bytes` are unavailable. */
  source?: DocSource
  /** Filename hint; falls back to `document.<ext>`. */
  filename?: string
  type?: AnyDocType
}

export interface ResolvedDocumentUrl {
  url: string
  filename: string
  /** Call when done (revokes Blob URLs; no-op for plain URLs). */
  release(): void
}

function toBlob(input: DocumentBlobInput): Blob | undefined {
  const mime = (input.type && (DEFAULT_MIME as Record<string, string | undefined>)[input.type]) || 'application/octet-stream'
  if (input.bytes) return new Blob([input.bytes.slice()], { type: mime })
  const { source } = input
  if (source instanceof Blob) return source
  if (source instanceof Uint8Array) return new Blob([source.slice()], { type: mime })
  if (source instanceof ArrayBuffer) return new Blob([source], { type: mime })
  return undefined
}

/**
 * Resolve a document to a URL suitable for `<a download>` / a print iframe.
 * Prefers a same-origin Blob URL built from the rendered bytes, so cross-origin
 * sources download with the right filename and can be printed.
 */
export function resolveDocumentUrl(input: DocumentBlobInput): ResolvedDocumentUrl {
  let filename = input.filename
  if (!filename && typeof input.source === 'string') filename = filenameFromUrl(input.source)
  if (!filename && typeof File !== 'undefined' && input.source instanceof File) {
    filename = input.source.name || undefined
  }
  filename ||= defaultFilename(input.type)

  const blob = toBlob(input)
  if (blob) {
    const url = URL.createObjectURL(blob)
    return { url, filename, release: () => URL.revokeObjectURL(url) }
  }
  // No bytes and a URL source: last resort, use it directly.
  return {
    url: typeof input.source === 'string' ? input.source : '',
    filename,
    release: () => {},
  }
}

/** Trigger a browser download of the document. */
export function downloadDocument(input: DocumentBlobInput): void {
  const { url, filename, release } = resolveDocumentUrl(input)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser time to start the download before revoking.
  setTimeout(release, 10_000)
}
