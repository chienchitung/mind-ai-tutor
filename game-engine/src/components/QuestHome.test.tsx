import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QuestHome } from './QuestHome'
import type { Lesson } from '../types/lesson'

const baseProps = {
  lessons: [],
  completedLessons: [],
  stars: 0,
  level: 1,
  exp: 0,
  completionTime: null,
  rank: null,
  onStart: () => {},
  onReset: () => {},
  onLeaderboard: () => {},
}

describe('QuestHome guest notice', () => {
  it('shows a device-local progress notice for a signed-in guest', () => {
    const html = renderToStaticMarkup(<QuestHome {...baseProps} signedIn isGuest />)
    expect(html).toContain('訪客模式')
    expect(html).toContain('進度僅保存在這台裝置')
  })
  it('hides the notice for a student linked via a teacher login code', () => {
    const html = renderToStaticMarkup(<QuestHome {...baseProps} signedIn isGuest={false} />)
    expect(html).not.toContain('訪客模式')
  })
  it('hides the notice before anyone has signed in', () => {
    const html = renderToStaticMarkup(<QuestHome {...baseProps} signedIn={false} isGuest />)
    expect(html).not.toContain('訪客模式')
  })
})

describe('QuestHome learning journey guidance', () => {
  const lessons: Lesson[] = [
    { lesson_id: 'intro', title: '認識介面', description: '先熟悉工具', content: '', number: 0, duration: '10', role: 'intro' },
    { lesson_id: 'mission-1', title: '基本入門函數', description: '開始練習', content: '', number: 1, duration: '30' },
    { lesson_id: 'mission-2', title: 'IF 條件函數', description: '條件判斷', content: '', number: 2, duration: '25' },
  ]

  it('shows where the student is, the remaining time and a direct next action', () => {
    const html = renderToStaticMarkup(
      <QuestHome {...baseProps} lessons={lessons} completedLessons={['intro']} signedIn />,
    )
    expect(html).toContain('目前第 2 / 3 站')
    expect(html).toContain('剩餘約 55 分鐘')
    expect(html).toContain('你在這裡')
    expect(html).toContain('開始任務')
  })

  it('names the prerequisite instead of showing a generic lock message', () => {
    const html = renderToStaticMarkup(
      <QuestHome {...baseProps} lessons={lessons} completedLessons={['intro']} signedIn />,
    )
    expect(html).toContain('先完成「基本入門函數」')
  })
})
