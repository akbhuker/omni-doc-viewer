export { renderDocument } from './render'
export { detect, detectFromExtension, detectFromBytes } from './detect'
export { normalizeSource } from './source'
export { setPdfWorkerSrc } from './renderers/pdf'

export {
  UnsupportedFormatError,
  FormatDetectionError,
  type DocType,
  type DocSource,
  type RenderOptions,
  type RenderTuning,
  type RenderResult,
  type RenderMeta,
} from './types'
