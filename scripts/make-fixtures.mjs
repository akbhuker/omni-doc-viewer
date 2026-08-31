/**
 * Generates test fixtures into test/fixtures/generated/ (git-ignored).
 * Run with:  pnpm fixtures
 *
 * Fixtures are built programmatically so no third-party documents are checked
 * in. Add a builder to scripts/lib/samples.mjs and list it here.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { makeChartPptx, makeImagePptx, makeDeck4x3, makePasswordPdf, makeManyPagesPdf, makeLinksPdf } from './lib/samples.mjs'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'generated')

async function main() {
  await mkdir(OUT, { recursive: true })
  await writeFile(join(OUT, 'chart.pptx'), await makeChartPptx())
  await writeFile(join(OUT, 'image.pptx'), await makeImagePptx())
  await writeFile(join(OUT, 'deck-4x3.pptx'), await makeDeck4x3())
  await writeFile(join(OUT, 'password.pdf'), await makePasswordPdf())
  await writeFile(join(OUT, 'many-pages.pdf'), await makeManyPagesPdf(200))
  await writeFile(join(OUT, 'links.pdf'), await makeLinksPdf())
  console.log('Wrote fixtures to', OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
