import type JSZip from 'jszip'

/**
 * Structural facts about a PPTX package that determine whether `pptx-preview`
 * can render it. The engine enumerates parts ONLY from `[Content_Types].xml`
 * `<Override>` entries and aborts silently (0 slides) on the first missing
 * part, prefixed root, or missing relationship — so we look before we leap.
 *
 * Pure string scanning on purpose: it runs in Node (tests, tooling) and in a
 * Web Worker, and OOXML attribute syntax is regular enough for this.
 */
export interface PptxInspection {
  /** `docProps/app.xml` `<Application>` (e.g. "Microsoft Office PowerPoint", "PptxGenJS"). */
  producer?: string
  /** `p:sldSz` in EMU, when present. */
  slideSize?: { cx: number; cy: number }
  /** Slide parts declared through `<Override … slide+xml>` (zip paths, document order). */
  slideParts: string[]
  /** Slide parts in presentation order (`p:sldIdLst` → `presentation.xml.rels`). */
  slideOrder: string[]
  /** Slides whose root carries `show="0"`. */
  hiddenSlides: string[]
  /** Overrides whose `PartName` is not in the zip (zip paths). */
  missingParts: string[]
  /** Slides whose slideLayout relationship does not resolve to a zip entry. */
  unresolvedLayouts: string[]
  /** Slides without a `_rels/<name>.rels` file. */
  missingRels: string[]
  /** Slide parts that don't follow `ppt/slides/slideN.xml`. */
  nonStandardNames: string[]
  /** `[Content_Types].xml` root is namespace-prefixed (`<ct:Types>`). */
  prefixedRoot: boolean
  /** Number of `<Override>` entries. */
  overrideCount: number
  /** Machine-readable summary of everything that would trip the engine. */
  problems: PptxProblem[]
}

export type PptxProblem =
  | 'missing-parts'
  | 'missing-overrides'
  | 'prefixed-root'
  | 'missing-slide-size'
  | 'bom'
  | 'unresolved-layouts'
  | 'missing-rels'
  | 'no-slides'

export const CONTENT_TYPES_PATH = '[Content_Types].xml'
export const PRESENTATION_PATH = 'ppt/presentation.xml'

