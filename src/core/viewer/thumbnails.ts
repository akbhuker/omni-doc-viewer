import { ensureStyles } from '../styles'
import type { RenderResult } from '../types'
import type { ViewerController } from './types'

export interface ThumbnailStripOptions {
  /** Element the strip renders into (its contents are replaced). */
  container: HTMLElement
  /** Thumbnail width in px. Default 120. */
  width?: number
  /** Accessible label per page. Default "Page N". */
  label?: (page: number) => string
}

export interface ThumbnailStrip {
  /** Rebuild from the controller's current document. */
  refresh(): void
  destroy(): void
}

const THUMBS_CSS = `
.odv-thumbs{display:flex;flex-direction:column;gap:10px;padding:10px;box-sizing:border-box;overflow:auto;
  background:var(--odv-bg,#f4f4f6);border-right:1px solid var(--odv-border,#ececef);
  font:500 11px/1 var(--odv-font,system-ui,sans-serif);color:var(--odv-fg-muted,#6b6b70)}
.odv-thumb{display:block;flex:0 0 auto;padding:4px;border:0;border-radius:6px;background:transparent;cursor:pointer;
  text-align:center;color:inherit;font:inherit}
.odv-thumb:hover .odv-thumb-frame{box-shadow:0 0 0 2px var(--odv-accent-ring,rgba(59,130,246,.35))}
.odv-thumb[aria-current="page"] .odv-thumb-frame{box-shadow:0 0 0 2px var(--odv-accent,#3b82f6)}
.odv-thumb-frame{position:relative;margin:0 auto;overflow:hidden;background:var(--odv-page-bg,#fff);
  box-shadow:var(--odv-page-shadow,0 1px 3px rgba(0,0,0,.18));border-radius:2px}
.odv-thumb-content{pointer-events:none;user-select:none}
.odv-thumb-content canvas,.odv-thumb-content img{display:block;width:100%;height:auto}
.odv-thumb-label{display:block;margin-top:5px}
`

/** A CSS length from an inline style, converted to px (pt/in/cm/mm supported). */
function cssPx(value: string): number | undefined {
  const m = /^\s*([\d.]+)(px|pt|in|cm|mm)?\s*$/.exec(value)
  if (!m) return undefined
  const n = parseFloat(m[1]!)
  const unit = m[2] ?? 'px'
  const per = { px: 1, pt: 96 / 72, in: 96, cm: 96 / 2.54, mm: 96 / 25.4 }[unit] ?? 1
  return n * per
}

/**
 * Natural (unscaled) size of a page element. Hidden pages (paged mode) have
 * no layout box, so callers pass a `reference` size measured from a visible
 * sibling — pages of one document normally share a size.
 */
function naturalSize(
  el: HTMLElement,
  reference?: { width: number; height: number },
  hostZoom = 1,
): { width: number; height: number } {
  // The page element's own box (unzoomed) is the truth; images/canvases
  // INSIDE a page (logos, photos) must never stand in for the page size.
  if (el instanceof HTMLImageElement && el.naturalWidth) return { width: el.naturalWidth, height: el.naturalHeight }
  if (el instanceof HTMLCanvasElement && el.width) {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    return { width: el.width / dpr, height: el.height / dpr }
  }
  const rect = el.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) return { width: rect.width / hostZoom, height: rect.height / hostZoom }
  if (reference) return reference
  const w = cssPx(el.style.width) || el.offsetWidth
  const h = cssPx(el.style.height) || el.offsetHeight
  if (w && h) return { width: w, height: h }
  const canvas = el.querySelector('canvas')
  if (canvas?.width) {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    return { width: canvas.width / dpr, height: canvas.height / dpr }
  }
  const img = el.querySelector('img')
  if (img?.naturalWidth) return { width: img.naturalWidth, height: img.naturalHeight }
  return { width: w || 800, height: h || (w || 800) * 1.3 }
}

/** CSS `zoom` currently applied to the host (the controller's zoom). */
function zoomOf(host: HTMLElement): number {
  const z = parseFloat(getComputedStyle(host).getPropertyValue('zoom'))
  return Number.isFinite(z) && z > 0 ? z : 1
}

/** Size of the first page that currently has a layout box, if any. */
function referenceSize(pages: HTMLElement[], hostZoom: number): { width: number; height: number } | undefined {
  for (const p of pages) {
    const r = p.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return { width: r.width / hostZoom, height: r.height / hostZoom }
  }
  return undefined
}

