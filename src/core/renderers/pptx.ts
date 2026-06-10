import { type Renderer } from '../types'

/**
 * PPTX rendering uses `pptx-preview` (pure front-end). Fidelity is good for
 * text, lists, basic shapes and images, but NOT a pixel-perfect PowerPoint:
 * animations, transitions, 3D, charts, SmartArt, OLE objects and speaker
 * notes are not reproduced. This is documented in the README's scope table.
 *
 * Two quirks of the engine we work around here:
 *  - it hardcodes a black (`#000`) wrapper background, and
 *  - it gives the wrapper a fixed viewport height with inner scrolling.
 * We neutralize both so all slides render stacked on a neutral backdrop —
 * otherwise the viewer looks like a "black screen".
 */
export const render: Renderer = async ({ container, bytes, options }) => {
  const { init }: any = await import('pptx-preview')

  const host = document.createElement('div')
  host.className = 'odv-pptx'
  host.style.width = '100%'
  host.style.display = 'flex'
  host.style.justifyContent = 'center'
  container.appendChild(host)

  // Measure the real available width (the container must be laid out, not
  // display:none — the React wrapper guarantees this). Fall back to 960.
  const measured = container.clientWidth || host.clientWidth
  const width = options.pptx?.width ?? (measured > 16 ? measured : 960)
  const height = options.pptx?.height ?? Math.round((width * 9) / 16)

  // Default mode renders every slide in normal flow (relative, white bg) —
  // exactly what a document viewer wants. Do NOT pass mode:'slide'.
  const previewer = init(host, { width, height })

  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  )
  await previewer.preview(arrayBuffer)

  // Undo the engine's black/fixed-height wrapper so all slides show stacked.
  const wrapper: HTMLElement | undefined = previewer.wrapper
  if (wrapper) {
    wrapper.style.setProperty('background', 'transparent', 'important')
    wrapper.style.setProperty('height', 'auto', 'important')
    wrapper.style.setProperty('overflow', 'visible', 'important')
    wrapper.style.setProperty('max-width', '100%')
  }

  const slideCount =
    typeof previewer.slideCount === 'number' ? previewer.slideCount : undefined

  return {
    type: 'pptx',
    meta: { type: 'pptx', pageCount: slideCount },
    destroy() {
      try {
        previewer.destroy?.()
      } catch {
        /* ignore */
      }
      container.replaceChildren()
    },
  }
}
