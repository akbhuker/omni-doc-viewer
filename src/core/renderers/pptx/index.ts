import { RenderError, type Renderer, type RendererInput } from '../../types'
import { rasterizeMetafile } from './metafile'
import { createDomSearchProvider } from '../../search/dom'
import { inspectPptx, type PptxInspection } from './inspect'
import { sanitizePptx } from './sanitize'

/**
 * PPTX rendering uses `pptx-preview` (pure front-end). Fidelity is good for
 * text, lists, basic shapes and images, but NOT a pixel-perfect PowerPoint:
 * animations, transitions, 3D, charts, SmartArt, OLE objects and speaker
 * notes are not reproduced. This is documented in the README's scope table.
 *
 * Two quirks of the engine we work around here:
 *  - it hardcodes a black (`#000`) wrapper background, and
 *  - it gives the wrapper a fixed viewport height with inner scrolling.
 * We neutralize both so all slides render stacked on a neutral backdrop —
 * otherwise the viewer looks like a "black screen".
 *
 * IMAGES: PowerPoint commonly embeds vector art as EMF/WMF metafiles (e.g.
 * pasted charts, diagrams and logos). `pptx-preview` hands those to the
 * browser as `<img src="data:image/x-emf;…">`, which NO browser can decode —
 * they render as the broken-image glyph even though they look fine in
 * PowerPoint. Raster images (PNG/JPEG) the engine handles correctly. We fix
 * the gap on three fronts:
 *  1. Build a COMPLETE media map ourselves (every file under `ppt/media/`),
 *     converting any EMF/WMF to a PNG data URL on a canvas (via the lazily
 *     loaded `emf-converter`, so decks without metafiles pay nothing).
 *  2. Patch the engine's `getMedia` to serve our map — the converted PNG for
 *     metafiles, and a fallback for any raster the engine's narrow loader
 *     missed (it only picks up paths starting `ppt/media/image`).
 *  3. After render, hide any `<img>` that is STILL broken (a metafile we
 *     couldn't convert, or a missing source) so the slide stays clean instead
 *     of showing a torn-image icon.
 */

const MEDIA_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
}

function mimeFor(name: string): string {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  return MEDIA_MIME[ext] ?? 'image/*'
}

interface PreparedPptx {
  /** Media keyed by full path AND basename; EMF/WMF already rasterized to PNG. */
  mediaMap: Record<string, string>
  /** The deck bytes, possibly rewritten to repair the package / placeholder geometry. */
  buffer: ArrayBuffer
  /** Structural facts about the deck (undefined if the zip could not be read). */
  inspection?: PptxInspection
  /** Object URLs created for media; revoke on destroy. */
  objectUrls: string[]
}

/**
 * Single pass over the PPTX zip that produces everything the renderer needs:
 *
 *  1. A COMPLETE media map (every `ppt/media/*`), with EMF/WMF metafiles
 *     rasterized to PNG on a canvas (browsers can't decode metafiles).
 *  2. A patched copy of the deck where PICTURE PLACEHOLDERS — pics whose own
 *     `<p:spPr>` carries no `<a:xfrm>` and which inherit their size/position
 *     from the slide layout/master — get that geometry inlined. `pptx-preview`
 *     resolves placeholder geometry for text shapes but not for pictures, so
 *     without this such images render at 0×0 and are invisible.
 */
async function preparePptx(
  bytes: Uint8Array,
  warn: RendererInput['warn'],
  signal?: AbortSignal,
): Promise<PreparedPptx> {
  const fallback = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const mediaMap: Record<string, string> = {}
  const objectUrls: string[] = []
  let inspection: PptxInspection | undefined
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(bytes)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // --- 0. inspect + repair the package so the engine can see every part ---
    inspection = await inspectPptx(zip)
    const repaired = await sanitizePptx(zip, inspection)
    for (const w of repaired.warnings) warn(w)
    let structureChanged = repaired.changed

    // --- 1. media map (with metafile conversion) ---
    const media = Object.values(zip.files).filter(
      (f: any) => !f.dir && /^ppt\/media\//i.test(f.name),
    )
    for (const file of media as any[]) {
      const name: string = file.name
      const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
      let url: string | undefined
      if (ext === 'emf' || ext === 'wmf') {
        // Undecodable → stays unset → image gets hidden rather than shown broken.
        const ab: ArrayBuffer = await file.async('arraybuffer')
        url = await rasterizeMetafile(ab, ext)
      } else {
        // Object URLs keep large rasters off the JS heap (base64 inflates ~1.37×).
        const data: Uint8Array = await file.async('uint8array')
        url = URL.createObjectURL(new Blob([data.slice()], { type: mimeFor(name) }))
        objectUrls.push(url)
      }
      if (url) {
        mediaMap[name] = url
        mediaMap[name.slice(name.lastIndexOf('/') + 1)] = url
      }
    }
    // The engine would base64-encode every media part itself on load; since
    // our patched getMedia serves them, drop them from the copy it parses.
    if (media.length > 0) {
      for (const file of media as any[]) zip.remove(file.name)
      structureChanged = true
    }

    // --- 2. inline inherited geometry into placeholder pictures ---
    try {
      if (await patchPlaceholderPictures(zip)) structureChanged = true
    } catch {
      /* Geometry patch is best-effort; the deck still renders without it. */
    }
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const buffer = structureChanged
      ? await zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' })
      : fallback
    return { mediaMap, buffer, inspection, objectUrls }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return { mediaMap, buffer: fallback, inspection, objectUrls }
  }
}

