import { type DocType, UnsupportedFormatError, FormatDetectionError } from './types'

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
    default:
      return undefined
  }
}

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

  return undefined
}

/**
 * Resolve the format of a document from (in priority order):
 *   1. an explicit `override`,
 *   2. the filename/URL extension,
 *   3. the magic bytes.
 *
 * @throws {UnsupportedFormatError} for legacy `.doc`/`.ppt`.
 * @throws {FormatDetectionError} when the format cannot be determined.
 */
export function detect(params: {
  bytes: Uint8Array
  filename?: string
  override?: DocType
}): DocType {
  const { bytes, filename, override } = params
  if (override) return override

  if (filename) {
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

  const byBytes = detectFromBytes(bytes)
  if (byBytes) return byBytes

  throw new FormatDetectionError(
    'Could not determine the document format. Pass an explicit `type` to override detection.',
  )
}