/** Content types the engine (and PowerPoint) expect for the parts we may add. */
export const PART_CONTENT_TYPES: Array<{ pattern: RegExp; contentType: string }> = [
  { pattern: /^ppt\/presentation\.xml$/i, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml' },
  { pattern: /^ppt\/slides\/[^/]+\.xml$/i, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml' },
  { pattern: /^ppt\/slideLayouts\/[^/]+\.xml$/i, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml' },
  { pattern: /^ppt\/slideMasters\/[^/]+\.xml$/i, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml' },
  { pattern: /^ppt\/theme\/[^/]+\.xml$/i, contentType: 'application/vnd.openxmlformats-officedocument.theme+xml' },
  { pattern: /^ppt\/tableStyles\.xml$/i, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml' },
  { pattern: /^ppt\/notesSlides\/[^/]+\.xml$/i, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml' },
  { pattern: /^ppt\/notesMasters\/[^/]+\.xml$/i, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml' },
  { pattern: /^ppt\/presProps\.xml$/i, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presProps+xml' },
  { pattern: /^ppt\/viewProps\.xml$/i, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml' },
]

export const SLIDE_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'

export function isJSZip(x: unknown): x is JSZip {
  return typeof x === 'object' && x !== null && typeof (x as JSZip).file === 'function' && typeof (x as JSZip).files === 'object'
}

export async function toZip(input: Uint8Array | ArrayBuffer | JSZip): Promise<JSZip> {
  if (isJSZip(input)) return input
  const JSZipCtor = (await import('jszip')).default
  return JSZipCtor.loadAsync(input)
}

/** Read a zip entry as text, or null when absent. */
export async function zipText(zip: JSZip, path: string): Promise<string | null> {
  const f = zip.file(path)
  return f ? f.async('string') : null
}

/** Read an XML attribute value from an attribute string. */
export function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs)
  return m ? (m[1] ?? m[2]) : undefined
}

/** Resolve a relationship target (`../x.xml`, `slides/slide1.xml`, `/ppt/x.xml`) to a zip path. */
export function resolveRel(fromDir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = (fromDir + target).split('/')
  const out: string[] = []
  for (const p of parts) {
    if (p === '..') out.pop()
    else if (p !== '.' && p !== '') out.push(p)
  }
  return out.join('/')
}

/** Parse `<Relationship Id Type Target/>` entries. */
export function parseRels(xml: string): Array<{ id: string; type: string; target: string }> {
  const out: Array<{ id: string; type: string; target: string }> = []
  const re = /<(?:[\w.-]+:)?Relationship\b([^>]*?)\/?>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const a = m[1] ?? ''
    const id = attr(a, 'Id')
    const target = attr(a, 'Target')
    if (id && target) out.push({ id, type: attr(a, 'Type') ?? '', target })
  }
  return out
}

/** Parse `<Override PartName ContentType/>` entries (with or without a namespace prefix). */
export function parseOverrides(ct: string): Array<{ partName: string; contentType: string }> {
  const out: Array<{ partName: string; contentType: string }> = []
  const re = /<(?:[\w.-]+:)?Override\b([^>]*?)\/?>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(ct))) {
    const a = m[1] ?? ''
    const partName = attr(a, 'PartName')
    if (partName) out.push({ partName, contentType: attr(a, 'ContentType') ?? '' })
  }
  return out
}

const dirOf = (path: string): string => path.slice(0, path.lastIndexOf('/') + 1)
const relsPathFor = (path: string): string => `${dirOf(path)}_rels/${path.slice(dirOf(path).length)}.rels`

/** Inspect a PPTX (bytes or an already-loaded JSZip) without rendering it. */
export async function inspectPptx(input: Uint8Array | ArrayBuffer | JSZip): Promise<PptxInspection> {
  const zip = await toZip(input)
  const files = new Set(Object.keys(zip.files).filter((n) => !zip.files[n]!.dir))
  const problems = new Set<PptxProblem>()

  // --- [Content_Types].xml ---
  const rawCt = (await zipText(zip, CONTENT_TYPES_PATH)) ?? ''
  const hasBom = rawCt.charCodeAt(0) === 0xfeff
  if (hasBom) problems.add('bom')
  const ct = hasBom ? rawCt.slice(1) : rawCt
  const prefixedRoot = /<[\w.-]+:Types\b/.test(ct)
  if (prefixedRoot) problems.add('prefixed-root')
  const overrides = parseOverrides(ct)
  const overridden = new Set(overrides.map((o) => o.partName.replace(/^\//, '')))
  const slideParts = overrides
    .filter((o) => o.contentType === SLIDE_CONTENT_TYPE)
    .map((o) => o.partName.replace(/^\//, ''))
  const missingParts = [...overridden].filter((p) => !files.has(p))
  if (missingParts.length) problems.add('missing-parts')

  // --- presentation.xml + rels ---
  const pres = (await zipText(zip, PRESENTATION_PATH)) ?? ''
  const sz = /<(?:[\w.-]+:)?sldSz\b([^>]*)\/?>/.exec(pres)
  const cx = sz ? Number(attr(sz[1] ?? '', 'cx')) : NaN
  const cy = sz ? Number(attr(sz[1] ?? '', 'cy')) : NaN
  const slideSize = Number.isFinite(cx) && Number.isFinite(cy) && cx > 0 && cy > 0 ? { cx, cy } : undefined
  if (!slideSize) problems.add('missing-slide-size')

  const presRels = parseRels((await zipText(zip, relsPathFor(PRESENTATION_PATH))) ?? '')
  const relById = new Map(presRels.map((r) => [r.id, r]))
  const slideOrder: string[] = []
  const idList = /<(?:[\w.-]+:)?sldIdLst\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?sldIdLst>/.exec(pres)?.[1] ?? ''
  const idRe = /<(?:[\w.-]+:)?sldId\b([^>]*)\/?>/g
  let m: RegExpExecArray | null
  while ((m = idRe.exec(idList))) {
    const rid = attr(m[1] ?? '', 'r:id') ?? attr(m[1] ?? '', 'id')
    const rel = rid ? relById.get(rid) : undefined
    if (rel) slideOrder.push(resolveRel(dirOf(PRESENTATION_PATH), rel.target))
  }
  // Fallback: rels of type slide, in rels order.
  if (slideOrder.length === 0) {
    for (const r of presRels) {
      if (/\/slide$/.test(r.type)) slideOrder.push(resolveRel(dirOf(PRESENTATION_PATH), r.target))
    }
  }

  // --- per-slide checks ---
  const hiddenSlides: string[] = []
  const unresolvedLayouts: string[] = []
  const missingRels: string[] = []
  const nonStandardNames: string[] = []
  const allSlides = [...new Set([...slideOrder, ...slideParts])].filter((p) => files.has(p))
  for (const slide of allSlides) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(slide)) nonStandardNames.push(slide)
    const xml = (await zipText(zip, slide)) ?? ''
    const root = /<(?:[\w.-]+:)?sld\b([^>]*)>/.exec(xml)
    if (root && attr(root[1] ?? '', 'show') === '0') hiddenSlides.push(slide)
    const rels = await zipText(zip, relsPathFor(slide))
    if (rels === null) {
      missingRels.push(slide)
      continue
    }
    const layout = parseRels(rels).find((r) => /\/slideLayout$/.test(r.type))
    if (layout && !files.has(resolveRel(dirOf(slide), layout.target))) unresolvedLayouts.push(slide)
  }
  if (unresolvedLayouts.length) problems.add('unresolved-layouts')
  if (missingRels.length) problems.add('missing-rels')

  // Parts that exist but have no Override (engine can't see them).
  const needsOverride = [...files].some(
    (p) => PART_CONTENT_TYPES.some((t) => t.pattern.test(p)) && !overridden.has(p),
  )
  if (needsOverride) problems.add('missing-overrides')
  if (slideOrder.length === 0 && slideParts.length === 0) problems.add('no-slides')

  // --- producer ---
  const app = await zipText(zip, 'docProps/app.xml')
  const producer = app ? /<(?:[\w.-]+:)?Application>([^<]*)</.exec(app)?.[1]?.trim() : undefined

  return {
    producer: producer || undefined,
    slideSize,
    slideParts,
    slideOrder,
    hiddenSlides,
    missingParts,
    unresolvedLayouts,
    missingRels,
    nonStandardNames,
    prefixedRoot,
    overrideCount: overrides.length,
    problems: [...problems],
  }
}
