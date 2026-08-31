import { type AnyDocType, type DocType, UnsupportedFormatError, FormatDetectionError } from './types'
import { docTypeFromMime } from './mime'
import { detectionRegistry, type DetectionRegistry } from './registry'

/** Map a file extension to a DocType. Returns undefined for unknown/legacy. */
export function detectFromExtension(nameOrUrl: string): DocType | undefined {
  // Strip query/hash, then take the extension.
  const clean = nameOrUrl.split(/[?#]/)[0] ?? ''
  const ext = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase()
  switch (ext) {
    case 'pdf':
      return 'pdf'
    case 'docx':
      return 'docx'
    case 'xlsx':
    case 'xls': // legacy binary spreadsheet — SheetJS still parses it
      return 'xlsx'
    case 'pptx':
      return 'pptx'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'bmp':
    case 'svg':
    case 'avif':
    case 'ico':
      return 'image'
    case 'md':
    case 'markdown':
    case 'mdown':
    case 'mkd':
      return 'markdown'
    case 'csv':
    case 'tsv':
      return 'csv'
    case 'txt':
    case 'text':
    case 'log':
      return 'text'
    case 'mp4':
    case 'm4v':
    case 'webm':
    case 'mov':
    case 'ogv':
      return 'video'
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'oga':
    case 'm4a':
    case 'aac':
    case 'flac':
    case 'opus':
      return 'audio'
    case 'html':
    case 'htm':
    case 'xhtml':
      return 'html'
    case 'json':
    case 'jsonl':
    case 'geojson':
      return 'json'
    default:
      return CODE_EXTENSIONS.has(ext) ? 'code' : undefined
  }
}

/** Source-code extensions rendered with line numbers. */
export const CODE_EXTENSIONS = new Set([
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'mts', 'cts', 'py', 'rb', 'php', 'java', 'kt', 'kts', 'scala',
  'go', 'rs', 'c', 'h', 'cpp', 'cc', 'hpp', 'cs', 'swift', 'm', 'dart', 'lua', 'r', 'pl', 'pm',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'sql', 'graphql', 'gql', 'proto',
  'css', 'scss', 'sass', 'less', 'xml', 'xsl', 'xsd', 'svg-src', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
  'dockerfile', 'makefile', 'gradle', 'properties', 'tex', 'vue', 'svelte', 'astro', 'diff', 'patch',
])

const ZIP_INTERNAL_MARKERS: Array<{ marker: string; type: DocType }> = [
  { marker: 'word/', type: 'docx' },
  { marker: 'ppt/', type: 'pptx' },
  { marker: 'xl/', type: 'xlsx' },
]

// OLE (Compound File Binary) stream names that identify the legacy format.
const OLE_STREAM_MARKERS: Array<{ marker: string; type: DocType | 'doc' | 'ppt' }> = [
  { marker: 'Workbook', type: 'xlsx' }, // .xls — SheetJS handles it
  { marker: 'Book', type: 'xlsx' }, // very old .xls
  { marker: 'WordDocument', type: 'doc' },
  { marker: 'PowerPoint Document', type: 'ppt' },
]

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false
  return sig.every((b, i) => bytes[i] === b)
}

/**
 * Find an ASCII marker within the first `limit` bytes of a buffer.
 * Used to peek at uncompressed local-file-header names inside a zip, and at
 * OLE stream names — both of which appear as plain ASCII (or UTF-16) in the
 * raw bytes, so we can disambiguate without unzipping/parsing the container.
 */
function containsAscii(bytes: Uint8Array, marker: string, limit = 8192): boolean {
  const end = Math.min(bytes.length, limit)
  const code0 = marker.charCodeAt(0)
  for (let i = 0; i <= end - marker.length; i++) {
    if (bytes[i] !== code0) continue
    let hit = true
    for (let j = 1; j < marker.length; j++) {
      if (bytes[i + j] !== marker.charCodeAt(j)) {
        hit = false
        break
      }
    }
    if (hit) return true
  }
  return false
}

// OLE stream names are stored as UTF-16LE in the directory; check that too.
function containsUtf16(bytes: Uint8Array, marker: string, limit = 8192): boolean {
  const end = Math.min(bytes.length, limit)
  const code0 = marker.charCodeAt(0)
  for (let i = 0; i <= end - marker.length * 2; i++) {
    if (bytes[i] !== code0 || bytes[i + 1] !== 0) continue
    let hit = true
    for (let j = 1; j < marker.length; j++) {
      if (bytes[i + j * 2] !== marker.charCodeAt(j) || bytes[i + j * 2 + 1] !== 0) {
        hit = false
        break
      }
    }
    if (hit) return true
  }
  return false
}

/**
 * Detect a document's format purely from its bytes (magic numbers + container
 * inspection). Throws {@link UnsupportedFormatError} for legacy `.doc`/`.ppt`,
 * and returns `undefined` only when nothing matches.
 */
export function detectFromBytes(bytes: Uint8Array): DocType | undefined {
  // PDF: "%PDF"
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'pdf'

  // Raster/vector images by signature.
  if (
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) || // PNG
    startsWith(bytes, [0xff, 0xd8, 0xff]) || // JPEG
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) || // GIF
    startsWith(bytes, [0x42, 0x4d]) || // BMP
    startsWith(bytes, [0x00, 0x00, 0x01, 0x00]) || // ICO
    // RIFF....WEBP and ftyp...avif both have a 4-byte tag at offset 8.
    (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && containsAscii(bytes, 'WEBP', 16)) ||
    containsAscii(bytes, 'ftypavif', 32)
  ) {
    return 'image'
  }
  // Media containers.
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'video' // EBML (webm/mkv)
  if (containsAscii(bytes, 'ftyp', 12)) {
    if (containsAscii(bytes, 'ftypM4A', 12)) return 'audio'
    return 'video' // isom / mp42 / M4V / qt …
  }
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && containsAscii(bytes, 'WAVE', 16)) return 'audio'
  if (containsAscii(bytes, 'OggS', 4)) return 'audio'
  if (startsWith(bytes, [0x49, 0x44, 0x33])) return 'audio' // ID3 (mp3)
  if (bytes.length > 1 && bytes[0] === 0xff && (bytes[1]! & 0xe6) === 0xe2) return 'audio' // MPEG frame sync
  if (startsWith(bytes, [0x66, 0x4c, 0x61, 0x43])) return 'audio' // fLaC

  // SVG is XML text — sniff the opening tag.
  if (containsAscii(bytes, '<svg', 1024) || containsAscii(bytes, '<?xml', 64)) {
    if (containsAscii(bytes, '<svg', 4096)) return 'image'
    if (containsAscii(bytes, '<?xml', 64)) return 'code' // generic XML
  }

  // ZIP-based OOXML: "PK\x03\x04" (also empty/spanned archives PK\x05\x06 / PK\x07\x08)
  const isZip =
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
  if (isZip) {
    for (const { marker, type } of ZIP_INTERNAL_MARKERS) {
      if (containsAscii(bytes, marker)) return type
    }
    throw new FormatDetectionError(
      'File is a ZIP/OOXML container but is not a recognizable .docx, .xlsx, or .pptx.',
    )
  }

  // OLE Compound File: legacy Office binary formats
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    for (const { marker, type } of OLE_STREAM_MARKERS) {
      if (containsUtf16(bytes, marker) || containsAscii(bytes, marker)) {
        if (type === 'doc' || type === 'ppt') {
          throw new UnsupportedFormatError(
            `Legacy binary .${type} files (pre-2007 OLE format) cannot be rendered client-side. ` +
              `Convert to .${type === 'doc' ? 'docx' : 'pptx'} or PDF first (requires a server-side converter).`,
            type,
          )
        }
        return type // 'xlsx' — SheetJS reads legacy .xls
      }
    }
    // OLE but we couldn't identify the stream — assume legacy spreadsheet is
    // the only one SheetJS can handle; otherwise it's unsupported.
    throw new UnsupportedFormatError(
      'File is a legacy OLE/Compound Document. Only legacy .xls is supported; ' +
        '.doc and .ppt require a server-side converter.',
    )
  }

  // Last resort: if it has no binary signature and looks like UTF-8 text
  // (no NUL bytes in the first chunk), treat it as html / json / plain text.
  if (looksLikeText(bytes)) {
    const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 2048)).trimStart()
    if (/^(<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(head)) return 'html'
    const first = head[0]
    if ((first === '{' || first === '[') && looksLikeJson(bytes)) return 'json'
    return 'text'
  }

  return undefined
}