type Geom = { x: string; y: string; cx: string; cy: string }

const XML = 'application/xml' as const

/** Read a file from the zip as text, or null if absent. */
async function zipText(zip: any, path: string): Promise<string | null> {
  const f = zip.file(path)
  return f ? await f.async('string') : null
}

/** Resolve a relationship Target (often `../foo/bar.xml`) to a zip path. */
function resolveRel(fromDir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = (fromDir + target).split('/')
  const out: string[] = []
  for (const p of parts) {
    if (p === '..') out.pop()
    else if (p !== '.' && p !== '') out.push(p)
  }
  return out.join('/')
}

/** Build a placeholder→geometry map (keyed `idx:N` and `type:T`) for a part. */
function placeholderGeom(xml: string): Record<string, Geom> {
  const map: Record<string, Geom> = {}
  const doc = new DOMParser().parseFromString(xml, XML)
  const sps = doc.getElementsByTagName('p:sp')
  for (let i = 0; i < sps.length; i++) {
    const sp = sps[i]
    if (!sp) continue
    const ph = sp.getElementsByTagName('p:ph')[0]
    const xfrm = sp.getElementsByTagName('a:xfrm')[0]
    if (!ph || !xfrm) continue
    const off = xfrm.getElementsByTagName('a:off')[0]
    const ext = xfrm.getElementsByTagName('a:ext')[0]
    if (!off || !ext) continue
    const geom: Geom = {
      x: off.getAttribute('x') ?? '0',
      y: off.getAttribute('y') ?? '0',
      cx: ext.getAttribute('cx') ?? '0',
      cy: ext.getAttribute('cy') ?? '0',
    }
    const idx = ph.getAttribute('idx')
    const type = ph.getAttribute('type')
    if (idx != null && !map['idx:' + idx]) map['idx:' + idx] = geom
    if (type != null && !map['type:' + type]) map['type:' + type] = geom
  }
  return map
}

/**
 * For every slide, give picture placeholders that lack their own transform the
 * geometry inherited from the matching layout (then master) placeholder.
 * Returns true if any slide XML was rewritten.
 */
