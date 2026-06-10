import puppeteer from 'puppeteer-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
const logs = []
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()))
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message))
await page.goto('http://localhost:5199/pptx-test.html', { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 3000))
const w = await page.evaluate(() => ({
  status: window.__status, slideCount: window.__slideCount,
  children: window.__children, html: window.__html,
}))
console.log('result:', JSON.stringify(w, null, 2))
console.log('logs:', logs.length ? logs : 'none')
await browser.close()