/** True when the (bounded) text parses as JSON. */
function looksLikeJson(bytes: Uint8Array, limit = 5 * 1024 * 1024): boolean {
  if (bytes.length > limit) return false
  try {
    JSON.parse(new TextDecoder('utf-8', { fatal: false }).decode(bytes))
    return true
  } catch {
    return false
  }
}

/** Heuristic: the first chunk is non-empty and contains no NUL/control noise. */
function looksLikeText(bytes: Uint8Array, sample = 1024): boolean {
  const n = Math.min(bytes.length, sample)
  if (n === 0) return false
  let suspicious = 0
  for (let i = 0; i < n; i++) {
    const b = bytes[i]!
    if (b === 0) return false // NUL → binary
    // Allow tab/newline/carriage-return; flag other C0 control chars.
    if (b < 9 || (b > 13 && b < 32)) suspicious++
  }
  return suspicious / n < 0.05
}

/**
 * Resolve the format of a document from (in priority order):
 *   1. an explicit `override`,
 *   2. the filename/URL extension,
 *   3. a MIME type hint (Content-Type / data: URL), if specific,
 *   4. the magic bytes.
 *
 * @throws {UnsupportedFormatError} for legacy `.doc`/`.ppt`.
 * @throws {FormatDetectionError} when the format cannot be determined.
 */
