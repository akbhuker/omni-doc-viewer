/**
 * Programmatic document builders shared by `scripts/make-samples.mjs` (demo
 * samples) and `scripts/make-fixtures.mjs` (test fixtures). Everything is
 * generated — no hand-made binaries are checked in — so files are
 * reproducible and inspectable, and every renderer gets exercised.
 */
import JSZip from 'jszip'
import * as XLSX from '@e965/xlsx'
import PptxGenJS from 'pptxgenjs'

// ---------------------------------------------------------------------------
// PDF — hand-crafted minimal 1-page PDF (no dependency). pdf.js renders it.
// ---------------------------------------------------------------------------
export function makePdf() {
  const lines = [
    'BT',
    '/F1 24 Tf',
    '72 720 Td',
    '(omni-doc-viewer) Tj',
    '0 -36 Td',
    '/F1 14 Tf',
    '(A sample PDF rendered 100% client-side.) Tj',
    '0 -22 Td',
    '(No server. No Microsoft iframe. No API keys.) Tj',
    'ET',
  ].join('\n')

  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${lines.length} >>\nstream\n${lines}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let body = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xrefStart = body.length
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) {
    body += `${String(off).padStart(10, '0')} 00000 n \n`
  }
  body +=
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF`
  return Buffer.from(body, 'latin1')
}

// ---------------------------------------------------------------------------
// XLSX — SheetJS, two sheets.
// ---------------------------------------------------------------------------
export function makeXlsx() {
  const wb = XLSX.utils.book_new()
  // Store a cached value alongside the formula so the HTML preview (which shows
  // the cached value, not a computed one) still displays the total.
  const rows = [
    ['North', 120, 150, 170, 200],
    ['South', 90, 110, 130, 160],
    ['East', 60, 80, 95, 120],
    ['West', 140, 130, 160, 190],
  ]
  const sales = XLSX.utils.aoa_to_sheet([
    ['Region', 'Q1', 'Q2', 'Q3', 'Q4', 'Total'],
    ...rows.map((r, i) => {
      const nums = r.slice(1)
      const row = i + 2
      return [r[0], ...nums, { t: 'n', f: `SUM(B${row}:E${row})`, v: nums.reduce((a, b) => a + b, 0) }]
    }),
  ])
  XLSX.utils.book_append_sheet(wb, sales, 'Sales')

  const team = XLSX.utils.aoa_to_sheet([
    ['Name', 'Role', 'Start'],
    ['Ada', 'Engineer', '2021-03-01'],
    ['Linus', 'Maintainer', '2019-08-15'],
    ['Grace', 'Architect', '2020-01-10'],
  ])
  XLSX.utils.book_append_sheet(wb, team, 'Team')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

// ---------------------------------------------------------------------------
// DOCX — minimal valid OOXML built with JSZip. docx-preview renders it.
// ---------------------------------------------------------------------------
export async function makeDocx() {
  const zip = new JSZip()

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  )

  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  )

  const para = (text, opts = {}) => {
    const { bold, size, heading } = opts
    const rPr =
      bold || size
        ? `<w:rPr>${bold ? '<w:b/>' : ''}${size ? `<w:sz w:val="${size}"/>` : ''}</w:rPr>`
        : ''
    const pPr = heading ? `<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>` : ''
    return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
  }

  zip.folder('word').file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${para('omni-doc-viewer', { bold: true, size: 48 })}
    ${para('A sample Word document rendered entirely in the browser.', { size: 28 })}
    ${para('')}
    ${para('It supports headings, bold text, and paragraphs — parsed from the', { size: 22 })}
    ${para('OOXML and turned into semantic HTML by docx-preview. No server, no', { size: 22 })}
    ${para('Microsoft Office Online iframe, and no public URL required.', { size: 22 })}
    ${para('')}
    ${para('Drop your own .docx onto the demo to try it.', { bold: true, size: 22 })}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`,
  )

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

