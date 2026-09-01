import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LessonAnswer, LessonMarkdown, ChallengeHeading } from './LessonChallenge'
import { MentorAvatar } from './MentorAvatar'
import { MissionBrief } from './MissionBrief'
import { readFileSync } from 'node:fs'

const actions = { onChange: () => {}, onSubmit: () => {}, onContinue: () => {}, onHint: () => {} }

describe('lesson UI rendering', () => {
  it('keeps a wrong answer editable with retry feedback, not completion', () => {
    const html = renderToStaticMarkup(<LessonAnswer {...actions} answer="wrong" submitted correct={false} stage="retry" />)
    expect(html).toContain('value="wrong"')
    expect(html).not.toContain('disabled=""')
    expect(html).toContain('再試一次')
    expect(html).toContain('檢查答案')
    expect(html).not.toContain('前往下一關')
  })
  it('only offers to reveal the answer while it is wrong and not yet shown', () => {
    const withoutExplanation = renderToStaticMarkup(<LessonAnswer {...actions} answer="wrong" submitted correct={false} stage="retry" onRevealAnswer={() => {}} />)
    expect(withoutExplanation).toContain('直接看解答')
    const withExplanation = renderToStaticMarkup(<LessonAnswer {...actions} answer="wrong" submitted correct={false} stage="retry" explanation="=SUM(B2:B6)" onRevealAnswer={() => {}} />)
    expect(withExplanation).not.toContain('直接看解答')
    const withoutHandler = renderToStaticMarkup(<LessonAnswer {...actions} answer="wrong" submitted correct={false} stage="retry" />)
    expect(withoutHandler).not.toContain('直接看解答')
    const whenCorrect = renderToStaticMarkup(<LessonAnswer {...actions} answer="right" submitted correct stage="complete" onRevealAnswer={() => {}} />)
    expect(whenCorrect).not.toContain('直接看解答')
  })
  it('disables an empty check and preserves the label association', () => {
    const html = renderToStaticMarkup(<LessonAnswer {...actions} answer="" submitted={false} correct={false} stage="working" />)
    expect(html).toContain('disabled=""')
    expect(html).toContain('for="lesson-answer"')
    expect(html).not.toContain('id="answer-feedback"')
  })
  it('shows success and the teacher completion message only after a correct submission', () => {
    const html = renderToStaticMarkup(<LessonAnswer {...actions} answer="150" submitted correct stage="complete" completionMessage="預算核對完成。" />)
    expect(html).toContain('答案正確')
    expect(html).toContain('預算核對完成。')
    expect(html).toContain('前往下一關')
    expect(html).toContain('role="status"')
  })
  it('labels a previously completed final mission as review and offers results', () => {
    const html = renderToStaticMarkup(<LessonAnswer {...actions} answer="" submitted correct stage="review" final />)
    expect(html).toContain('未保留前次輸入')
    expect(html).toContain('複習中')
    expect(html).toContain('查看旅程成果')
    expect(html).not.toContain('答案正確！')
  })
  it('keeps Markdown table semantics in a keyboard-accessible scroll region', () => {
    const html = renderToStaticMarkup(<LessonMarkdown>{'| 商品 | 金額 |\n| --- | --- |\n| 咖啡 | 150 |'}</LessonMarkdown>)
    expect(html).toContain('<table>')
    expect(html).toContain('<th>商品</th>')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('aria-label="題目資料表"')
  })
  it('does not inject executable teacher markup', () => {
    const html = renderToStaticMarkup(<LessonMarkdown>{'<script>alert(1)</script>'}</LessonMarkdown>)
    expect(html).not.toContain('<script>')
  })
  it('uses explicit status instead of a misleading submitted=100% progress bar', () => {
    const html = renderToStaticMarkup(<ChallengeHeading stage="retry" stars={10} xp={20} />)
    expect(html).toContain('再試一次')
    expect(html).toContain('首次完成')
    expect(html).not.toContain('progressbar')
  })
  it('preserves optional teacher scenario and keeps it initially collapsed', () => {
    const html = renderToStaticMarkup(<MissionBrief lesson={{ lesson_id:'photo', title:'攝影', number:1, description:'觀察光線', content:'原教材', mission:{scenario:'室內人像',mentorMessage:'先找出光源'} }} />)
    expect(html).toContain('觀察光線')
    expect(html).toContain('室內人像')
    expect(html).toContain('先找出光源')
    expect(html).toContain('<details')
    expect(html).not.toContain('open=""')
  })
  it('uses the redesigned robot avatar in every mentor instance', () => {
    const html = renderToStaticMarkup(<div><MentorAvatar /><MentorAvatar /></div>)
    expect(html.match(/<img /g)).toHaveLength(2)
    expect(html.match(/src="\/games\/avatars\/ellis-robot-v2.svg"/g)).toHaveLength(2)
    expect(html).not.toContain('ellis-human-v1')
    expect(html).toContain('alt=""')
    expect(html).toContain('width="96"')
    expect(html).not.toContain(' id=')
    expect(html).toContain('aria-hidden="true"')
  })
  it('keeps the vector robot self-contained and free of duplicated effect IDs', () => {
    const svg = readFileSync(new URL('../../public/avatars/ellis-robot-v2.svg', import.meta.url), 'utf8')
    expect(svg).toContain('viewBox="0 0 200 200"')
    expect(svg).toContain('#4DE4E4')
    expect(svg).not.toMatch(/<script|<image|<foreignObject|\sid=|url\(/)
  })
  it('does not duplicate answer IDs when the final panel stays mounted', () => {
    const html = renderToStaticMarkup(<div><LessonAnswer {...actions} answer="" submitted correct stage="complete" /><LessonAnswer {...actions} answer="" submitted correct stage="complete" final /></div>)
    const ids = Array.from(html.matchAll(/ id="([^"]+)"/g), match => match[1])
    expect(ids.length).toBe(4)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
