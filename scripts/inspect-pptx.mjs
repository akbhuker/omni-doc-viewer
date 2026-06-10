import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.URL || 'http://localhost:5199/'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 900, height: 800 })
const errors = []
const failed = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('requestfailed', (r) => failed.push(r.url() + ' :: ' + (r.failure()?.errorText || '')))
page.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()) })

await page.goto(URL, { waitUntil: 'networkidle0' })
await page.click('button.btn ::-p-text(PowerPoint)').catch(async () => {
  // fallback: click the 4th sample button
  const btns = await page.$$('button.btn')
  await btns[3].click()
})

// wait for the engine to render slides
await new Promise((r) => setTimeout(r, 2500))

const info = await page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const wrapper = q('.pptx-preview-wrapper')
  const host = q('.odv-pptx')
  const viewer = q('.viewer')
  const rectOf = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      bg: cs.backgroundColor, display: cs.display,
      overflow: cs.overflow, opacity: cs.opacity,
    }
  }
  const slides = wrapper ? [...wrapper.children].map((c) => {
    const r = c.getBoundingClientRect()
    return { tag: c.tagName, cls: c.className, w: Math.round(r.width), h: Math.round(r.height), kids: c.childElementCount }
  }) : []
  return {
    viewerRect: rectOf(viewer),
    hostRect: rectOf(host),
    wrapperRect: rectOf(wrapper),
    wrapperChildren: wrapper ? wrapper.childElementCount : 'NO WRAPPER',
    slides,
    wrapperHTMLlen: wrapper ? wrapper.innerHTML.length : 0,
  }
})

const errorText = await page.evaluate(() => {
  const el = document.querySelector('[role="alert"]') || document.querySelector('.viewer')
  return el ? el.textContent?.trim().slice(0, 300) : null
})
console.log('console errors:', errors.length ? errors : 'none')
console.log('failed requests:', failed.length ? failed : 'none')
console.log('viewer/alert text:', errorText)
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: '/tmp/pptx-render.png', fullPage: true })
console.log('screenshot -> /tmp/pptx-render.png')
await browser.close()
