import { type Renderer } from '../types'
import { createDomSearchProvider } from '../search/dom'
import { decodeText } from './text'
import { ensureStyles } from '../styles'

/**
 * Render Markdown to HTML. `marked` and `dompurify` are imported lazily, so a
 * consumer who never opens a Markdown file ships neither.
 *
 * SECURITY: the file is untrusted input, so the generated HTML is run through
 * DOMPurify before it touches the DOM — this strips `<script>`, inline event
 * handlers, `javascript:` URLs, etc., preventing XSS from a malicious document.
 */
export const render: Renderer = async ({ container, bytes }) => {
  const source = decodeText(bytes)

  const article = document.createElement('article')
  article.className = 'odv-markdown'
  injectMarkdownStyles()

  try {
    const { marked } = await import('marked')
    const DOMPurify = (await import('dompurify')).default
    const rawHtml = await marked.parse(source, { gfm: true, breaks: false })
    article.innerHTML = DOMPurify.sanitize(rawHtml)
  } catch {
    // If parsing/sanitizing is unavailable, fall back to readable plain text.
    const pre = document.createElement('pre')
    pre.style.whiteSpace = 'pre-wrap'
    pre.textContent = source
    article.replaceChildren(pre)
  }

  container.appendChild(article)

  return {
    type: 'markdown',
    meta: { type: 'markdown' },
    search: createDomSearchProvider({ root: article }),
    destroy() {
      container.replaceChildren()
    },
  }
}

const MARKDOWN_CSS = `
.odv-markdown{max-width:820px;margin:0 auto;padding:24px 28px;
  font:15px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:var(--odv-fg,#1f2328);word-wrap:break-word}
.odv-markdown h1,.odv-markdown h2,.odv-markdown h3,.odv-markdown h4{
  margin:1.4em 0 .6em;font-weight:650;line-height:1.25}
.odv-markdown h1{font-size:1.9em;padding-bottom:.3em;border-bottom:1px solid var(--odv-border,#e2e5ea)}
.odv-markdown h2{font-size:1.5em;padding-bottom:.3em;border-bottom:1px solid var(--odv-border,#e2e5ea)}
.odv-markdown h3{font-size:1.25em}
.odv-markdown p,.odv-markdown ul,.odv-markdown ol,.odv-markdown blockquote{margin:0 0 1em}
.odv-markdown a{color:var(--odv-accent,#2257d6);text-decoration:none}
.odv-markdown a:hover{text-decoration:underline}
.odv-markdown code{background:var(--odv-surface-alt,#f1f3f6);border-radius:5px;padding:.15em .4em;font-size:.88em;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.odv-markdown pre{background:var(--odv-surface-alt,#f6f8fa);border:1px solid var(--odv-border,#e2e5ea);border-radius:8px;padding:14px 16px;
  overflow:auto}
.odv-markdown pre code{background:none;padding:0}
.odv-markdown blockquote{padding:0 1em;color:var(--odv-fg-muted,#57606a);border-left:.25em solid var(--odv-border,#d0d7de)}
.odv-markdown img{max-width:100%}
.odv-markdown table{border-collapse:collapse;margin:0 0 1em;display:block;overflow:auto}
.odv-markdown th,.odv-markdown td{border:1px solid var(--odv-border,#d0d7de);padding:6px 13px}
.odv-markdown th{background:var(--odv-surface-alt,#f6f8fa);font-weight:600}
.odv-markdown hr{height:1px;background:var(--odv-border,#e2e5ea);border:0;margin:1.5em 0}
`

function injectMarkdownStyles(): void {
  ensureStyles('odv-markdown-styles', MARKDOWN_CSS)
}
