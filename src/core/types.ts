/**
 * The document formats this package can render fully client-side.
 */
export type DocType =
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'image'
  | 'text'
  | 'markdown'
  | 'csv'
  | 'video'
  | 'audio'
  | 'html'
  | 'json'
  | 'code'

/**
 * A built-in {@link DocType} or any type registered with `registerRenderer()`.
 * (`string & {}` keeps autocompletion for the built-ins.)
 */
export type AnyDocType = DocType | (string & {})

/** Loads a renderer module on demand (keeps engines out of the core bundle). */
export type RendererLoader = () => Promise<{ render: Renderer }>

/** A custom renderer plus how to detect its documents. */
export interface RendererRegistration {
  load: RendererLoader
  /** File extensions (without the dot) that map to this type; override built-ins. */
  extensions?: string[]
  /** MIME types that map to this type. */
  mimeTypes?: string[]
  /** Magic-byte sniffer; runs before the built-in byte detection. */
  sniff?: (bytes: Uint8Array) => boolean
}

/**
 * Anything you can hand to {@link renderDocument} as the document to display.
 *
 * - `string`  — a URL (http(s) or blob:) that will be fetched, or a `data:` URL
 *   (decoded locally, never fetched)
 * - `File` / `Blob` — e.g. from an `<input type="file">` or drag-drop
 * - `ArrayBuffer` / `Uint8Array` — raw bytes you already have in memory
 * - `Response` — an already-fetched response (its body is read, with progress)
 * - `{ base64 }` — base64-encoded bytes, e.g. from a JSON API
 */
export type DocSource = string | File | Blob | ArrayBuffer | Uint8Array | Response | Base64Source

/** Base64-encoded document bytes with optional hints for detection. */
export interface Base64Source {
  base64: string
  filename?: string
  mime?: string
}

/**
 * Extra `fetch()` options for URL sources — headers, credentials, mode, …
 * Either a `RequestInit` or a function that builds one per URL (e.g. to sign
 * the request). The `signal` is always managed by the library.
 */
export type FetchOptions = RequestInit | ((url: string) => RequestInit | Promise<RequestInit>)

/** Download progress callback. `total` is undefined when the size is unknown. */
export type ProgressCallback = (loaded: number, total?: number) => void

/**
 * Metadata reported once a document has loaded.
 */
export interface RenderMeta {
  type: AnyDocType
  /**
   * Number of "pages" in the document, when meaningful:
   * PDF pages, PPTX slides, or XLSX sheets. Omitted for DOCX (continuous flow).
   */
  pageCount?: number
  /** Set when a row cap cut the data (CSV/XLSX): how many rows are shown vs. present. */
  truncated?: { rows: number; total: number }
}

/**
 * Per-format tuning. All optional.
 */
export interface RenderTuning {
  pdf?: PdfTuning
  pptx?: {
    /** Slide width in px. Defaults to the container width (or 960). */
    width?: number
    /** Slide height in px. Defaults to width * 9/16. */
    height?: number
    /** Render slides flagged hidden in PowerPoint. Default `false`. */
    showHiddenSlides?: boolean
  }
  docx?: DocxTuning
  csv?: CsvTuning
  xlsx?: XlsxTuning
  html?: HtmlTuning
}

/** HTML document options. */
export interface HtmlTuning {
  /**
   * Run the markup through DOMPurify before display (scripts, event handlers
   * and embeds are removed). The document is always shown in a fully
   * sandboxed iframe as well. Default `true`.
   */
  sanitize?: boolean
  /** Iframe height (CSS length). Default `'80vh'`. */
  height?: string
}

/** Spreadsheet options. */
export interface XlsxTuning {
  /** Show sheets flagged hidden / very hidden in the workbook. Default `false`. */
  showHiddenSheets?: boolean
  /** Rows parsed per sheet (the rest are counted and reported). Default 200 000. */
  maxRows?: number
}

