import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { inspectPptx } from '../../src/core/renderers/pptx/inspect'
import * as mutate from '../helpers/pptx-mutations'

const sample = readFileSync('demo/public/samples/sample.pptx')

async function load(mutation?: (zip: JSZip) => Promise<void>): Promise<JSZip> {
  const zip = await JSZip.loadAsync(sample)
  if (mutation) await mutation(zip)
  return zip
}

describe('inspectPptx', () => {
  it('describes a healthy deck: slide parts, order, size, producer, no problems', async () => {
    const info = await inspectPptx(await load())
    expect(info.slideParts).toEqual(['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml'])
    expect(info.slideOrder).toEqual(['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml'])
    expect(info.slideSize).toEqual({ cx: 12192000, cy: 6858000 })
    expect(info.producer).toBe('Microsoft Office PowerPoint') // what pptxgenjs stamps into app.xml
    expect(info.hiddenSlides).toEqual([])
    expect(info.missingParts).toEqual([])
    expect(info.problems).toEqual([])
  })

  it('accepts raw bytes as well as a JSZip instance', async () => {
    const info = await inspectPptx(new Uint8Array(sample))
    expect(info.slideOrder).toHaveLength(2)
  })

  it('flags Overrides that point at parts missing from the zip', async () => {
    const info = await inspectPptx(await load(mutate.phantomOverride))
    expect(info.missingParts).toEqual(['ppt/slideMasters/slideMaster2.xml'])
    expect(info.problems).toContain('missing-parts')
  })

  it('detects decks that declare slides only via <Default Extension="xml">', async () => {
    const info = await inspectPptx(await load(mutate.defaultOnlyContentTypes))
    expect(info.slideParts).toEqual([])
    expect(info.slideOrder).toHaveLength(2)
    expect(info.problems).toContain('missing-overrides')
  })

  it('lists hidden slides', async () => {
    const info = await inspectPptx(await load((z) => mutate.hideSlide(z, 2)))
    expect(info.hiddenSlides).toEqual(['ppt/slides/slide2.xml'])
  })

  it('follows sldIdLst order rather than file-name order', async () => {
    const info = await inspectPptx(await load(mutate.reverseSlideOrder))
    expect(info.slideOrder).toEqual(['ppt/slides/slide2.xml', 'ppt/slides/slide1.xml'])
  })

  it('flags a namespace-prefixed Content_Types root', async () => {
    const info = await inspectPptx(await load(mutate.prefixContentTypesRoot))
    expect(info.prefixedRoot).toBe(true)
    expect(info.problems).toContain('prefixed-root')
  })

  it('flags a missing slide size', async () => {
    const info = await inspectPptx(await load(mutate.dropSlideSize))
    expect(info.slideSize).toBeUndefined()
    expect(info.problems).toContain('missing-slide-size')
  })

  it('flags a BOM on Content_Types', async () => {
    const info = await inspectPptx(await load(mutate.addBom))
    expect(info.problems).toContain('bom')
  })
})
