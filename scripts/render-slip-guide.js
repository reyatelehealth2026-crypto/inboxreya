const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

/**
 * Regenerates the PNG and PDF copies of the sales-team slip guide from its HTML.
 *
 * The HTML is authored as an artifact fragment (no <html>/<head>/<body>), so it
 * is wrapped here before rendering rather than keeping a second derived file in
 * the repo that could drift from the source.
 *
 *   node scripts/render-slip-guide.js
 */

const DIR = path.join(__dirname, '..', 'docs', 'slip-guide')
const SRC = path.join(DIR, 'slip-guide.html')

/** Keep headings, tables and the diagram off page boundaries in the PDF. */
const PRINT_CSS = `
  figure, .card, .callout, .facts, .legend { break-inside: avoid; }
  tr, .row, ol.steps li { break-inside: avoid; }
  h1, h2, h3 { break-after: avoid; }
  .figure-frame { overflow: visible; }
`

;(async () => {
  const fragment = fs.readFileSync(SRC, 'utf8')
  const html =
    '<!doctype html><html lang="th"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=1120">' +
    '<style>html,body{margin:0;padding:0}</style></head><body>' +
    fragment +
    '</body></html>'

  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1120, height: 1400 },
    deviceScaleFactor: 2,
  })

  await page.setContent(html, { waitUntil: 'networkidle', timeout: 60000 })
  // Thai web fonts settle after networkidle; screenshotting earlier bakes in the
  // fallback face.
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1200)

  await page.screenshot({ path: path.join(DIR, 'slip-guide.png'), fullPage: true })
  console.log('png ok')

  await page.addStyleTag({ content: PRINT_CSS })
  await page.pdf({
    path: path.join(DIR, 'slip-guide.pdf'),
    format: 'A4',
    // The layout is 1080px wide and A4 gives ~794px, so scale it down rather
    // than letting the right edge fall off the page.
    scale: 0.7,
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' },
  })
  console.log('pdf ok')

  await browser.close()
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