/** CSV / TSV options. */
export interface CsvTuning {
  /** Field delimiter. Auto-detected (`,` `\t` `;` `|`) when omitted. */
  delimiter?: string
  /** Keep at most this many data rows (the rest are counted and reported). Default 200 000. */
  maxRows?: number
}

/** Why a PDF password is being requested. */
export type PdfPasswordReason = 'need' | 'incorrect'

/**
 * Supplies the password for an encrypted PDF. Return `null`/`undefined` to
 * give up (the render rejects with `RenderError` code `PDF_PASSWORD_REQUIRED`).
 */
export type PdfPasswordProvider = (
  reason: PdfPasswordReason,
) => string | null | undefined | Promise<string | null | undefined>

/** PDF rendering options (pdf.js). All optional. */
export interface PdfTuning {
  /** Canvas render scale. Default 1.5 (crisp on most displays). */
  scale?: number
  /**
   * Explicit URL for the pdf.js web worker. If omitted the worker bundled
   * with `pdfjs-dist` is resolved via `import.meta.url` (Vite, webpack 5,
   * Next.js) and verified with a quick request; see `workerFallbackCdn`.
   */
  workerSrc?: string
  /**
   * When the bundled worker can't be loaded (404, HTML fallback page, CSP),
   * load the same pdf.js version from a CDN instead. `true` uses jsDelivr;
   * a string is a URL template with `{version}`, e.g.
   * `'https://unpkg.com/pdfjs-dist@{version}/'`. Default `false` (offline-first).
   */
  workerFallbackCdn?: boolean | string
  /**
   * Base URL of a self-hosted copy of the `pdfjs-dist` package (the folder
   * containing `cmaps/`, `standard_fonts/`, `wasm/`). Needed for CJK fonts and
   * JPEG-2000 images when your bundler doesn't expose those folders.
   * Derived automatically from `workerSrc` when it ends in `build/pdf.worker*.mjs`.
   */
  assetsUrl?: string
  /** Override the CMap folder URL (defaults from `assetsUrl`). */
  cMapUrl?: string
  /** Override the standard-fonts folder URL (defaults from `assetsUrl`). */
  standardFontDataUrl?: string
  /** Override the wasm folder URL (JPX/ICC decoders; defaults from `assetsUrl`). */
  wasmUrl?: string
  /** Override the ICC profiles folder URL (defaults from `assetsUrl`). */
  iccUrl?: string
  /**
   * Overlay a selectable, searchable text layer on each page (enables
   * copy/paste, browser Ctrl+F, and screen-reader access). Default `true`.
   * Set `false` for a pure-canvas render (slightly faster, image-only).
   */
  textLayer?: boolean
  /**
   * Password for encrypted PDFs: a string, or a function called with
   * `'need'` (first attempt) / `'incorrect'` (wrong password) that returns
   * the password (or `null` to cancel).
   */
  password?: string | PdfPasswordProvider
  /**
   * Load the `pdfjs-dist/legacy` build (older browsers). Default `false`.
   */
  legacy?: boolean
  /** Render link annotations (clickable URLs and internal jumps). Default `true`. */
  annotations?: boolean
  /** Where external links open. Default `'_blank'`. */
  externalLinkTarget?: '_blank' | '_self'
  /**
   * Upper bound on simultaneously rasterized pages (memory cap on top of
   * viewport-based virtualization). Default `12`.
   */
  maxRenderedPages?: number
}

/**
 * Word rendering options, forwarded to docx-preview. All optional; the
 * defaults match what the library rendered before these were exposed.
 */
