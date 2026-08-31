import { getInjectedCss, getStyleNonce } from '../styles'
import { resolveDocumentUrl, type DocumentBlobInput } from './download'

export interface PrintInput extends DocumentBlobInput {
  /** Element containing the rendered document (non-PDF formats). */
  host: HTMLElement | null
  /** Page elements, so hidden (paged-mode) pages can be included. */
  pages?: HTMLElement[]
  /** CSP nonce for the stylesheet injected into the print frame. */
  nonce?: string
}

/**
 * Print the document. PDFs are printed from the original bytes via the
 * browser's PDF viewer in a hidden iframe (same-origin Blob URL, so
 * `contentWindow.print()` is allowed); other formats print their rendered DOM.
 * `@page { margin: 0 }` suppresses the browser's date/URL header and footer.
 */
export function printDocument(input: PrintInput): void {
  if (input.type === 'pdf') {
    const { url, release } = resolveDocumentUrl(input)
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    iframe.src = url
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch {
        /* blocked print — nothing else we can do */
      }
      setTimeout(() => {
        iframe.remove()
        release()
      }, 60_000)
    }
    document.body.appendChild(iframe)
    return
  }

  const { host, pages = [] } = input
  if (!host) return

  // In paged mode the non-current pages are `display:none` in the live view —
  // reveal them just long enough to snapshot the HTML so PRINT gets every page,
  // then restore. Reading innerHTML is synchronous, so there's no visible flash.
  const hidden = pages.filter((el) => el.style.display === 'none')
  hidden.forEach((el) => (el.style.display = ''))
  const content = host.innerHTML
  // Largest natural (zoom-independent) page width, so we can scale to fit paper.
  const dpr = window.devicePixelRatio || 1
  let naturalW = 0
  for (const el of pages.length ? pages : [host]) {
    const c = el.querySelector?.('canvas') as HTMLCanvasElement | null
    const i = el.querySelector?.('img') as HTMLImageElement | null
    const w =
      (c && c.width / dpr) ||
      (el.style?.width && parseFloat(el.style.width)) ||
      (i && i.naturalWidth) ||
      el.getBoundingClientRect().width
    naturalW = Math.max(naturalW, w || 0)
  }
  hidden.forEach((el) => (el.style.display = 'none'))

  // Fit the widest page into the printable width (~A4 portrait minus margins).
  const fit = naturalW > 0 ? Math.min(1, 680 / naturalW) : 1

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(iframe)
  const cw = iframe.contentWindow
  if (!cw) {
    iframe.remove()
    return
  }
  const styles = getInjectedCss()
  const nonce = input.nonce ?? getStyleNonce()
  const nonceAttr = nonce ? ` nonce="${nonce}"` : ''
  cw.document.open()
  cw.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><style${nonceAttr}>${styles}\n` +
      // `@page{margin:0}` makes the browser drop its default header/footer
      // (date, URL, page number); body padding restores readable margins.
      `@page{margin:0}html,body{margin:0}` +
      `body{padding:12mm;font-family:Arial,Helvetica,system-ui,sans-serif}` +
      // Print background colors/images (slides, highlights) — browsers omit
      // them by default.
      `*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}` +
      // `zoom` (not transform) so layout reflows and page breaks stay correct.
      `.odv-print{zoom:${fit}}.odv-print .odv-pptx{display:block}` +
      `.odv-print .pptx-preview-slide-wrapper{break-inside:avoid;page-break-inside:avoid}` +
      `</style></head><body><div class="odv-print">${content}</div></body></html>`,
  )
  cw.document.close()
  const cleanup = () => setTimeout(() => iframe.remove(), 1000)
  let printed = false
  const fire = () => {
    if (printed) return
    printed = true
    try {
      cw.focus()
      cw.print()
    } catch {
      /* ignore */
    }
    cleanup()
  }
  cw.onafterprint = () => iframe.remove()
  iframe.onload = fire
  // Fallback in case `load` already fired before the handler was attached.
  setTimeout(fire, 700)
}
