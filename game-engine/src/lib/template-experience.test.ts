import { describe, expect, it } from 'vitest'
import type { GameVisualTemplate } from '../types/game'
import { experienceForTemplate } from './template-experience'

const templates: GameVisualTemplate[] = ['discovery', 'neo-brutal', 'arcade', 'forest-camp', 'arcane-archive', 'orbital-lab']

describe('template information architecture', () => {
  it('assigns every template a distinct home structure and vocabulary', () => {
    const experiences = templates.map(experienceForTemplate)
    expect(new Set(experiences.map(item => item.home.layout)).size).toBe(templates.length)
    expect(new Set(experiences.map(item => item.home.journeyTitle)).size).toBe(templates.length)
    expect(new Set(experiences.map(item => item.lesson.homeLabel)).size).toBe(templates.length)
  })

  it('uses world-specific lesson navigation', () => {
    expect(experienceForTemplate('neo-brutal').lesson.practiceTab).toBe('動手拆解')
    expect(experienceForTemplate('arcade').lesson.levelLabel(2)).toBe('STAGE 02')
    expect(experienceForTemplate('forest-camp').home.stopLabel('standard', 3)).toBe('路標 03')
    expect(experienceForTemplate('arcane-archive').home.stopLabel('standard', 4)).toBe('第 04 章')
    expect(experienceForTemplate('orbital-lab').lesson.interactiveTab).toBe('模擬艙')
  })

  it('provides themed leaderboard copy for every world', () => {
    const titles = templates.map(template => experienceForTemplate(template).home.leaderboardTitle)
    expect(new Set(titles).size).toBe(templates.length)
    templates.forEach(template => {
      const home = experienceForTemplate(template).home
      expect(home.leaderboardKicker.length).toBeGreaterThan(0)
      expect(home.leaderboardDescription.length).toBeGreaterThan(0)
    })
  })
})
