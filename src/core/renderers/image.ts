import { type Renderer } from '../types'

/** Sniff an image MIME type from the leading bytes (falls back to PNG). */
function imageMime(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif'
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp'
  if (bytes[0] === 0x00 && bytes[1] === 0x00) return 'image/x-icon'
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp' // RIFF…WEBP
  // ftyp…avif
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70)
    return 'image/avif'
  // Text-ish → assume SVG.
  if (bytes[0] === 0x3c || bytes[0] === 0xef) return 'image/svg+xml'
  return 'image/png'
}

/**
 * Render a raster or vector image. The bytes are wrapped in a Blob URL (so even
 * large images aren't base64-inflated) and shown centered, scaled to fit.
 */
export const render: Renderer = async ({ container, bytes }) => {
  const blob = new Blob([bytes.slice()], { type: imageMime(bytes) })
  const url = URL.createObjectURL(blob)

  const wrapper = document.createElement('div')
  wrapper.className = 'odv-image'
  wrapper.style.display = 'flex'
  wrapper.style.justifyContent = 'center'
  wrapper.style.alignItems = 'flex-start'
  wrapper.style.padding = '12px'

  const img = document.createElement('img')
  img.className = 'odv-image-img'
  img.src = url
  img.alt = 'Image document'
  img.style.maxWidth = '100%'
  img.style.height = 'auto'
  img.style.boxShadow = '0 1px 4px rgba(0,0,0,0.18)'
  wrapper.appendChild(img)
  container.appendChild(wrapper)

  return {
    type: 'image',
    meta: { type: 'image', pageCount: 1 },
    pages: [img],
    destroy() {
      URL.revokeObjectURL(url)
      container.replaceChildren()
    },
  }
}
