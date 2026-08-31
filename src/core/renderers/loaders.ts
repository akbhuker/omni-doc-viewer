import type { DocType, RendererLoader } from '../types'

/**
 * Lazy per-format loaders. Each renderer (and its heavy engine) is only
 * imported the first time that format is actually rendered, so a consumer who
 * only ever shows PDFs never ships the SheetJS or PPTX code.
 */
export const BUILTIN_LOADERS: Record<DocType, RendererLoader> = {
  pdf: () => import('./pdf'),
  docx: () => import('./docx'),
  xlsx: () => import('./xlsx'),
  pptx: () => import('./pptx'),
  image: () => import('./image'),
  text: () => import('./text'),
  markdown: () => import('./markdown'),
  csv: () => import('./csv'),
  video: () => import('./media'),
  audio: () => import('./media'),
  html: () => import('./html'),
  json: () => import('./code'),
  code: () => import('./code'),
}
