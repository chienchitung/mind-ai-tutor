import type { GameVisualTemplate } from '../../types/game'

/** Island shape of each template; the route and the land are generated from it. */
export type IslandLayout = 'archipelago' | 'plates' | 'hexes' | 'lake' | 'floaters' | 'station'

export const LAYOUT_FOR_TEMPLATE: Record<GameVisualTemplate, IslandLayout> = {
  discovery: 'archipelago',
  'neo-brutal': 'plates',
  arcade: 'hexes',
  'forest-camp': 'lake',
  'arcane-archive': 'floaters',
  'orbital-lab': 'station',
}

/** The island has room for this many stops; longer games keep the route map. */
export const MAX_ISLAND_LESSONS = 17

export interface IslandSpot { x: number; y: number; z: number; region: number }

// Four regions appear as the route reaches them: 5 stops in the first, 4 in each of the others.
export const REGION_START = [0, 5, 9, 13] as const
export const regionOf = (index: number) => (index < 5 ? 0 : index < 9 ? 1 : index < 13 ? 2 : 3)

export const REGION_CENTERS: Record<'floaters' | 'station', [number, number, number][]> = {
  floaters: [[-1.5, 7.5, 1.8], [6.5, 1, 2.6], [-2.5, -4.5, 3.4], [4.5, -10.5, 4.2]],
  station: [[0, 9, 0.4], [9, 0.5, 1.0], [0.5, -9, 1.6], [-9, -1.5, 2.2]],
}

const ARCHIPELAGO: [number, number][] = [
  [0, 9], [-3, 7.6], [-5.2, 5], [-2.6, 3.4], [0.6, 4.6],
  [3.2, 5.6], [5.8, 3.4], [4.6, 0.4], [1.4, 1],
  [-1.6, -0.6], [-4.4, -2], [-2.8, -4.8], [0.4, -3.6],
  [3.2, -5.2], [5.8, -6.8], [4.2, -9.4], [1, -10.2],
]

function spotAt(layout: IslandLayout, i: number): IslandSpot {
  const region = regionOf(i)
  const j = i - REGION_START[region]
  switch (layout) {
    case 'plates': { // stepped baseplates; the route snakes up row by row
      const rows: [number, number[]][] = [[8, [-5, -2.5, 0, 2.5, 5]], [4.5, [5, 2.5, 0, -2.5]], [1, [-2.5, 0, 2.5, 5]], [-2.5, [5, 2.5, 0, -2.5]]]
      return { x: rows[region][1][j], z: rows[region][0], y: [0.4, 0.9, 1.4, 1.9][region], region }
    }
    case 'hexes': { // separate stages, three to a row, like a level select
      const row = Math.floor(i / 3), col = i % 3
      return { x: (row % 2 ? 1 - col : col - 1) * 4 + (row % 2 ? 0.8 : -0.8), z: 9 - row * 3.4, y: 0.5 + region * 0.35 + (i % 2) * 0.15, region }
    }
    case 'lake': { // a trail around a lake, climbing toward the summit
      const a = Math.PI / 2 + i * ((Math.PI * 2 * 0.86) / 16)
      return { x: Math.cos(a) * 7.2, z: Math.sin(a) * 7.6, y: [0.35, 0.5, 0.75, 1.2][region] + (region === 3 ? j * 0.15 : 0), region }
    }
    case 'floaters':
    case 'station': { // one islet or platform per region
      const [cx, cz, cy] = REGION_CENTERS[layout][region]
      const count = region === 0 ? 5 : 4
      const a = region * 1.4 + (j * Math.PI * 2) / (count + 0.6)
      return { x: cx + Math.cos(a) * 2.9, z: cz + Math.sin(a) * 2.9, y: cy, region }
    }
    default: {
      const [x, z] = ARCHIPELAGO[i]
      return { x, z, y: [0.35, 0.7, 1.25, 0.85][region], region }
    }
  }
}

/** Every plot the island can hold, in route order (the land is built for all of them). */
export function islandSpots(layout: IslandLayout): IslandSpot[] {
  return Array.from({ length: MAX_ISLAND_LESSONS }, (_, i) => spotAt(layout, i))
}

/** Regions the route reaches with this many lessons: only these islands are shown. */
export function regionsInUse(lessonCount: number): boolean[] {
  const last = Math.max(0, Math.min(lessonCount, MAX_ISLAND_LESSONS) - 1)
  return [0, 1, 2, 3].map(region => lessonCount > 0 && REGION_START[region] <= last)
}

export function islandSupports(lessonCount: number) {
  return lessonCount > 0 && lessonCount <= MAX_ISLAND_LESSONS
}