export interface DocxTuning {
  /** Break the document into pages (one `<section>` per page). Default `true`. */
  breakPages?: boolean
  /**
   * Also break on `<w:lastRenderedPageBreak/>` marks left by Word — closer to
   * Word's own pagination for documents saved by MS Word. Default `true`
   * (ignored) for compatibility; set `false` to honour them.
   */
  ignoreLastRenderedPageBreak?: boolean
  /** Render page headers. Default `true`. */
  renderHeaders?: boolean
  /** Render page footers. Default `true`. */
  renderFooters?: boolean
  /** Render footnotes. Default `true`. */
  renderFootnotes?: boolean
  /** Render endnotes. Default `true`. */
  renderEndnotes?: boolean
  /** Render review comments (experimental in docx-preview). Default `false`. */
  renderComments?: boolean
  /** Render tracked changes (insertions/deletions). Default `false`. */
  renderChanges?: boolean
  /** Ignore the page width from the document (fluid layout). Default `false`. */
  ignoreWidth?: boolean
  /** Ignore the page height from the document. Default `false`. */
  ignoreHeight?: boolean
  /** Skip embedded fonts. Default `false`. */
  ignoreFonts?: boolean
}

/**
 * A recoverable problem a renderer worked around (e.g. a repaired PPTX part,
 * a pdf.js worker that fell back to the main thread). Reported through
 * {@link RenderOptions.onWarning}; never thrown.
 */
export interface RenderWarning {
  /** Stable machine-readable code, e.g. `pptx/removed-phantom-overrides`. */
  code: string
  /** The format being rendered when the warning was raised. */
  format?: AnyDocType
  /** Human-readable explanation. */
  message: string
  /** Optional structured context for logging / bug reports. */
  details?: unknown
}

export interface RenderOptions extends RenderTuning {
  /** Element to render the document into. Its contents are replaced. */
  container: HTMLElement
  /** The document to display. */
  source: DocSource
  /**
   * Skip auto-detection and force a format. Useful when the source has no
   * filename/extension and you already know the type.
   */
  type?: AnyDocType
  /**
   * Per-call renderers: add custom types or override built-ins. Take
   * precedence over `registerRenderer()` and the built-ins.
   */
  renderers?: Record<string, RendererLoader | RendererRegistration>
  /**
   * Type (or loader) to use when the format can't be determined, instead of
   * throwing `FormatDetectionError`. Not used for legacy `.doc`/`.ppt`.
   */
  fallback?: AnyDocType | RendererLoader
  /** Abort an in-flight render (e.g. when the source changes). */
  signal?: AbortSignal
  /**
   * Headers / credentials for URL sources (auth-gated files, S3 signed URLs,
   * cookies). Ignored for non-URL sources.
   */
  fetchOptions?: FetchOptions
  /** Download progress for URL/Response sources (and a single 100% for local ones). */
  onProgress?: ProgressCallback
  /**
   * Called when the document asks to navigate to a page (an internal PDF
   * link or named action). When omitted, the page is scrolled into view.
   */
  onNavigate?: (page: number) => void
  /**
   * Colour theme. Sets `data-odv-theme` on the container and injects the
   * `--odv-*` tokens; `'auto'` follows `prefers-color-scheme`. When omitted,
   * nothing is tagged and the light defaults apply.
   */
  theme?: 'light' | 'dark' | 'auto'
  /** CSP nonce applied to every `<style>` element the library injects. */
  styleNonce?: string
  /** Called if rendering fails. The returned promise also rejects. */
  onError?: (error: Error) => void
  /**
   * Called for recoverable problems the renderer worked around. Useful for
   * diagnostics and bug reports; rendering continues.
   */
  onWarning?: (warning: RenderWarning) => void
}

/**
 * Handle returned by {@link renderDocument}. Call {@link RenderResult.destroy}
 * to tear down listeners, free engine resources, and clear the container.
 */
export interface RenderResult {
  type: AnyDocType
  meta: RenderMeta
  /**
   * The individual page elements in render order (PDF pages, PPTX slides,
   * DOCX paginated sections). Used by the viewer to drive page-by-page
   * navigation and the "current / total" indicator. Omitted for formats with
   * no meaningful page model (e.g. XLSX, which navigates by sheet tabs).
   */
  pages?: HTMLElement[]
  /**
   * The exact bytes that were rendered (fetched / read from the source). Lets
   * callers download or print the original without re-fetching — and without
   * cross-origin restrictions, since a same-origin Blob URL can be built.
   */
  bytes?: Uint8Array
  /** Best-effort filename (from the URL path or `File.name`), if known. */
  filename?: string
  destroy(): void

