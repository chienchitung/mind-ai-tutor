import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc } }))

import { getPublicGameManifest } from './game-manifest'

describe('public game manifest lesson design', () => {
  beforeEach(() => mocks.rpc.mockReset())

  it('maps teacher-authored mission guidance and learning flow from metadata', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: 'game-1',
        title: 'Excel 任務',
        description: '',
        thumbnail_url: null,
        settings: { lessonOverrides: { 'lesson-1': { mission: { mentorMessage: '覆寫後的導師訊息' } } } },
        lessons: [{
          id: 'lesson-1', title: 'IF 函數', description: '舊摘要', duration: 20,
          level: 'Beginner', teaching_content: '內容', markdown_content: null,
          practice_exercises: [], genially_link: null, position: 1,
          metadata: {
            learning_flow: 'content_first',
            learning_objective: '能使用 IF 判斷條件',
            mission_scenario: '協助整理成績資料',
            mentor_message: '先找條件',
            completion_message: '你完成了判斷公式',
          },
        }],
      },
      error: null,
    })

    const game = await getPublicGameManifest('game-1')
    expect(game.lessons[0]).toEqual(expect.objectContaining({
      learningFlow: 'content_first',
      mission: {
        objective: '能使用 IF 判斷條件',
        scenario: '協助整理成績資料',
        mentorMessage: '覆寫後的導師訊息',
        completionMessage: '你完成了判斷公式',
      },
    }))
  })
})
