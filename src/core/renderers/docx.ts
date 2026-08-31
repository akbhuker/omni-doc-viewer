import { type Renderer } from '../types'
import { createDomSearchProvider } from '../search/dom'
import { ensureStyles } from '../styles'

/**
 * docx-preview ships a grey, padded wrapper meant for standalone use; inside
 * our stage it shows as a grey band and its pages lack our page styling.
 */
const DOCX_CSS = `
.odv-docx .odv-docx-content-wrapper,.odv-docx .docx-wrapper{background:transparent!important;padding:0!important;
  display:flex;flex-flow:column;align-items:center;gap:14px}
.odv-docx .odv-docx-content-wrapper>section,.odv-docx .docx-wrapper>section{margin-bottom:0!important;
  background:var(--odv-page-bg,#fff)!important;box-shadow:var(--odv-page-shadow,0 1px 4px rgba(0,0,0,.18))!important;
  flex:0 0 auto;max-width:100%;box-sizing:border-box}
`

export const render: Renderer = async ({ container, bytes, options }) => {
  const { renderAsync }: any = await import('docx-preview')

  ensureStyles('odv-docx-styles', DOCX_CSS)
  const wrapper = document.createElement('div')
  wrapper.className = 'odv-docx'
  container.appendChild(wrapper)

  // docx-preview parses the OOXML and emits semantic HTML with paged layout.
  await renderAsync(bytes, wrapper, undefined, {
    className: 'odv-docx-content',
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    breakPages: true,
    experimental: true,
    useBase64URL: true,
    // Consumer overrides (headers/footers/comments/changes/page breaks…).
    ...options.docx,
  })

  // With breakPages, docx-preview emits one <section> per laid-out page.
  // These are our navigable "pages"; fall back to the whole wrapper if the
  // document didn't paginate (e.g. a single continuous section).
  const sections = Array.from(
    wrapper.querySelectorAll<HTMLElement>('section'),
  )
  const pages = sections.length > 0 ? sections : [wrapper]

  return {
    type: 'docx',
    meta: { type: 'docx', pageCount: pages.length },
    pages,
    search: createDomSearchProvider({ root: wrapper, pages }),
    destroy() {
      container.replaceChildren()
    },
  }
}
