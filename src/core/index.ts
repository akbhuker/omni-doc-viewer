export { renderDocument } from './render'
export { createViewer } from './viewer/controller'
export type {
  ViewerController,
  ViewerOptions,
  ViewerState,
  ViewerCapabilities,
  ViewerSearchState,
  ViewMode,
  Rotation,
  LoadOverrides,
  LoadProgress,
} from './viewer/types'
export { downloadDocument, resolveDocumentUrl } from './viewer/download'
export { printDocument } from './viewer/print'
export { createVirtualTable, type VirtualTable, type TableSource, type VirtualTableOptions } from './table/VirtualTable'
export { createTableSearchProvider } from './table/search'
export { parseDelimited, parseRows, sniffDelimiter } from './renderers/csv/parser'
export { createThumbnailStrip, type ThumbnailStrip, type ThumbnailStripOptions } from './viewer/thumbnails'
export { createDomSearchProvider, type DomSearchOptions } from './search/dom'
export { createHighlighter, type Highlighter } from './search/highlight'
export { buildIndex, findMatches, type TextIndex, type IndexMatch } from './search/text-index'
export { detect, detectFromExtension, detectFromBytes } from './detect'
export { registerRenderer, unregisterRenderer, getRegisteredRenderers } from './registry'
export { normalizeSource, decodeDataUrl, type NormalizeOptions, type NormalizedSource } from './source'
export { docTypeFromMime } from './mime'
export { ensureStyles, setStyleNonce, getInjectedCss } from './styles'
export { applyTheme, THEME_CSS, type Theme } from './theme'
export { setPdfWorkerSrc } from './renderers/pdf/worker'
export { inspectPptx, type PptxInspection, type PptxProblem } from './renderers/pptx/inspect'

export {
  UnsupportedFormatError,
  FormatDetectionError,
  RenderError,
  type RenderWarning,
  type SearchProvider,
  type SearchOptions,
  type SearchMatch,
  type SearchResult,
  type ThumbnailProvider,
  type DocType,
  type AnyDocType,
  type DocSource,
  type Renderer,
  type RendererInput,
  type RendererLoader,
  type RendererRegistration,
  type HtmlTuning,
  type Base64Source,
  type FetchOptions,
  type ProgressCallback,
  type DocxTuning,
  type CsvTuning,
  type XlsxTuning,
  type PdfTuning,
  type PdfPasswordProvider,
  type PdfPasswordReason,
  type RenderOptions,
  type RenderTuning,
  type RenderResult,
  type RenderMeta,
} from './types'
