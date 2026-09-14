import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkTutorLooseStrong } from './tutor-markdown'

function render(markdown: string): string {
  return renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkTutorLooseStrong]}>{markdown}</ReactMarkdown>,
  )
}

describe('AI tutor Markdown', () => {
  it('renders bold markers wrapped around Chinese quotation punctuation', () => {
    const html = render('關鍵在於**「欄位該放在哪個區域」**：')
    expect(html).toContain('<strong>「欄位該放在哪個區域」</strong>')
    expect(html).not.toContain('**')
  })

  it('keeps standard Markdown emphasis and lists intact', () => {
    const html = render('**解題方向**\n\n1. **分類項目**\n2. 計算數值')
    expect(html.match(/<strong>/g)).toHaveLength(2)
    expect(html).toContain('<ol>')
    expect(html).not.toContain('**')
  })

  it('leaves unmatched stars visible instead of deleting student content', () => {
    expect(render('公式可使用 A*B，未完成的 **標記')).toContain('未完成的 **標記')
  })
})
