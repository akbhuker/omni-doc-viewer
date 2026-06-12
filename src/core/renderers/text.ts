import { type Renderer } from '../types'

/** Decode bytes as UTF-8, tolerating a BOM and invalid sequences. */
export function decodeText(bytes: Uint8Array): string {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * Render a plain-text document inside a `<pre>` — selectable, copyable and
 * searchable, with soft wrapping so long lines don't force horizontal scroll.
 */
export const render: Renderer = async ({ container, bytes }) => {
  const pre = document.createElement('pre')
  pre.className = 'odv-text'
  pre.textContent = decodeText(bytes)
  pre.style.margin = '0'
  pre.style.padding = '16px 18px'
  pre.style.whiteSpace = 'pre-wrap'
  pre.style.wordBreak = 'break-word'
  pre.style.fontFamily =
    'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
  pre.style.fontSize = '13px'
  pre.style.lineHeight = '1.6'
  pre.style.color = '#1d1d1f'
  pre.style.tabSize = '4'
  container.appendChild(pre)

  return {
    type: 'text',
    meta: { type: 'text' },
    destroy() {
      container.replaceChildren()
    },
  }
}
