import { type Renderer } from '../types'
import { decodeText } from './text'

/**
 * HTML files are shown in a fully sandboxed iframe (no scripts, no
 * same-origin access, no navigation) and, by default, sanitized with
 * DOMPurify first so that even the markup is inert.
 */
export const render: Renderer = async ({ container, bytes, options, warn }) => {
  let html = decodeText(bytes)
  if (options.html?.sanitize !== false) {
    try {
      const DOMPurify = (await import('dompurify')).default
      if (!DOMPurify.isSupported) throw new Error('DOMPurify is not supported in this environment')
      html = DOMPurify.sanitize(html, {
        WHOLE_DOCUMENT: true,
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select'],
        FORBID_ATTR: ['srcdoc', 'formaction'],
      })
    } catch {
      warn({ code: 'html/unsanitized', message: 'DOMPurify could not be loaded; relying on the iframe sandbox only.' })
    }
  }

  const iframe = document.createElement('iframe')
  iframe.className = 'odv-html'
  iframe.setAttribute('sandbox', '') // no scripts, no same-origin, no forms, no popups
  iframe.setAttribute('referrerpolicy', 'no-referrer')
  iframe.setAttribute('title', 'HTML document')
  iframe.setAttribute('srcdoc', html)
  iframe.style.width = '100%'
  iframe.style.height = options.html?.height ?? '80vh'
  iframe.style.border = '0'
  iframe.style.background = '#fff'
  container.appendChild(iframe)

  return {
    type: 'html',
    meta: { type: 'html', pageCount: 1 },
    destroy() {
      container.replaceChildren()
    },
  }
}