export function detect(params: {
  bytes: Uint8Array
  filename?: string
  mime?: string
  override?: AnyDocType
  /** Rules from registered renderers (defaults to the global registry). */
  registry?: DetectionRegistry
}): AnyDocType {
  const { bytes, filename, mime, override } = params
  if (override) return override
  const registry = params.registry ?? detectionRegistry()

  if (filename) {
    const clean = filename.split(/[?#]/)[0] ?? ''
    const ext = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase()
    const registered = ext ? registry.extensions.get(ext) : undefined
    if (registered) return registered
    const byExt = detectFromExtension(filename)
    if (byExt) {
      // Trust the extension, but if it's a zip we can still confirm; if the
      // extension says .doc/.ppt, surface the unsupported error early.
      const lower = filename.split(/[?#]/)[0]?.toLowerCase() ?? ''
      if (lower.endsWith('.doc') || lower.endsWith('.ppt')) {
        throw new UnsupportedFormatError(
          `Legacy binary ${lower.endsWith('.doc') ? '.doc' : '.ppt'} files cannot be rendered client-side. ` +
            'Convert to the modern OOXML format or PDF first.',
        )
      }
      return byExt
    }
    // Extension was .doc/.ppt or unknown — fall through to bytes, which will
    // throw the precise unsupported error if applicable.
  }

  const essence = mime?.split(';')[0]?.trim().toLowerCase()
  const registeredMime = essence ? registry.mimeTypes.get(essence) : undefined
  if (registeredMime) return registeredMime
  const byMime = docTypeFromMime(mime)
  if (byMime) return byMime

  for (const { type, sniff } of registry.sniffers) {
    try {
      if (sniff(bytes)) return type
    } catch {
      /* a broken sniffer must not break detection */
    }
  }

  const byBytes = detectFromBytes(bytes)
  if (byBytes) return byBytes

  throw new FormatDetectionError(
    'Could not determine the document format. Pass an explicit `type` to override detection.',
  )
}
