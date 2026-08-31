export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
export const ZOOM_STEP = 0.2

/** Clamp a zoom factor to the supported range (2 decimals). */
export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +z.toFixed(2)))
}
