/**
 * EMF/WMF → PNG rasterization via `emf-converter` (lazy-loaded, so decks
 * without metafiles never pay for it). Browsers can't decode metafiles, and
 * PowerPoint embeds pasted charts/diagrams/logos as EMF/WMF very often.
 */
export interface MetafileConverter {
  convertEmfToDataUrl(buffer: ArrayBuffer, options?: MetafileOptions): Promise<string | null>
  convertWmfToDataUrl(buffer: ArrayBuffer, options?: MetafileOptions): Promise<string | null>
}

export interface MetafileOptions {
  maxWidth?: number
  maxHeight?: number
  /** Output DPI multiplier (2 = crisp on HiDPI screens). */
  dpiScale?: number
}

export type MetafileKind = 'emf' | 'wmf'

/** Size cap keeps pathological metafiles from allocating huge canvases. */
export const METAFILE_OPTIONS: Readonly<MetafileOptions> = {
  maxWidth: 2000,
  maxHeight: 2000,
  dpiScale: 2,
}

let converterPromise: Promise<MetafileConverter> | undefined

/**
 * Rasterize an EMF/WMF buffer to a PNG data URL. Never throws: an undecodable
 * metafile yields `undefined`, and the caller hides the image instead of
 * showing a broken glyph.
 */
export async function rasterizeMetafile(
  buffer: ArrayBuffer,
  kind: MetafileKind,
  converter?: MetafileConverter,
): Promise<string | undefined> {
  try {
    const c = converter ?? (await (converterPromise ??= import('emf-converter')))
    const png =
      kind === 'emf'
        ? await c.convertEmfToDataUrl(buffer, METAFILE_OPTIONS)
        : await c.convertWmfToDataUrl(buffer, METAFILE_OPTIONS)
    return png ?? undefined
  } catch {
    return undefined
  }
}
