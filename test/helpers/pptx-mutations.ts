/**
 * JSZip-based mutations that reproduce real-world PPTX structures which make
 * `pptx-preview` silently render 0 slides (issue #7). Each takes a loaded zip
 * and edits it in place. Environment-agnostic (Node + browser).
 */
import type JSZip from 'jszip'

const CT = '[Content_Types].xml'

export async function text(zip: JSZip, path: string): Promise<string> {
  const f = zip.file(path)
  if (!f) throw new Error(`missing ${path}`)
  return f.async('string')
}

/** Add an Override for a part that doesn't exist (pptxgenjs' phantom slideMaster2). */
export async function phantomOverride(zip: JSZip): Promise<void> {
  const ct = await text(zip, CT)
  zip.file(
    CT,
    ct.replace(
      '</Types>',
      '<Override PartName="/ppt/slideMasters/slideMaster2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/></Types>',
    ),
  )
}

/** Declare every .xml part only through <Default Extension="xml"> — no per-part Overrides. */
export async function defaultOnlyContentTypes(zip: JSZip): Promise<void> {
  const ct = await text(zip, CT)
  const stripped = ct.replace(/<Override\b[^>]*ContentType="application\/vnd\.openxmlformats-officedocument\.presentationml\.[^"]*"[^>]*\/>/g, '')
  const withDefault = stripped.includes('Extension="xml"')
    ? stripped
    : stripped.replace('<Types', '<Types').replace('>', '><Default Extension="xml" ContentType="application/xml"/>')
  zip.file(CT, withDefault)
}

/** Mark slide N (1-based) hidden. */
export async function hideSlide(zip: JSZip, n: number): Promise<void> {
  const path = `ppt/slides/slide${n}.xml`
  const xml = await text(zip, path)
  zip.file(path, xml.replace(/<p:sld\b([^>]*)>/, (m, attrs: string) => (/\bshow=/.test(attrs) ? m : `<p:sld${attrs} show="0">`)))
}

/** Reverse the order of slides in presentation.xml's sldIdLst. */
export async function reverseSlideOrder(zip: JSZip): Promise<void> {
  const path = 'ppt/presentation.xml'
  const xml = await text(zip, path)
  zip.file(
    path,
    xml.replace(/<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/, (_m, inner: string) => {
      const ids = inner.match(/<p:sldId\b[^>]*\/>/g) ?? []
      return `<p:sldIdLst>${ids.reverse().join('')}</p:sldIdLst>`
    }),
  )
}

/** Namespace-prefix the Content_Types root (<ct:Types>), which some producers emit. */
export async function prefixContentTypesRoot(zip: JSZip): Promise<void> {
  const ct = await text(zip, CT)
  zip.file(
    CT,
    ct
      .replace('<Types xmlns="', '<ct:Types xmlns:ct="')
      .replace('</Types>', '</ct:Types>')
      .replace(/<Default\b/g, '<ct:Default')
      .replace(/<Override\b/g, '<ct:Override'),
  )
}

/** Remove the slide size from presentation.xml. */
export async function dropSlideSize(zip: JSZip): Promise<void> {
  const path = 'ppt/presentation.xml'
  const xml = await text(zip, path)
  zip.file(path, xml.replace(/<p:sldSz\b[^>]*\/>/, ''))
}

/** Prefix Content_Types with a UTF-8 BOM. */
export async function addBom(zip: JSZip): Promise<void> {
  const ct = await text(zip, CT)
  zip.file(CT, '﻿' + ct)
}

/** Keep only the first slide's Override (drops theme/master/layout/presentation overrides). */
export async function singleOverride(zip: JSZip): Promise<void> {
  const ct = await text(zip, CT)
  const overrides = ct.match(/<Override\b[^>]*\/>/g) ?? []
  const keep = overrides.find((o) => o.includes('/ppt/slides/slide1.xml'))
  if (!keep) throw new Error('slide1 override not found')
  const withoutOverrides = ct.replace(/<Override\b[^>]*\/>/g, '')
  zip.file(CT, withoutOverrides.replace('</Types>', keep + '</Types>'))
}
