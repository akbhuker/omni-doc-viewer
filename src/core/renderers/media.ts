import { type Renderer } from '../types'

const VIDEO_MIME: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg' }
const AUDIO_MIME: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/ogg' }

/** Video and audio via the browser's native players, from a Blob URL. */
export const render: Renderer = async ({ container, bytes, type: docType, filename, mime }) => {
  const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? ''
  const isVideo = docType === 'video' || (docType !== 'audio' && (ext in VIDEO_MIME || !!mime?.startsWith('video/')))
  const type = mime ?? (isVideo ? VIDEO_MIME[ext] ?? 'video/mp4' : AUDIO_MIME[ext] ?? 'audio/mpeg')
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type }))

  const wrapper = document.createElement('div')
  wrapper.className = isVideo ? 'odv-video' : 'odv-audio'
  wrapper.style.display = 'flex'
  wrapper.style.justifyContent = 'center'
  wrapper.style.padding = '12px'

  const el = document.createElement(isVideo ? 'video' : 'audio')
  el.className = isVideo ? 'odv-video-el' : 'odv-audio-el'
  el.setAttribute('controls', '')
  if (isVideo) {
    el.setAttribute('playsinline', '')
    el.style.maxWidth = '100%'
    el.style.maxHeight = '80vh'
    el.style.background = '#000'
  } else {
    el.style.width = '100%'
    el.style.maxWidth = '640px'
  }
  el.setAttribute('src', url)
  el.setAttribute('aria-label', filename ?? (isVideo ? 'Video' : 'Audio'))
  wrapper.appendChild(el)
  container.appendChild(wrapper)

  return {
    type: isVideo ? 'video' : 'audio',
    meta: { type: isVideo ? 'video' : 'audio', pageCount: 1 },
    destroy() {
      try {
        ;(el as HTMLMediaElement).pause?.()
      } catch {
        /* ignore */
      }
      el.removeAttribute('src')
      URL.revokeObjectURL(url)
      container.replaceChildren()
    },
  }
}
