import { describe, expect, it } from 'vitest'
import type { GameVisualTemplate } from '../../types/game'
import { LAYOUT_FOR_TEMPLATE, MAX_ISLAND_LESSONS, islandSpots, islandSupports, regionOf, regionsInUse } from './layout'
import { ISLAND_MODELS, ISLAND_THEMES } from './themes'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const templates: GameVisualTemplate[] = ['discovery', 'neo-brutal', 'arcade', 'forest-camp', 'arcane-archive', 'orbital-lab']

describe('island layouts', () => {
  it('gives every template its own island shape', () => {
    expect(new Set(templates.map(t => LAYOUT_FOR_TEMPLATE[t])).size).toBe(templates.length)
  })

  it('places every stop apart from the last one, so buildings never overlap', () => {
    templates.forEach(template => {
      const spots = islandSpots(LAYOUT_FOR_TEMPLATE[template])
      expect(spots).toHaveLength(MAX_ISLAND_LESSONS)
      spots.slice(1).forEach((spot, i) => {
        const prev = spots[i]
        expect(Math.hypot(spot.x - prev.x, spot.z - prev.z), `${template} stop ${i + 1}`).toBeGreaterThan(1.8)
      })
    })
  })

  it('opens regions as the teacher adds lessons: 5 stops, then 4 per region', () => {
    expect([0, 4, 5, 8, 9, 12, 13, 16].map(regionOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
    expect(regionsInUse(3)).toEqual([true, false, false, false])
    expect(regionsInUse(6)).toEqual([true, true, false, false])
    expect(regionsInUse(17)).toEqual([true, true, true, true])
    expect(regionsInUse(0)).toEqual([false, false, false, false])
  })

  it('keeps games longer than the island on the route map', () => {
    expect(islandSupports(0)).toBe(false)
    expect(islandSupports(MAX_ISLAND_LESSONS)).toBe(true)
    expect(islandSupports(MAX_ISLAND_LESSONS + 1)).toBe(false)
  })
})

describe('island themes', () => {
  it('names four regions for every template', () => {
    templates.forEach(template => expect(ISLAND_THEMES[template].regions).toHaveLength(4))
  })

  it('ships every Kenney model it loads, with the CC0 licence', () => {
    const dir = join(process.cwd(), 'public/island/kenney')
    ISLAND_MODELS.forEach(name => expect(existsSync(join(dir, `${name}.glb`)), name).toBe(true))
    expect(existsSync(join(dir, 'License.txt'))).toBe(true)
  })
})