/** Generic thumbnail: an inert, scaled clone of the page element. */
function cloneThumbnail(page: HTMLElement, width: number, size: { width: number; height: number }): HTMLElement {
  const { width: w, height: h } = size
  const clone = page.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
  clone.style.display = ''
  // cloneNode() leaves canvases blank — copy the bitmaps.
  const src = page.querySelectorAll('canvas')
  clone.querySelectorAll('canvas').forEach((c, i) => {
    const s = src[i]
    if (!s) return
    try {
      c.width = s.width
      c.height = s.height
      c.getContext('2d')?.drawImage(s, 0, 0)
    } catch {
      /* tainted or unsupported — leave blank */
    }
  })
  const wrap = document.createElement('div')
  wrap.className = 'odv-thumb-content'
  wrap.style.width = `${w}px`
  wrap.style.height = `${h}px`
  wrap.style.overflow = 'hidden'
  wrap.style.setProperty('zoom', String(width / Math.max(w, 1)))
  wrap.setAttribute('inert', '')
  wrap.appendChild(clone)
  return wrap
}

/**
 * A lazily-rendered thumbnail strip bound to a viewer controller: one button
 * per page, rendered as it scrolls into view, highlighting and following the
 * current page, and navigating on click. Uses the renderer's
 * `ThumbnailProvider` when it has one, else a scaled clone of the page.
 */
export function createThumbnailStrip(controller: ViewerController, opts: ThumbnailStripOptions): ThumbnailStrip {
  const { container } = opts
  const width = opts.width ?? 120
  const label = opts.label ?? ((n: number) => `Page ${n}`)
  ensureStyles('odv-thumbs-styles', THUMBS_CSS)
  container.classList.add('odv-thumbs')

  let result: RenderResult | null = null
  let buttons: HTMLButtonElement[] = []
  let io: IntersectionObserver | undefined
  let generation = 0

  function discard(i: number): void {
    const frame = buttons[i]?.querySelector('.odv-thumb-frame')
    frame?.querySelector('.odv-thumb-content')?.remove()
  }

  async function render(i: number): Promise<void> {
    const r = result
    const btn = buttons[i]
    if (!r || !btn) return
    const frame = btn.querySelector<HTMLElement>('.odv-thumb-frame')!
    if (frame.querySelector('.odv-thumb-content')) return
    const gen = generation
    let content: HTMLElement | undefined
    try {
      if (r.thumbnails) {
        const el = await r.thumbnails.render(i, { width })
        content = document.createElement('div')
        content.className = 'odv-thumb-content'
        content.appendChild(el)
      } else if (r.pages?.[i]) {
        const page = r.pages[i]!
        const hz = zoomOf(controller.host)
        content = cloneThumbnail(page, width, naturalSize(page, referenceSize(r.pages, hz), hz))
      }
    } catch {
      return
    }
    if (!content || gen !== generation || r !== result) return
    frame.style.aspectRatio = ''
    frame.replaceChildren(content)
  }

  function build(): void {
    generation++
    io?.disconnect()
    io = undefined
    container.replaceChildren()
    buttons = []
    result = controller.getResult()
    const pages = result?.pages ?? []
    const count = result?.thumbnails?.count ?? pages.length
    if (!result || count === 0) return

    const hz = zoomOf(controller.host)
    const reference = referenceSize(pages, hz)
    for (let i = 0; i < count; i++) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'odv-thumb'
      btn.dataset.odvPage = String(i + 1)
      btn.setAttribute('aria-label', label(i + 1))
      const frame = document.createElement('span')
      frame.className = 'odv-thumb-frame'
      frame.style.display = 'block'
      frame.style.width = `${width}px`
      const page = pages[i]
      const { width: w, height: h } = page ? naturalSize(page, reference, hz) : { width: 3, height: 4 }
      frame.style.aspectRatio = `${w} / ${h}`
      const text = document.createElement('span')
      text.className = 'odv-thumb-label'
      text.textContent = String(i + 1)
      btn.append(frame, text)
      btn.addEventListener('click', () => controller.goToPage(i + 1))
      container.appendChild(btn)
      buttons.push(btn)
    }
    markCurrent(controller.getPage())

    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const i = Number((e.target as HTMLElement).dataset.odvPage) - 1
            if (e.isIntersecting) void render(i)
            else discard(i)
          }
        },
        { root: container, rootMargin: '200% 0px' },
      )
      buttons.forEach((b) => io!.observe(b))
    } else {
      buttons.forEach((_b, i) => void render(i))
    }
  }

  function markCurrent(page: number): void {
    buttons.forEach((b, i) => {
      if (i + 1 === page) {
        b.setAttribute('aria-current', 'page')
        try {
          b.scrollIntoView({ block: 'nearest' })
        } catch {
          /* ignore */
        }
      } else b.removeAttribute('aria-current')
    })
  }

  let lastResult = controller.getResult()
  let lastPage = controller.getPage()
  const unsubscribe = controller.subscribe((s) => {
    const r = controller.getResult()
    if (r !== lastResult) {
      lastResult = r
      build()
    }
    if (s.page !== lastPage) {
      lastPage = s.page
      markCurrent(s.page)
    }
  })

  build()

  return {
    refresh: build,
    destroy() {
      unsubscribe()
      io?.disconnect()
      generation++
      container.replaceChildren()
      container.classList.remove('odv-thumbs')
    },
  }
}
