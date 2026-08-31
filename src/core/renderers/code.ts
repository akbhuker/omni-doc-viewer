import { type Renderer } from '../types'
import { decodeText } from './text'
import { ensureStyles } from '../styles'
import { createDomSearchProvider } from '../search/dom'

const CODE_CSS = `
.odv-code{margin:0;padding:16px 0;overflow:auto;color:var(--odv-fg,#1d1d1f);background:var(--odv-surface,#fff);
  font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;tab-size:4}
.odv-code-line{display:flex;min-height:1.6em}
.odv-code-ln{flex:0 0 auto;width:4.5ch;margin-right:1.5ch;padding-right:1ch;text-align:right;color:var(--odv-fg-muted,#9a9aa0);
  border-right:1px solid var(--odv-border,#ececef);user-select:none}
.odv-code-text{flex:1 1 auto;white-space:pre;padding-right:16px}
.odv-code.is-wrapped .odv-code-text{white-space:pre-wrap;word-break:break-word}
`

/** Language tag from the filename extension (used as `data-language`). */
export function languageOf(filename: string | undefined, type: string): string {
  if (type === 'json') return 'json'
  const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? ''
  return ext || 'text'
}

/**
 * Source code / JSON / XML / YAML with line numbers. JSON is pretty-printed
 * when it parses; otherwise (or for other languages) the text is shown as-is.
 */
export const render: Renderer = async ({ container, bytes, type: docType, filename }) => {
  let text = decodeText(bytes)
  const isJson = docType === 'json' || (docType !== 'code' && /\.(json|jsonl|geojson)$/i.test(filename ?? ''))
  const type = isJson ? 'json' : 'code'
  if (isJson) {
    try {
      text = JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      /* not valid JSON: show raw */
    }
  }
  ensureStyles('odv-code-styles', CODE_CSS)

  const pre = document.createElement('pre')
  pre.className = 'odv-code'
  pre.setAttribute('data-language', languageOf(filename, type))
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  const frag = document.createDocumentFragment()
  lines.forEach((line, i) => {
    const row = document.createElement('div')
    row.className = 'odv-code-line'
    const ln = document.createElement('span')
    ln.className = 'odv-code-ln'
    ln.textContent = String(i + 1)
    const code = document.createElement('span')
    code.className = 'odv-code-text'
    code.textContent = line
    row.append(ln, code)
    frag.appendChild(row)
  })
  pre.appendChild(frag)
  container.appendChild(pre)

  return {
    type,
    meta: { type, pageCount: 1 },
    search: createDomSearchProvider({ root: pre, skip: (el) => el.classList.contains('odv-code-ln') }),
    destroy() {
      container.replaceChildren()
    },
  }
}
