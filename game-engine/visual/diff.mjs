// Compares two snapshot folders and writes a report. Usage:
//   node diff.mjs <before dir> <after dir> <out dir>
// Writes <out dir>/<name>.png for each picture that changed (before | after | difference) and a
// Markdown summary to <out dir>/summary.md (and to the GitHub job summary when there is one).
// It reports and does not fail: a change may well be intended, and a person decides.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { CASES, TEMPLATES } from './cases.mjs'

const [before, after, out] = process.argv.slice(2)
if (!before || !after || !out) { console.error('usage: node diff.mjs <before dir> <after dir> <out dir>'); process.exit(2) }
mkdirSync(out, { recursive: true })

/** Pixels that differ by less than this share are rendering noise, not a change. */
const NOISE = 0.001

function sideBySide(a, b, d) {
  const width = a.width + b.width + d.width, height = Math.max(a.height, b.height, d.height)
  const sheet = new PNG({ width, height })
  let x = 0
  for (const img of [a, b, d]) { PNG.bitblt(img, sheet, 0, 0, img.width, img.height, x, 0); x += img.width }
  return sheet
}

const rows = []
for (const c of CASES) {
  const beforeFile = join(before, `${c.name}.png`), afterFile = join(after, `${c.name}.png`)
  if (!existsSync(afterFile)) { rows.push({ ...c, status: 'missing' }); continue }
  if (!existsSync(beforeFile)) { rows.push({ ...c, status: 'new' }); continue }
  const a = PNG.sync.read(readFileSync(beforeFile)), b = PNG.sync.read(readFileSync(afterFile))
  if (a.width !== b.width || a.height !== b.height) {
    rows.push({ ...c, status: 'resized', detail: `${a.width}×${a.height} → ${b.width}×${b.height}` })
    continue
  }
  const d = new PNG({ width: a.width, height: a.height })
  const changed = pixelmatch(a.data, b.data, d.data, a.width, a.height, { threshold: 0.12 })
  const share = changed / (a.width * a.height)
  if (share > NOISE) writeFileSync(join(out, `${c.name}.png`), PNG.sync.write(sideBySide(a, b, d)))
  rows.push({ ...c, status: share > NOISE ? 'changed' : 'same', detail: `${(share * 100).toFixed(2)}%` })
}

const LABEL = { same: '沒有變化', changed: '有變化', new: '新畫面', missing: '缺少截圖', resized: '尺寸改變' }
const changedTemplates = TEMPLATES.filter(t => rows.some(r => r.template === t && r.status !== 'same'))
const lines = [
  '## 樣板畫面比對（與 base 分支）',
  '',
  changedTemplates.length ? `有變化的樣板：${changedTemplates.join('、')}` : '所有樣板的畫面都和 base 分支相同。',
  '',
  '| 畫面 | 結果 | 差異像素 |',
  '| --- | --- | --- |',
  ...rows.map(r => `| ${r.name} | ${LABEL[r.status]} | ${r.detail ?? '—'} |`),
  '',
  changedTemplates.length ? '有變化的畫面已存成「改前｜改後｜差異」對照圖，放在這次執行的 visual-diff 成品（artifact）裡。' : '',
]
const summary = lines.join('\n')
writeFileSync(join(out, 'summary.md'), summary)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n')
console.log(summary)