async function patchPlaceholderPictures(zip: any): Promise<boolean> {
  const slidePaths = Object.keys(zip.files).filter((n) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(n),
  )
  const serializer = new XMLSerializer()
  let changedAny = false

  for (const slidePath of slidePaths) {
    const slideXml = await zipText(zip, slidePath)
    if (!slideXml || slideXml.indexOf('<p:pic') === -1) continue

    const dir = slidePath.slice(0, slidePath.lastIndexOf('/') + 1)
    const relsPath = dir + '_rels/' + slidePath.slice(dir.length) + '.rels'
    const relsXml = await zipText(zip, relsPath)
    if (!relsXml) continue

    // Resolve this slide's layout, then the layout's master.
    const rels = new DOMParser().parseFromString(relsXml, XML)
    const relEls = Array.from(rels.getElementsByTagName('Relationship'))
    const layoutTarget = relEls.find((r) =>
      (r.getAttribute('Type') ?? '').endsWith('/slideLayout'),
    )?.getAttribute('Target')
    if (!layoutTarget) continue
    const layoutPath = resolveRel(dir, layoutTarget)

    const geomMaps: Record<string, Geom>[] = []
    const layoutXml = await zipText(zip, layoutPath)
    if (layoutXml) geomMaps.push(placeholderGeom(layoutXml))

    const layoutDir = layoutPath.slice(0, layoutPath.lastIndexOf('/') + 1)
    const layoutRels = await zipText(
      zip,
      layoutDir + '_rels/' + layoutPath.slice(layoutDir.length) + '.rels',
    )
    if (layoutRels) {
      const lr = new DOMParser().parseFromString(layoutRels, XML)
      const masterTarget = Array.from(lr.getElementsByTagName('Relationship'))
        .find((r) => (r.getAttribute('Type') ?? '').endsWith('/slideMaster'))
        ?.getAttribute('Target')
      if (masterTarget) {
        const masterXml = await zipText(zip, resolveRel(layoutDir, masterTarget))
        if (masterXml) geomMaps.push(placeholderGeom(masterXml))
      }
    }

    if (geomMaps.length === 0) continue

    const doc = new DOMParser().parseFromString(slideXml, XML)
    if (doc.getElementsByTagName('parsererror').length > 0) continue
    let changed = false
    const pics = doc.getElementsByTagName('p:pic')
    for (let i = 0; i < pics.length; i++) {
      const pic = pics[i]
      if (!pic) continue
      const spPr = pic.getElementsByTagName('p:spPr')[0]
      if (!spPr || spPr.getElementsByTagName('a:xfrm').length > 0) continue
      const ph = pic.getElementsByTagName('p:ph')[0]
      if (!ph) continue
      const idx = ph.getAttribute('idx')
      const type = ph.getAttribute('type')
      let geom: Geom | undefined
      for (const m of geomMaps) {
        geom =
          (idx != null ? m['idx:' + idx] : undefined) ??
          (type != null ? m['type:' + type] : undefined)
        if (geom) break
      }
      if (!geom) continue

      // Build <a:xfrm><a:off/><a:ext/></a:xfrm> in the DrawingML namespace and
      // insert it as the first child of spPr (schema requires xfrm first).
      const ns = 'http://schemas.openxmlformats.org/drawingml/2006/main'
      const xfrm = doc.createElementNS(ns, 'a:xfrm')
      const off = doc.createElementNS(ns, 'a:off')
      off.setAttribute('x', geom.x)
      off.setAttribute('y', geom.y)
      const ext = doc.createElementNS(ns, 'a:ext')
      ext.setAttribute('cx', geom.cx)
      ext.setAttribute('cy', geom.cy)
      xfrm.appendChild(off)
      xfrm.appendChild(ext)
      spPr.insertBefore(xfrm, spPr.firstChild)
      changed = true
    }

    if (changed) {
      zip.file(slidePath, serializer.serializeToString(doc))
      changedAny = true
    }
  }
  return changedAny
}

