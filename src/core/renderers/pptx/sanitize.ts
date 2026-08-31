import type JSZip from 'jszip'
import {
  CONTENT_TYPES_PATH,
  PART_CONTENT_TYPES,
  PRESENTATION_PATH,
  parseOverrides,
  zipText,
  type PptxInspection,
} from './inspect'

export interface SanitizeWarning {
  code: string
  message: string
  details?: unknown
}

export interface SanitizeResult {
  /** True when any zip entry was rewritten (regenerate the buffer). */
  changed: boolean
  warnings: SanitizeWarning[]
}

/** Default 16:9 slide size (13.333in × 7.5in) in EMU. */
export const DEFAULT_SLIDE_SIZE = { cx: 12192000, cy: 6858000 }

/**
 * Repair the package structures that make `pptx-preview` silently render
 * nothing. Every change is best-effort, minimal, and reported as a warning so
 * consumers (and bug reports) can see what was done.
 */
export async function sanitizePptx(zip: JSZip, inspection: PptxInspection): Promise<SanitizeResult> {
  const warnings: SanitizeWarning[] = []
  let changed = false
  const files = new Set(Object.keys(zip.files).filter((n) => !zip.files[n]!.dir))

  // ---- [Content_Types].xml ------------------------------------------------
  let ct = (await zipText(zip, CONTENT_TYPES_PATH)) ?? ''
  const originalCt = ct

  if (ct.charCodeAt(0) === 0xfeff) {
    ct = ct.slice(1)
    warnings.push({ code: 'pptx/stripped-bom', message: 'Removed a UTF-8 BOM from [Content_Types].xml.' })
  }

  const prefix = /<([\w.-]+):Types\b/.exec(ct)?.[1]
  if (prefix) {
    const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ct = ct
      .replace(new RegExp(`<${esc}:`, 'g'), '<')
      .replace(new RegExp(`</${esc}:`, 'g'), '</')
      .replace(new RegExp(`\\sxmlns:${esc}=`, 'g'), ' xmlns=')
    warnings.push({
      code: 'pptx/normalized-content-types',
      message: `Removed the "${prefix}:" namespace prefix from [Content_Types].xml.`,
    })
  }

  if (inspection.missingParts.length) {
    const missing = new Set(inspection.missingParts.map((p) => '/' + p))
    const removed: string[] = []
    ct = ct.replace(/<Override\b[^>]*?\/?>/g, (m) => {
      const part = /PartName\s*=\s*"([^"]*)"/.exec(m)?.[1]
      if (part && missing.has(part)) {
        removed.push(part)
        return ''
      }
      return m
    })
    if (removed.length) {
      warnings.push({
        code: 'pptx/removed-phantom-overrides',
        message: `Removed ${removed.length} Content_Types override(s) for parts missing from the package.`,
        details: { parts: removed },
      })
    }
  }

  // Add Overrides for real parts the engine would otherwise never see.
  const overridden = new Set(parseOverrides(ct).map((o) => o.partName.replace(/^\//, '')))
  const added: string[] = []
  for (const path of [...files].sort()) {
    if (overridden.has(path)) continue
    const type = PART_CONTENT_TYPES.find((t) => t.pattern.test(path))
    if (!type) continue
    added.push(path)
    ct = ct.replace(/<\/Types>\s*$/, `<Override PartName="/${path}" ContentType="${type.contentType}"/></Types>`)
  }
  if (added.length) {
    warnings.push({
      code: 'pptx/added-overrides',
      message: `Declared ${added.length} part(s) in [Content_Types].xml that were only covered by <Default> entries.`,
      details: { parts: added },
    })
  }

  if (ct !== originalCt) {
    zip.file(CONTENT_TYPES_PATH, ct)
    changed = true
  }

  // ---- presentation.xml --------------------------------------------------
  if (!inspection.slideSize) {
    const pres = await zipText(zip, PRESENTATION_PATH)
    if (pres && !/<(?:[\w.-]+:)?sldSz\b/.test(pres)) {
      const tag = `<p:sldSz cx="${DEFAULT_SLIDE_SIZE.cx}" cy="${DEFAULT_SLIDE_SIZE.cy}"/>`
      const patched = /<(?:[\w.-]+:)?notesSz\b/.test(pres)
        ? pres.replace(/<((?:[\w.-]+:)?)notesSz\b/, `${tag}<$1notesSz`)
        : pres.replace(/<\/((?:[\w.-]+:)?)presentation>\s*$/, `${tag}</$1presentation>`)
      if (patched !== pres) {
        zip.file(PRESENTATION_PATH, patched)
        changed = true
        warnings.push({
          code: 'pptx/injected-slide-size',
          message: 'presentation.xml had no slide size; assumed 16:9 (13.33in × 7.5in).',
        })
      }
    }
  }

  return { changed, warnings }
}
