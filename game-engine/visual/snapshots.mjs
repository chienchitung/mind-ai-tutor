// Takes a picture of every template's game home from a running game-engine started with
// VISUAL_QA=1. Usage: node snapshots.mjs <base url, e.g. http://localhost:3300/games> <out dir>
// Fails when a page throws, or when the 3D island draws nothing (a blank or one-colour stage).
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import { CASES } from './cases.mjs'

const [base, out] = process.argv.slice(2)
if (!base || !out) { console.error('usage: node snapshots.mjs <base url> <out dir>'); process.exit(2) }
mkdirSync(out, { recursive: true })

/** Spread of brightness across the picture: near zero means nothing was drawn. */
function contrast(file) {
  const png = PNG.sync.read(readFileSync(file))
  let sum = 0, square = 0
  const n = png.width * png.height
  for (let i = 0; i < png.data.length; i += 4) {
    const y = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]
    sum += y; square += y * y
  }
  const mean = sum / n
  return Math.sqrt(Math.max(0, square / n - mean * mean))
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  // Software WebGL, the same on every runner
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const problems = []
for (const c of CASES) {
  const page = await browser.newPage({ viewport: c.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  page.on('pageerror', error => problems.push(`${c.name}: page error: ${error.message}`))
  const url = `${base}/visual-qa?t=${c.template}&view=${c.view}&n=9&done=3`
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.waitForSelector(c.webgl ? `${c.selector} canvas` : c.selector, { timeout: 60_000 })
    if (c.webgl) {
      await page.waitForSelector('.island-loading', { state: 'detached', timeout: 90_000 })
      // Models load and the first frames settle (reduced motion: nothing moves after that)
      await page.waitForTimeout(4000)
    }
    await page.evaluate(() => document.fonts.ready)
    const file = join(out, `${c.name}.png`)
    await page.locator(c.selector).screenshot({ path: file, animations: 'disabled', timeout: 120_000 })
    if (c.webgl) {
      const spread = contrast(file)
      if (spread < 6) problems.push(`${c.name}: the island looks blank (brightness spread ${spread.toFixed(1)})`)
    }
    console.log(`captured ${c.name}`)
  } catch (error) {
    problems.push(`${c.name}: ${error instanceof Error ? error.message.split('\n')[0] : error}`)
  }
  await page.close()
}
await browser.close()
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
