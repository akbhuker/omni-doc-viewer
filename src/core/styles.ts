/**
 * Stylesheet injection shared by every renderer and the React toolbar.
 *
 * Prefers constructable stylesheets (`document.adoptedStyleSheets`) — CSSOM
 * insertion isn't governed by CSP `style-src`, so it works under strict
 * policies without a nonce. Falls back to a `<style>` element (with the nonce
 * when one is configured). Every sheet is also recorded so the print frame
 * can rebuild the same styles.
 */
export interface StyleInjectOptions {
  /** CSP nonce for the `<style>` fallback. Defaults to {@link setStyleNonce}. */
  nonce?: string
  /** Where to inject. Defaults to `document`. */
  root?: Document | ShadowRoot
}

const registry = new Map<string, string>()
const injectedRoots = new WeakMap<Document | ShadowRoot, Set<string>>()
let globalNonce: string | undefined

/** Set a default CSP nonce for all stylesheets injected from now on. */
export function setStyleNonce(nonce: string | undefined): void {
  globalNonce = nonce
}

export function getStyleNonce(): string | undefined {
  return globalNonce
}

function supportsConstructable(root: Document | ShadowRoot): boolean {
  return (
    typeof CSSStyleSheet === 'function' &&
    typeof (CSSStyleSheet.prototype as any).replaceSync === 'function' &&
    Array.isArray((root as any).adoptedStyleSheets)
  )
}

/** Inject `css` once per `id` (per root). Later calls with the same id are ignored. */
export function ensureStyles(id: string, css: string, options: StyleInjectOptions = {}): void {
  if (typeof document === 'undefined') return
  const root = options.root ?? document
  let done = injectedRoots.get(root)
  if (!done) {
    done = new Set()
    injectedRoots.set(root, done)
  }
  if (done.has(id)) return
  done.add(id)
  if (!registry.has(id)) registry.set(id, css)

  if (supportsConstructable(root)) {
    try {
      const sheet = new CSSStyleSheet()
      ;(sheet as any).replaceSync(css)
      ;(root as any).adoptedStyleSheets = [...(root as any).adoptedStyleSheets, sheet]
      return
    } catch {
      /* fall through to a <style> element */
    }
  }
  const el = document.createElement('style')
  el.id = id
  const nonce = options.nonce ?? globalNonce
  if (nonce) el.setAttribute('nonce', nonce)
  el.textContent = css
  const head = root === document ? document.head : (root as ShadowRoot)
  head.appendChild(el)
}

/** All CSS registered so far, in injection order (used by the print frame). */
export function getInjectedCss(): string {
  return [...registry.values()].join('\n')
}

/** Test hook: forget everything that was injected. */
export function __resetStylesForTests(): void {
  registry.clear()
  if (typeof document !== 'undefined') {
    injectedRoots.delete(document)
    if (Array.isArray((document as any).adoptedStyleSheets)) (document as any).adoptedStyleSheets = []
  }
}
