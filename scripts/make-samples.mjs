/**
 * Generates the demo's sample documents into demo/public/samples/.
 * Run with:  pnpm samples
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  makePdf,
  makeXlsx,
  makeDocx,
  makePptx,
  SAMPLE_MD,
  SAMPLE_CSV,
  SAMPLE_SVG,
  SAMPLE_JSON,
  SAMPLE_CODE,
  SAMPLE_HTML,
  SAMPLE_TXT,
  makeWav,
  makePasswordPdf,
} from './lib/samples.mjs'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'demo', 'public', 'samples')

async function main() {
  await mkdir(OUT, { recursive: true })
  const [pdf, xlsx, docx, pptx] = await Promise.all([makePdf(), makeXlsx(), makeDocx(), makePptx()])
  await writeFile(join(OUT, 'sample.pdf'), pdf)
  await writeFile(join(OUT, 'sample.xlsx'), xlsx)
  await writeFile(join(OUT, 'sample.docx'), docx)
  await writeFile(join(OUT, 'sample.pptx'), pptx)
  await writeFile(join(OUT, 'sample.md'), SAMPLE_MD)
  await writeFile(join(OUT, 'sample.csv'), SAMPLE_CSV)
  await writeFile(join(OUT, 'sample.svg'), SAMPLE_SVG)
  await writeFile(join(OUT, 'sample.json'), SAMPLE_JSON)
  await writeFile(join(OUT, 'sample.ts'), SAMPLE_CODE)
  await writeFile(join(OUT, 'sample.html'), SAMPLE_HTML)
  await writeFile(join(OUT, 'sample.txt'), SAMPLE_TXT)
  await writeFile(join(OUT, 'sample.wav'), makeWav())
  await writeFile(join(OUT, 'sample-protected.pdf'), await makePasswordPdf())
  console.log('Wrote samples to', OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
