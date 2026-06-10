import { type Renderer } from '../types'

export const render: Renderer = async ({ container, bytes }) => {
  const { renderAsync }: any = await import('docx-preview')

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
  })

  return {
    type: 'docx',
    meta: { type: 'docx' },
    destroy() {
      container.replaceChildren()
    },
  }
}
