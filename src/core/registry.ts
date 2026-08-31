import { BUILTIN_LOADERS } from './renderers/loaders'
import type { DocType, RenderOptions, RendererLoader, RendererRegistration } from './types'

const global = new Map<string, RendererRegistration>()

function normalize(reg: RendererLoader | RendererRegistration): RendererRegistration {
  return typeof reg === 'function' ? { load: reg } : reg
}

/**
 * Register a renderer for a custom type (e.g. DICOM, EPUB) or override a
 * built-in one, app-wide. Returns a function that unregisters it.
 */
export function registerRenderer(type: string, reg: RendererLoader | RendererRegistration): () => void {
  global.set(type, normalize(reg))
  return () => unregisterRenderer(type)
}

export function unregisterRenderer(type: string): void {
  global.delete(type)
}

export function getRegisteredRenderers(): ReadonlyMap<string, RendererRegistration> {
  return global
}

/** Detection rules contributed by registered renderers (per-call + global). */
export interface DetectionRegistry {
  extensions: Map<string, string>
  mimeTypes: Map<string, string>
  sniffers: Array<{ type: string; sniff: (bytes: Uint8Array) => boolean }>
}

export function detectionRegistry(local?: RenderOptions['renderers']): DetectionRegistry {
  const out: DetectionRegistry = { extensions: new Map(), mimeTypes: new Map(), sniffers: [] }
  // Global first, then per-call so the latter wins on conflicts.
  const sources: Array<[string, RendererRegistration]> = [...global.entries()]
  for (const [type, reg] of Object.entries(local ?? {})) sources.push([type, normalize(reg)])
  for (const [type, reg] of sources) {
    for (const ext of reg.extensions ?? []) out.extensions.set(ext.toLowerCase(), type)
    for (const mime of reg.mimeTypes ?? []) out.mimeTypes.set(mime.toLowerCase(), type)
    if (reg.sniff) out.sniffers.push({ type, sniff: reg.sniff })
  }
  // Per-call sniffers should run before global ones.
  out.sniffers.reverse()
  return out
}

/** Resolution order: per-call `renderers` → global registry → built-ins. */
export function resolveRendererLoader(type: string, local?: RenderOptions['renderers']): RendererLoader | undefined {
  const l = local?.[type]
  if (l) return normalize(l).load
  const g = global.get(type)
  if (g) return g.load
  return (BUILTIN_LOADERS as Record<string, RendererLoader | undefined>)[type as DocType]
}
