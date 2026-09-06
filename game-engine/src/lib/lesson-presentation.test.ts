import { describe, expect, it } from 'vitest'
import { initialLessonTab, mentorGreeting } from './lesson-presentation'

describe('initialLessonTab', () => {
  it('honors the teacher-selected flow for standard lessons', () => {
    expect(initialLessonTab(false, false, 'challenge_first')).toBe('practice')
    expect(initialLessonTab(false, false, 'content_first')).toBe('content')
  })

  it('keeps intro and final lesson entry points stable', () => {
    expect(initialLessonTab(true, false, 'challenge_first')).toBe('content')
    expect(initialLessonTab(false, true, 'content_first')).toBe('game')
  })
})

describe('mentorGreeting', () => {
  it('uses the active mentor identity and voice', () => {
    expect(mentorGreeting('樞紐分析', undefined, '尼克斯', '先讀懂規則。')).toBe('我是尼克斯，你的 AI 學習夥伴。關於「樞紐分析」，先讀懂規則。')
  })

  it('preserves a teacher-authored opening message', () => {
    expect(mentorGreeting('樞紐分析', '先找出資料欄位', '尼克斯')).toBe('先找出資料欄位')
  })
})
