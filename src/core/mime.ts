import { type DocType } from './types'

/** Default file extension per format (used when a source has no filename). */
export const DEFAULT_EXT: Record<DocType, string> = {
  pdf: 'pdf',
  docx: 'docx',
  xlsx: 'xlsx',
  pptx: 'pptx',
  image: 'png',
  text: 'txt',
  markdown: 'md',
  csv: 'csv',
  video: 'mp4',
  audio: 'mp3',
  html: 'html',
  json: 'json',
  code: 'txt',
}

/** Best-effort MIME type per format (used when building Blob URLs). */
export const DEFAULT_MIME: Record<DocType, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  image: 'application/octet-stream',
  text: 'text/plain',
  markdown: 'text/markdown',
  csv: 'text/csv',
  video: 'video/mp4',
  audio: 'audio/mpeg',
  html: 'text/html',
  json: 'application/json',
  code: 'text/plain',
}

/** `document.<ext>` fallback name for a format. */
export function defaultFilename(type?: string): string {
  return `document.${(type && (DEFAULT_EXT as Record<string, string | undefined>)[type]) || 'bin'}`
}

const MIME_TO_TYPE: Record<string, DocType> = {
  'application/pdf': 'pdf',
  'application/x-pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
  'text/csv': 'csv',
  'text/tab-separated-values': 'csv',
  'text/plain': 'text',
  'text/html': 'html',
  'application/xhtml+xml': 'html',
  'application/json': 'json',
  'application/ld+json': 'json',
  'application/geo+json': 'json',
  'application/xml': 'code',
  'text/xml': 'code',
  'text/javascript': 'code',
  'application/javascript': 'code',
  'text/css': 'code',
  'application/x-yaml': 'code',
  'text/yaml': 'code',
  'application/sql': 'code',
}

/**
 * Map a MIME type (optionally with parameters, e.g. `text/plain; charset=utf-8`)
 * to a DocType. Generic types (`application/octet-stream`) and unknown types
 * return undefined so detection can fall back to magic bytes.
 */
export function docTypeFromMime(mime: string | undefined): DocType | undefined {
  if (!mime) return undefined
  const essence = mime.split(';')[0]!.trim().toLowerCase()
  if (!essence) return undefined
  if (essence.startsWith('image/')) return 'image'
  if (essence.startsWith('video/')) return 'video'
  if (essence.startsWith('audio/')) return 'audio'
  return MIME_TO_TYPE[essence]
}
