import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QuestHome } from './QuestHome'

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
