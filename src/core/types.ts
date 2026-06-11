/**
 * The four document formats this package can render fully client-side.
 */
export type DocType = 'pdf' | 'docx' | 'xlsx' | 'pptx'

/**
 * Anything you can hand to {@link renderDocument} as the document to display.
 *
 * - `string`  — a URL (http(s) or blob:) that will be fetched
 * - `File` / `Blob` — e.g. from an `<input type="file">` or drag-drop
 * - `ArrayBuffer` / `Uint8Array` — raw bytes you already have in memory
 */
export type DocSource = string | File | Blob | ArrayBuffer | Uint8Array

/**
 * Metadata reported once a document has loaded.
 */
export interface RenderMeta {
  type: DocType
  /**
   * Number of "pages" in the document, when meaningful:
   * PDF pages, PPTX slides, or XLSX sheets. Omitted for DOCX (continuous flow).
   */
  pageCount?: number
}

/**
 * Per-format tuning. All optional.
 */
export interface RenderTuning {
  pdf?: {
    /** Canvas render scale. Default 1.5 (crisp on most displays). */
    scale?: number
    /**
     * Explicit URL for the pdf.js web worker. If omitted we resolve the
     * worker bundled with `pdfjs-dist` via `import.meta.url`, which works in
     * modern bundlers (Vite, webpack 5, Next.js). Set this if your bundler
     * cannot resolve the worker — see the README.
     */
    workerSrc?: string
  }
  pptx?: {
    /** Slide width in px. Defaults to the container width (or 960). */
    width?: number
    /** Slide height in px. Defaults to width * 9/16. */
    height?: number
  }
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
  type?: DocType
  /** Abort an in-flight render (e.g. when the source changes). */
  signal?: AbortSignal
  /** Called if rendering fails. The returned promise also rejects. */
  onError?: (error: Error) => void
}

/**
 * Handle returned by {@link renderDocument}. Call {@link RenderResult.destroy}
 * to tear down listeners, free engine resources, and clear the container.
 */
export interface RenderResult {
  type: DocType
  meta: RenderMeta
  /**
   * The individual page elements in render order (PDF pages, PPTX slides,
   * DOCX paginated sections). Used by the viewer to drive page-by-page
   * navigation and the "current / total" indicator. Omitted for formats with
   * no meaningful page model (e.g. XLSX, which navigates by sheet tabs).
   */
  pages?: HTMLElement[]
  destroy(): void
}

/** Normalized input handed to an individual renderer. */
export interface RendererInput {
  container: HTMLElement
  bytes: Uint8Array
  options: RenderOptions
  signal?: AbortSignal
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

/** Thrown when a document's format cannot be determined. */
export class FormatDetectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FormatDetectionError'
  }
}
