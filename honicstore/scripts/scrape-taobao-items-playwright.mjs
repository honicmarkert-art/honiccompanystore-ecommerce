/**
 * Scrape Taobao item image URLs using Playwright (reuse logged-in Chrome profile if TAUBAO_USER_DATA_DIR set).
 * Default: fresh context — may get 0 images without login.
 *
 * Usage: node scripts/scrape-taobao-items-playwright.mjs
 * Output: scripts/xinde-batch-10-data.json (metadata only; merges with IMAGE_SCRAPE output)
 */
import fs from 'fs'
import path from 'path'

const IDS = [
  '541977731065',
  '38140937609',
  '525749206437',
  '36584610657',
  '38316710943',
  '37717306166',
  '37984321649',
  '609274329872',
  '547757363713',
  '633743549664',
]

const expr = `(() => {
  window.scrollTo(0, 3000)
  return [...new Set([...document.querySelectorAll('img')].map(i => i.src).filter(s =>
    s.includes('img.alicdn.com/imgextra') && !s.includes('tps-') && !s.includes('s.gif')
  ))].slice(0, 15)
})()`

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error('Install playwright: npm i -D playwright && npx playwright install chromium')
  process.exit(1)
}

const userDataDir = process.env.TAOBAO_USER_DATA_DIR
const browser = userDataDir
  ? await chromium.launchPersistentContext(userDataDir, { headless: false, channel: 'chrome' })
  : await chromium.launch({ headless: true })

const page = userDataDir ? browser.pages()[0] || (await browser.newPage()) : await browser.newPage()
const out = {}

for (const id of IDS) {
  await page.goto(`https://item.taobao.com/item.htm?id=${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2500)
  const urls = await page.evaluate(expr)
  out[id] = urls
  console.log(id, urls.length)
}

if (!userDataDir) await browser.close()
else await browser.close()

fs.writeFileSync(path.join(import.meta.dirname, 'xinde-scraped-images.json'), JSON.stringify(out, null, 2))
console.log('Wrote xinde-scraped-images.json')