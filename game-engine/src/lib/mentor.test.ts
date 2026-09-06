import { describe, expect, it } from 'vitest'
import type { GameVisualTemplate } from '../types/game'
import { GAME_MENTORS, mentorForTemplate } from './mentor'

describe('template mentors', () => {
  it('gives every visual template a distinct identity and local avatar', () => {
    const templates: GameVisualTemplate[] = ['discovery', 'neo-brutal', 'arcade', 'forest-camp', 'arcane-archive', 'orbital-lab']
    const mentors = templates.map(mentorForTemplate)

    expect(new Set(mentors.map(mentor => mentor.name)).size).toBe(templates.length)
    expect(new Set(mentors.map(mentor => mentor.avatarPath)).size).toBe(templates.length)
    for (const mentor of mentors) {
      expect(mentor.avatarPath).toMatch(/^\/avatars\/mentor-.+\.webp$/)
      expect(mentor.role).not.toBe('')
      expect(mentor.greetingLead).not.toBe('')
    }
  })

  it('keeps discovery as the legacy-safe default', () => {
    expect(mentorForTemplate()).toBe(GAME_MENTORS.discovery)
  })
})
