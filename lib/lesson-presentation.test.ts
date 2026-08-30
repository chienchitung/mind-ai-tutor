import { describe, expect, it } from 'vitest'
import { initialLessonTab, lessonStage, mentorGreeting, mentorPrompts } from '../game-engine/src/lib/lesson-presentation'

describe('lesson presentation states', () => {
  it.each([
    [false, false, false, 'working'],
    [false, false, true, 'working'],
    [false, true, false, 'retry'],
    [false, true, true, 'complete'],
    [true, false, false, 'review'],
    [true, true, true, 'review'],
  ] as const)('completion on entry=%s, submitted=%s, correct=%s → %s', (completed, submitted, correct, expected) => {
    expect(lessonStage(completed, submitted, correct)).toBe(expected)
  })

  it('opens the appropriate workspace for every lesson role', () => {
    expect(initialLessonTab(true, false)).toBe('content')
    expect(initialLessonTab(false, false)).toBe('practice')
    expect(initialLessonTab(false, true)).toBe('game')
    expect(initialLessonTab(true, true)).toBe('content')
  })

  it('uses the teacher greeting without rewriting it', () => {
    expect(mentorGreeting('攝影任務', '  先觀察光線，再拍攝。  ')).toBe('先觀察光線，再拍攝。')
  })

  it('supports a second game and an unloaded manifest without fixed lesson counts', () => {
    expect(mentorGreeting('攝影任務')).toContain('攝影任務')
    expect(mentorGreeting('攝影任務', ' ')).toContain('攝影任務')
    expect(mentorGreeting()).toContain('Ellis')
    expect(mentorGreeting()).not.toMatch(/5|Excel|VLOOKUP/)
  })

  it('offers three short, content-neutral scaffolding prompts', () => {
    expect(mentorPrompts).toHaveLength(3)
    expect(new Set(mentorPrompts.map(item => item.label)).size).toBe(3)
    for (const item of mentorPrompts) {
      expect(item.label.length).toBeLessThanOrEqual(4)
      expect(item.prompt.length).toBeGreaterThan(10)
      expect(item.prompt).not.toMatch(/Excel|VLOOKUP|SUM/)
    }
    expect(mentorPrompts[0].prompt).toContain('先不要直接提供答案')
  })
})
