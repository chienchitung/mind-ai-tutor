import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QuestHome } from './QuestHome'
import { GameLoadingShell } from './GameLoadingShell'
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

describe('GameLoadingShell', () => {
  it('stays theme-neutral until the manifest resolves', () => {
    const html = renderToStaticMarkup(<GameLoadingShell />)
    expect(html).toContain('正在載入遊戲樣板')
    expect(html).not.toContain('data-quest-template')
    expect(html).not.toContain('discovery')
  })
})

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
  it('greets a guest who typed a local-only nickname', () => {
    const html = renderToStaticMarkup(<QuestHome {...baseProps} signedIn isGuest guestName="小美" />)
    expect(html).toContain('嗨，小美！')
  })
  it('does not add a redundant greeting for the default guest name', () => {
    const html = renderToStaticMarkup(<QuestHome {...baseProps} signedIn isGuest guestName="訪客玩家" />)
    expect(html).not.toContain('嗨，')
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

describe('QuestHome template artwork', () => {
  it.each([
    ['discovery', '每一步，都是新的發現', 'discovery-hero.webp', '洛奇', 'mentor-roki.webp', '學習任務地圖', 'route'],
    ['neo-brutal', '把挑戰拆成一塊一塊', 'neo-blocks-hero.webp', '波波', 'mentor-bobo.webp', '挑戰拼裝板', 'build-board'],
    ['arcade', 'READY · LEARN · LEVEL UP', 'arcade-hero.webp', '尼克斯', 'mentor-nyx.webp', '選關畫面', 'level-select'],
    ['forest-camp', '慢慢探索，也能走得很遠', 'forest-camp-hero.webp', '莫里', 'mentor-mori.webp', '學習步道路線', 'trail'],
    ['arcane-archive', '翻開知識，解鎖新的篇章', 'arcane-archive-hero.webp', '萊拉', 'mentor-lyra.webp', '典藏章節索引', 'chapter-index'],
    ['orbital-lab', '啟動研究，連結每個新發現', 'orbital-lab-hero.webp', '奧比', 'mentor-orbi.webp', '任務控制中心', 'mission-control'],
  ] as const)('renders distinct %s artwork, mentor, and structure', (template, caption, asset, mentor, mentorAsset, journeyTitle, layout) => {
    const html = renderToStaticMarkup(
      <QuestHome {...baseProps} signedIn game={{ id: 'game', title: '測試遊戲', description: '', lessons: [], settings: { theme: { template } } }} />,
    )
    expect(html).toContain(caption)
    expect(html).toContain(`/games/template-art/${asset}`)
    expect(html).toContain(mentor)
    expect(html).toContain(`/games/avatars/${mentorAsset}`)
    expect(html).toContain(journeyTitle)
    expect(html).toContain(`data-experience-layout="${layout}"`)
  })
})
