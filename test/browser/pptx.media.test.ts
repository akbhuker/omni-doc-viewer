import { describe, it, expect, afterEach } from 'vitest'
import { renderDocument } from '../../src/core'
import type { RenderResult } from '../../src/core'
import imageUrl from '../fixtures/generated/image.pptx?url'

let result: RenderResult | undefined
let container: HTMLDivElement
afterEach(() => {
  result?.destroy()
  container?.remove()
})

describe('pptx media handling', () => {
  it('serves slide images as object URLs (no base64 inflation) and revokes them on destroy', async () => {
    container = document.createElement('div')
    container.style.width = '800px'
    document.body.appendChild(container)
    result = await renderDocument({ container, source: imageUrl })
    expect(result.meta.pageCount).toBe(1)
    const img = container.querySelector<HTMLImageElement>('.pptx-preview-slide-wrapper img')!
    expect(img).not.toBeNull()
    expect(img.src).toMatch(/^blob:/)
    await new Promise<void>((resolve, reject) => {
      if (img.complete && img.naturalWidth > 0) return resolve()
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image failed to load'))
    })
    expect(img.naturalWidth).toBe(2)

    const url = img.src
    result.destroy()
    result = undefined
    await expect(fetch(url)).rejects.toThrow()
  })
})
