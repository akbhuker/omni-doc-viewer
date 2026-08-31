import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { inspectPptx } from '../../src/core/renderers/pptx/inspect'
import { sanitizePptx } from '../../src/core/renderers/pptx/sanitize'
import * as mutate from '../helpers/pptx-mutations'

const sample = readFileSync('demo/public/samples/sample.pptx')

async function prepare(mutation?: (zip: JSZip) => Promise<void>) {
  const zip = await JSZip.loadAsync(sample)
  if (mutation) await mutation(zip)
  const before = await inspectPptx(zip)
  const result = await sanitizePptx(zip, before)
  const after = await inspectPptx(zip)
  return { zip, before, result, after }
}

describe('sanitizePptx', () => {
  it('leaves a healthy deck untouched', async () => {
    const { result, after } = await prepare()
    expect(result.changed).toBe(false)
    expect(result.warnings).toEqual([])
    expect(after.problems).toEqual([])
  })

  it('removes Overrides for parts that are not in the zip', async () => {
    const { result, after } = await prepare(mutate.phantomOverride)
    expect(result.changed).toBe(true)
    expect(result.warnings.map((w) => w.code)).toContain('pptx/removed-phantom-overrides')
    expect(after.missingParts).toEqual([])
  })

  it('adds Overrides for slides, layouts, masters, themes and the presentation when only Defaults exist', async () => {
    const { result, after, zip } = await prepare(mutate.defaultOnlyContentTypes)
    expect(result.warnings.map((w) => w.code)).toContain('pptx/added-overrides')
    expect(after.slideParts).toEqual(after.slideOrder)
    const ct = await zip.file('[Content_Types].xml')!.async('string')
    expect(ct).toMatch(/PartName="\/ppt\/slideMasters\/slideMaster1\.xml"/)
    expect(ct).toMatch(/PartName="\/ppt\/slideLayouts\/slideLayout1\.xml"/)
    expect(ct).toMatch(/PartName="\/ppt\/theme\/theme1\.xml"/)
    expect(ct).toMatch(/PartName="\/ppt\/presentation\.xml"/)
    expect(after.problems).not.toContain('missing-overrides')
  })

  it('restores a plain <Types> root when the producer prefixed it', async () => {
    const { after, result } = await prepare(mutate.prefixContentTypesRoot)
    expect(result.warnings.map((w) => w.code)).toContain('pptx/normalized-content-types')
    expect(after.prefixedRoot).toBe(false)
    expect(after.slideParts).toHaveLength(2)
  })

  it('injects a default 16:9 slide size when presentation.xml has none', async () => {
    const { after, result } = await prepare(mutate.dropSlideSize)
    expect(result.warnings.map((w) => w.code)).toContain('pptx/injected-slide-size')
    expect(after.slideSize).toEqual({ cx: 12192000, cy: 6858000 })
  })

  it('strips a UTF-8 BOM from Content_Types', async () => {
    const { after, result } = await prepare(mutate.addBom)
    expect(result.warnings.map((w) => w.code)).toContain('pptx/stripped-bom')
    expect(after.problems).not.toContain('bom')
  })

  it('re-adds the standard Overrides when a deck declares a single Override', async () => {
    const { after } = await prepare(mutate.singleOverride)
    expect(after.slideParts).toHaveLength(2)
    expect(after.problems).toEqual([])
  })
})