// ---------------------------------------------------------------------------
// PPTX — pptxgenjs produces a complete, valid presentation.
// ---------------------------------------------------------------------------
export async function makePptx() {
  const pptx = new PptxGenJS()
  // Use the built-in widescreen layout. A custom defineLayout() makes pptxgenjs
  // emit a phantom second slideMaster reference in [Content_Types].xml that some
  // lightweight readers (incl. pptx-preview) choke on — keep it standard.
  pptx.layout = 'LAYOUT_WIDE' // 13.33in x 7.5in (16:9)

  const s1 = pptx.addSlide()
  s1.background = { color: '0F172A' }
  s1.addText('omni-doc-viewer', {
    x: 0.5, y: 2.6, w: 12.33, h: 1.2, fontSize: 48, bold: true, color: 'FFFFFF', align: 'center',
  })
  s1.addText('One viewer for PDF, Word, Excel & PowerPoint', {
    x: 0.5, y: 3.9, w: 12.33, h: 0.6, fontSize: 22, color: '93C5FD', align: 'center',
  })
  s1.addText('100% client-side - offline - no API keys', {
    x: 0.5, y: 4.6, w: 12.33, h: 0.5, fontSize: 15, color: '94A3B8', align: 'center',
  })

  const s2 = pptx.addSlide()
  s2.addText('Supported formats', { x: 0.7, y: 0.6, w: 12, h: 0.9, fontSize: 32, bold: true, color: '0F172A' })
  s2.addText(
    [
      { text: 'PDF', options: { bullet: true, fontSize: 20 } },
      { text: 'Word (.docx)', options: { bullet: true, fontSize: 20 } },
      { text: 'Excel (.xlsx / .xls)', options: { bullet: true, fontSize: 20 } },
      { text: 'PowerPoint (.pptx)', options: { bullet: true, fontSize: 20 } },
    ],
    { x: 1.0, y: 2.0, w: 11, h: 4, color: '1E293B', lineSpacingMultiple: 1.5 },
  )

  // pptxgenjs writes to file via Node; ask for an arraybuffer/nodebuffer.
  const raw = await pptx.write({ outputType: 'nodebuffer' })
  return sanitizePptx(raw)
}

/**
 * pptxgenjs 4.x declares a phantom `slideMaster2.xml` in [Content_Types].xml
 * that it never writes. Strict apps ignore it, but lightweight readers (e.g.
 * pptx-preview) try to load every declared part and abort when one is missing —
 * leaving zero slides. Strip any Override whose target part isn't in the zip.
 */
