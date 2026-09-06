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
})
