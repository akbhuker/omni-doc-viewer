import { useEffect, useRef, type ReactElement, type RefObject } from 'react'
import { createThumbnailStrip } from '../core/viewer/thumbnails'
import type { ViewerController } from '../core/viewer/types'

export interface ThumbnailsProps {
  controllerRef: RefObject<ViewerController | null>
  width?: number
  label: string
  pageLabel: (page: number) => string
}

/** Sidebar of page thumbnails driven by the viewer controller. */
export function Thumbnails({ controllerRef, width = 120, label, pageLabel }: ThumbnailsProps): ReactElement {
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = ref.current
    const controller = controllerRef.current
    if (!el || !controller) return
    const strip = createThumbnailStrip(controller, { container: el, width, label: pageLabel })
    return () => strip.destroy()
  }, [controllerRef, width, pageLabel])
  return <aside ref={ref} className="odv-thumbs" role="complementary" aria-label={label} style={{ width: width + 28 }} />
}
