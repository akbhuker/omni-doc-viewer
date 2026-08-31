/**
 * Issue #7 regression matrix: decks with structures that make pptx-preview
 * silently produce 0 slides must either render (after our repair) or fail with
 * a structured RenderError — never a silent `pageCount: 0`.
 */
import { describe, it, expect, afterEach } from 'vitest'
import JSZip from 'jszip'
import { renderDocument, RenderError } from '../../src/core'
import type { RenderResult, RenderWarning } from '../../src/core'
import * as mutate from '../helpers/pptx-mutations'
import sampleUrl from '../../demo/public/samples/sample.pptx?url'

let result: RenderResult | undefined
let container: HTMLDivElement

afterEach(() => {
  result?.destroy()
  result = undefined
  container?.remove()
})

async function deck(mutation?: (zip: JSZip) => Promise<void>): Promise<Uint8Array> {
  const bytes = new Uint8Array(await (await fetch(sampleUrl)).arrayBuffer())
  const zip = await JSZip.loadAsync(bytes)
  if (mutation) await mutation(zip)
  return new Uint8Array(await zip.generateAsync({ type: 'arraybuffer' }))
}

async function render(bytes: Uint8Array, warnings: RenderWarning[] = []) {
  container = document.createElement('div')
  container.style.width = '800px'
  document.body.appendChild(container)
  result = await renderDocument({ container, source: bytes, type: 'pptx', onWarning: (w) => warnings.push(w) })
  return result
}

const slideTexts = () =>
  Array.from(container.querySelectorAll('.pptx-preview-slide-wrapper')).map((el) => el.textContent?.trim().slice(0, 15))

describe('pptx: decks that used to render 0 slides (#7)', () => {
  it('phantom Override for a missing part → repaired, 2 slides, warning reported', async () => {
    const warnings: RenderWarning[] = []
    const r = await render(await deck(mutate.phantomOverride), warnings)
    expect(r.meta.pageCount).toBe(2)
    expect(warnings.map((w) => w.code)).toContain('pptx/removed-phantom-overrides')
  })

  it('slides declared only via <Default Extension="xml"> → repaired, 2 slides', async () => {
    const r = await render(await deck(mutate.defaultOnlyContentTypes))
    expect(r.meta.pageCount).toBe(2)
  })

  it('namespace-prefixed <ct:Types> root → repaired, 2 slides', async () => {
    const r = await render(await deck(mutate.prefixContentTypesRoot))
    expect(r.meta.pageCount).toBe(2)
  })

  it('missing slide size → default size injected, slides visible', async () => {
    const r = await render(await deck(mutate.dropSlideSize))
    expect(r.meta.pageCount).toBe(2)
    const first = container.querySelector<HTMLElement>('.pptx-preview-slide-wrapper')!
    expect(first.getBoundingClientRect().width).toBeGreaterThan(100)
  })

  it('BOM before Content_Types → 2 slides', async () => {
    const r = await render(await deck(mutate.addBom))
    expect(r.meta.pageCount).toBe(2)
  })

  it('a single Override → 2 slides', async () => {
    const r = await render(await deck(mutate.singleOverride))
    expect(r.meta.pageCount).toBe(2)
  })

  it('renders slides in sldIdLst order, not file-name order', async () => {
    const r = await render(await deck(mutate.reverseSlideOrder))
    expect(r.meta.pageCount).toBe(2)
    const texts = slideTexts()
    expect(texts[0]).toMatch(/Supported/)
    expect(texts[1]).toMatch(/omni-doc-viewer/)
    expect(r.pages?.[0]).toBe(container.querySelector('.pptx-preview-slide-wrapper'))
  })

  it('hides slides marked hidden unless pptx.showHiddenSlides is set', async () => {
    const bytes = await deck((z) => mutate.hideSlide(z, 2))
    const r = await render(bytes)
    expect(r.meta.pageCount).toBe(1)
    expect(container.querySelectorAll('.pptx-preview-slide-wrapper')).toHaveLength(1)
    r.destroy()
    container.remove()

    container = document.createElement('div')
    container.style.width = '800px'
    document.body.appendChild(container)
    result = await renderDocument({ container, source: bytes, type: 'pptx', pptx: { showHiddenSlides: true } })
    expect(result.meta.pageCount).toBe(2)
  })

  it('never reports success with 0 slides: an unrepairable deck throws RenderError(PPTX_NO_SLIDES) with the inspection attached', async () => {
    // Remove every slide part but keep the presentation's references to them.
    const bytes = await deck(async (zip) => {
      zip.remove('ppt/slides/slide1.xml')
      zip.remove('ppt/slides/slide2.xml')
      zip.remove('ppt/slides/_rels/slide1.xml.rels')
      zip.remove('ppt/slides/_rels/slide2.xml.rels')
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    const err = await renderDocument({ container, source: bytes, type: 'pptx' }).catch((e) => e)
    expect(err).toBeInstanceOf(RenderError)
    expect(err.code).toBe('PPTX_NO_SLIDES')
    expect(err.format).toBe('pptx')
    expect(err.details?.inspection?.slideOrder).toHaveLength(2)
  })
})