export async function sanitizePptx(buf) {
  const zip = await JSZip.loadAsync(buf)
  const present = new Set(
    Object.keys(zip.files).filter((f) => !zip.files[f].dir).map((f) => '/' + f),
  )
  const removed = []
  let ct = await zip.file('[Content_Types].xml').async('string')
  ct = ct.replace(/<Override\b[^>]*PartName="([^"]+)"[^>]*\/>/g, (m, part) => {
    if (present.has(part)) return m
    removed.push(part)
    return ''
  })
  if (removed.length) {
    zip.file('[Content_Types].xml', ct)
    console.log('  pptx: stripped phantom Content_Types overrides:', removed.join(', '))
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

// ---------------------------------------------------------------------------
// Plain-text formats — Markdown, CSV, and an SVG image. No deps; just bytes.
// ---------------------------------------------------------------------------
export const SAMPLE_MD = `# omni-doc-viewer

A **drop-in document viewer** that runs entirely in the browser.

## Features
- PDF with a selectable, searchable text layer
- Word, Excel, PowerPoint
- Images, Markdown, CSV and plain text

> No server. No Microsoft iframe. No API keys.

| Format | Engine |
|---|---|
| PDF | pdf.js |
| Markdown | marked |
`

export const SAMPLE_CSV = `Name,Role,Format,Client-side
Alice,Engineer,PDF,yes
Bob,Designer,"Word, Excel",yes
Carol,PM,PowerPoint,yes
Dan,Analyst,"CSV, Markdown",yes
`

export const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#0f172a"/>
  <circle cx="320" cy="150" r="80" fill="#3b82f6"/>
  <text x="320" y="272" font-family="system-ui, sans-serif" font-size="28" fill="#fff" text-anchor="middle">omni-doc-viewer · SVG</text>
</svg>
`


// ---------------------------------------------------------------------------
// PPTX with a native chart — exercises the engine's chart path (echarts), so a
// dependency override on echarts is caught by the browser tests if it breaks.
// ---------------------------------------------------------------------------
export async function makeChartPptx() {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  const s = pptx.addSlide()
  s.addText('Quarterly sales', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true })
  s.addChart(
    pptx.ChartType.bar,
    [
      { name: 'North', labels: ['Q1', 'Q2', 'Q3', 'Q4'], values: [120, 150, 170, 200] },
      { name: 'South', labels: ['Q1', 'Q2', 'Q3', 'Q4'], values: [90, 110, 130, 160] },
    ],
    { x: 0.5, y: 1.3, w: 12, h: 5.5, barDir: 'col', showLegend: true },
  )
  const raw = await pptx.write({ outputType: 'nodebuffer' })
  return sanitizePptx(raw)
}

// ---------------------------------------------------------------------------
// PDF fixtures built with pdfkit (dev dependency): encryption, many pages, links.
// ---------------------------------------------------------------------------
async function pdfkitToBuffer(build) {
  const { default: PDFDocument } = await import('pdfkit')
  return new Promise((resolve, reject) => {
    const doc = build(PDFDocument)
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

/** A one-page PDF that requires the user password "secret" to open. */
export function makePasswordPdf() {
  return pdfkitToBuffer((PDFDocument) => {
    const doc = new PDFDocument({ userPassword: 'secret', ownerPassword: 'owner', pdfVersion: '1.7' })
    doc.fontSize(24).text('Protected document', 72, 72)
    doc.fontSize(12).text('You needed the password "secret" to read this.', 72, 120)
    return doc
  })
}

/** A PDF with `count` pages, each labelled with its page number. */
export function makeManyPagesPdf(count = 200) {
  return pdfkitToBuffer((PDFDocument) => {
    const doc = new PDFDocument({ autoFirstPage: false })
    for (let i = 1; i <= count; i++) {
      doc.addPage({ size: i % 10 === 0 ? 'A5' : 'LETTER' })
      doc.fontSize(20).text(`Page ${i} of ${count}`, 72, 72)
    }
    return doc
  })
}

/** A two-page PDF with an external link on page 1 and an internal link to page 2. */
export function makeLinksPdf() {
  return pdfkitToBuffer((PDFDocument) => {
    const doc = new PDFDocument()
    doc.fontSize(16).text('External link: example.com', 72, 72)
    doc.link(72, 72, 250, 20, 'https://example.com/')
    doc.text('Internal link: go to page 2', 72, 120)
    doc.goTo(72, 120, 250, 20, 'page2')
    doc.addPage()
    doc.addNamedDestination('page2')
    doc.fontSize(16).text('This is page 2', 72, 72)
    return doc
  })
}

/** A one-slide deck with an embedded PNG (exercises the media path). */
export async function makeImagePptx() {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  const s = pptx.addSlide()
  s.addText('Deck with an image', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true })
  // 2×2 red PNG.
  const png =
    'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP4z8DwHwyBLBAJAGLbBv0QwdWSAAAAAElFTkSuQmCC'
  s.addImage({ data: png, x: 1, y: 1.5, w: 4, h: 4 })
  const raw = await pptx.write({ outputType: 'nodebuffer' })
  return sanitizePptx(raw)
}

export const SAMPLE_JSON = JSON.stringify(
  { name: 'omni-doc-viewer', formats: ['pdf', 'docx', 'xlsx', 'pptx', 'json', 'code', 'html', 'video'], clientSide: true, stars: 4 },
  null,
  0,
)

export const SAMPLE_CODE = `import { createViewer } from 'omni-doc-viewer'

// A tiny example rendered with line numbers.
const viewer = createViewer({ host: document.getElementById('host')!, pagination: true })
await viewer.load(file)
viewer.subscribe((state) => console.log(state.page, '/', state.pageCount))
`

export const SAMPLE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Sample</title>
<style>body{font-family:system-ui;padding:24px;color:#1d1d1f}h1{margin-top:0}</style></head>
<body><h1>HTML, sandboxed</h1><p>This page is sanitized with DOMPurify and shown in an <code>&lt;iframe sandbox&gt;</code>.</p>
<script>alert('this never runs')</script></body></html>
`

export const SAMPLE_TXT = `omni-doc-viewer — plain text sample

Plain text, logs and any UTF-8 file render in a wrapped <pre>.
Long lines soft-wrap so nothing scrolls horizontally, and the text is
selectable, copyable and searchable (Ctrl+F in the viewer).

  1. one
  2. two
  3. three
`

/** 2-second stereo 440 Hz / 660 Hz sine tone as a 16-bit PCM WAV. */
export function makeWav(seconds = 2, sampleRate = 22050) {
  const channels = 2
  const frames = seconds * sampleRate
  const dataBytes = frames * channels * 2
  const buf = Buffer.alloc(44 + dataBytes)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(channels, 22)
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * channels * 2, 28); buf.writeUInt16LE(channels * 2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(dataBytes, 40)
  let o = 44
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate
    const env = Math.min(1, t * 8, (seconds - t) * 8) // fade in/out
    buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * t) * env * 12000), o); o += 2
    buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 660 * t) * env * 12000), o); o += 2
  }
  return buf
}

/** A 4:3 deck (10in × 7.5in) — decks are not always 16:9. */
export async function makeDeck4x3() {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_4x3'
  for (let i = 1; i <= 3; i++) {
    const s = pptx.addSlide()
    s.addText(`Slide ${i} of a 4:3 deck`, { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 28, bold: true })
    s.addText('Text that reaches the right edge of the slide ' + 'x'.repeat(40), { x: 0.5, y: 1.6, w: 9, h: 1, fontSize: 14 })
    s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 3, w: 9, h: 3.8, fill: { color: 'DDE8FF' }, line: { color: '2257D6' } })
  }
  const raw = await pptx.write({ outputType: 'nodebuffer' })
  return sanitizePptx(raw)
}