  // --- Optional capabilities a renderer may implement. The viewer controller
  // feature-detects them; formats without them get generic fallbacks. ---

  /** Re-rasterize at a new engine scale (crisp zoom for canvas renderers). */
  setScale?(scale: number): Promise<void> | void
  /** Native rotation, in degrees clockwise. */
  rotate?(rotation: 0 | 90 | 180 | 270): Promise<void> | void
  /** Format-specific page switch (e.g. activate a spreadsheet tab). */
  goToPage?(page: number): void
  /** In-document text search (see {@link SearchProvider}). */
  search?: SearchProvider
  /** Page thumbnails (see {@link ThumbnailProvider}). */
  thumbnails?: ThumbnailProvider
  /**
   * Subscribe to "page N was (re)rendered" — virtualized renderers re-create
   * page content as it scrolls into view. Returns an unsubscribe function.
   */
  onPageRendered?(listener: (page: number) => void): () => void
}

export interface SearchOptions {
  /** Default `false`. */
  caseSensitive?: boolean
  /** Default `false`. */
  wholeWord?: boolean
  signal?: AbortSignal
}

export interface SearchMatch {
  /** 1-based page (1 for single-flow formats). */
  page: number
  /** Provider-private locator used by `select()`. */
  locator: unknown
}

export interface SearchResult {
  query: string
  total: number
  matches: SearchMatch[]
}

/** Implemented by renderers that support in-document search. */
export interface SearchProvider {
  /** Find every match (highlighting them) and return them in document order. */
  search(query: string, options?: SearchOptions): Promise<SearchResult>
  /**
   * Make match `index` (0-based) the active one, ensuring it is materialized
   * (virtualized pages get rendered), and return where it is.
   */
  select(index: number): Promise<{ page: number; element?: Element | Range }>
  /** Remove all highlights and forget the query. */
  clear(): void
}

/** Implemented by renderers that can produce page thumbnails. */
export interface ThumbnailProvider {
  readonly count: number
  /** A fresh element sized to `width` px (aspect preserved). */
  render(index: number, options: { width: number; signal?: AbortSignal }): Promise<HTMLElement>
  destroy?(): void
}

/** Normalized input handed to an individual renderer. */
export interface RendererInput {
  container: HTMLElement
  bytes: Uint8Array
  /** The resolved document type this renderer was chosen for. */
  type: AnyDocType
  /** Filename hint, if the source carried one. */
  filename?: string
  /** MIME type hint (Content-Type / data: URL), if the source carried one. */
  mime?: string
  options: RenderOptions
  signal?: AbortSignal
  /** Report a recoverable problem (forwards to `options.onWarning`). */
  warn: (warning: Omit<RenderWarning, 'format'> & { format?: AnyDocType }) => void
}

/** A single-format renderer (one per file in `renderers/`). */
export type Renderer = (input: RendererInput) => Promise<RenderResult>

/**
 * Thrown for documents we deliberately do not support client-side:
 * the legacy binary `.doc` and `.ppt` (pre-2007 OLE) formats, which require
 * a server-side converter (LibreOffice / cloud API) we explicitly avoid.
 */
export class UnsupportedFormatError extends Error {
  constructor(
    message: string,
    public readonly detectedFormat?: string,
  ) {
    super(message)
    this.name = 'UnsupportedFormatError'
  }
}

/**
 * Thrown by renderers for failures that have a stable, machine-readable cause
 * (e.g. `PPTX_NO_SLIDES`, `PDF_PASSWORD_REQUIRED`). Inspect `code` to branch
 * on the reason and `details` for structured context.
 */
export class RenderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly format?: AnyDocType,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'RenderError'
  }
}

/** Thrown when a document's format cannot be determined. */
export class FormatDetectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FormatDetectionError'
  }
}
