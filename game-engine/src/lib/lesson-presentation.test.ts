import { describe, expect, it } from 'vitest'
import { initialLessonTab } from './lesson-presentation'

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