export const render: Renderer = async ({ container, bytes, options, warn, signal }) => {
  const { init }: any = await import('pptx-preview')

  const host = document.createElement('div')
  host.className = 'odv-pptx'
  host.style.width = '100%'
  host.style.display = 'flex'
  host.style.justifyContent = 'center'
  container.appendChild(host)

  // Measure the real available width (the container must be laid out, not
  // display:none — the React wrapper guarantees this). Fall back to 960.
  const measured = container.clientWidth || host.clientWidth
  const width = options.pptx?.width ?? (measured > 16 ? measured : 960)
  const height = options.pptx?.height ?? Math.round((width * 9) / 16)

  // Default mode renders every slide in normal flow (relative, white bg) —
  // exactly what a document viewer wants. Do NOT pass mode:'slide'.
  const previewer = init(host, { width, height })

  // Build the media map (with EMF/WMF → PNG) and a deck buffer with
  // placeholder-picture geometry inlined, in a single pass over the zip.
  const { mediaMap, buffer: arrayBuffer, inspection, objectUrls } = await preparePptx(bytes, warn, signal)

  // Patch the engine's getMedia so images it would otherwise miss still
  // resolve (and metafiles serve our converted PNG). We grab the prototype
  // from a cheap pre-load (parse only, no render) and restore it after.
  let restoreGetMedia: (() => void) | undefined
  if (Object.keys(mediaMap).length > 0) {
    try {
      const pptx = await previewer.load(arrayBuffer.slice(0))
      const proto = Object.getPrototypeOf(pptx)
      const orig = proto.getMedia
      if (typeof orig === 'function' && !proto.__odvPatched) {
        proto.getMedia = function patchedGetMedia(this: any, key: string) {
          if (key == null) return orig.call(this, key)
          const base = key.split('/').pop() as string
          const lower = key.toLowerCase()
          // For metafiles, prefer OUR converted PNG over the engine's raw
          // (undecodable) EMF/WMF data URL.
          if (lower.endsWith('.emf') || lower.endsWith('.wmf')) {
            return mediaMap[key] ?? mediaMap[base] ?? orig.call(this, key)
          }
          const direct = orig.call(this, key)
          if (direct) return direct
          return mediaMap[key] ?? mediaMap[base] ?? direct
        }
        proto.__odvPatched = true
        restoreGetMedia = () => {
          proto.getMedia = orig
          delete proto.__odvPatched
        }
      }
    } catch {
      /* Pre-load failed — fall back to the engine's own media handling. */
    }
  }

  try {
    await previewer.preview(arrayBuffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new RenderError(
      `The PowerPoint engine failed to render this deck: ${message}`,
      'PPTX_ENGINE_ERROR',
      'pptx',
      { inspection, cause: err },
    )
  } finally {
    restoreGetMedia?.()
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // Undo the engine's black/fixed-height wrapper so all slides show stacked.
  const wrapper: HTMLElement | undefined = previewer.wrapper
  if (wrapper) {
    wrapper.style.setProperty('background', 'transparent', 'important')
    wrapper.style.setProperty('height', 'auto', 'important')
    wrapper.style.setProperty('overflow', 'visible', 'important')
    wrapper.style.setProperty('max-width', '100%')
  }

  // Hide any image the browser still can't render (missing src, or an EMF/WMF
  // vector format browsers can't decode) so we never show the broken glyph.
  hideBrokenImages(host)

  let pages = wrapper
    ? Array.from(
        wrapper.querySelectorAll<HTMLElement>('.pptx-preview-slide-wrapper'),
      )
    : []

  // The engine silently yields 0 slides for structures it can't read. If we
  // know the deck HAS slides, that's a failure — never report success with 0.
  if (pages.length === 0 && inspection && inspection.slideOrder.length > 0) {
    throw new RenderError(
      `The PowerPoint engine could not read any of the ${inspection.slideOrder.length} slide(s) in this deck.`,
      'PPTX_NO_SLIDES',
      'pptx',
      { inspection },
    )
  }
  if (pages.length === 0) {
    warn({ code: 'pptx/empty-deck', message: 'This presentation contains no slides.' })
  }

  if (wrapper && inspection) {
    pages = arrangeSlides(wrapper, pages, inspection, {
      showHidden: options.pptx?.showHiddenSlides === true,
      warn,
    })
  }

  return {
    type: 'pptx',
    meta: { type: 'pptx', pageCount: pages.length },
    pages,
    search: createDomSearchProvider({ root: host, pages }),
    destroy() {
      try {
        previewer.destroy?.()
      } catch {
        /* ignore */
      }
      for (const url of objectUrls) URL.revokeObjectURL(url)
      container.replaceChildren()
    },
  }
}

/** Hide imgs with no usable source and any that fail to decode at load time. */
function hideBrokenImages(root: HTMLElement): void {
  const hide = (img: HTMLImageElement) => {
    img.style.display = 'none'
  }
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src')
    if (!src || src === 'undefined' || src === 'null') {
      hide(img)
      return
    }
    // EMF/WMF carry a valid data URL but browsers can't decode them.
    if (/^data:image\/x-(emf|wmf)/i.test(src)) {
      hide(img)
      return
    }
    img.addEventListener('error', () => hide(img), { once: true })
  })
}

/** Numeric suffix of a slide part (`slide12.xml` → 12) — the engine sorts by it. */
function slideNumber(path: string): number {
  const m = /(\d+)\.xml$/.exec(path)
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER
}

/**
 * The engine renders slides sorted by their file-name number and includes
 * hidden ones. Re-order the rendered wrappers to the presentation's own order
 * (`p:sldIdLst`) and drop hidden slides unless asked to show them.
 */
function arrangeSlides(
  wrapper: HTMLElement,
  pages: HTMLElement[],
  inspection: PptxInspection,
  opts: { showHidden: boolean; warn: RendererInput['warn'] },
): HTMLElement[] {
  // Which part does each rendered wrapper correspond to? Mirror the engine's
  // enumeration (Override entries sorted by number). Only trust the mapping
  // when the counts agree.
  const engineParts = [...inspection.slideParts].sort((a, b) => slideNumber(a) - slideNumber(b))
  if (engineParts.length !== pages.length) {
    if (inspection.hiddenSlides.length || inspection.slideOrder.length) {
      opts.warn({
        code: 'pptx/slide-order-unknown',
        message: 'Could not map rendered slides to the presentation order; showing them in engine order.',
        details: { rendered: pages.length, declared: engineParts.length },
      })
    }
    return pages
  }
  const byPart = new Map<string, HTMLElement>()
  engineParts.forEach((part, i) => byPart.set(part, pages[i]!))

  const ordered: string[] = [...inspection.slideOrder.filter((p) => byPart.has(p))]
  for (const part of engineParts) if (!ordered.includes(part)) ordered.push(part)

  const hidden = new Set(inspection.hiddenSlides)
  const kept: HTMLElement[] = []
  for (const part of ordered) {
    const el = byPart.get(part)!
    if (!opts.showHidden && hidden.has(part)) {
      el.remove()
      continue
    }
    wrapper.appendChild(el) // appending re-orders in place
    kept.push(el)
  }
  return kept
}
