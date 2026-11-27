import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { GameVisualTemplate } from '../../types/game'
import { LAYOUT_FOR_TEMPLATE } from './layout'
import { ISLAND_THEMES } from './themes'
import { buildLand, buildRoute, markShared, type IslandRouteStop } from './builder'

const templates: GameVisualTemplate[] = ['discovery', 'neo-brutal', 'arcade', 'forest-camp', 'arcane-archive', 'orbital-lab']
const stops: IslandRouteStop[] = [
  { status: 'done', intro: true, final: false },
  { status: 'done', intro: false, final: false },
  { status: 'current', intro: false, final: false },
  { status: 'locked', intro: false, final: false },
  { status: 'locked', intro: false, final: true },
]

describe('island builder', () => {
  it('builds land and a route for every template without models', () => {
    templates.forEach(template => {
      const land = buildLand(ISLAND_THEMES[template], LAYOUT_FOR_TEMPLATE[template], {})
      expect(land.regions).toHaveLength(4)
      const route = buildRoute(ISLAND_THEMES[template], land.spots, stops, {})
      expect(route.labels).toHaveLength(stops.length)
      const indices = new Set<number>()
      route.root.traverse(o => { if (o.userData.lessonIndex !== undefined) indices.add(o.userData.lessonIndex) })
      expect([...indices].sort()).toEqual([0, 1, 2, 3, 4])
      land.dispose(); route.dispose()
    })
  })

  it('only the forest lake gets a reflective lake, and only the neon template has separate stages', () => {
    const forest = buildLand(ISLAND_THEMES['forest-camp'], 'lake', {})
    expect(forest.lake).not.toBeNull()
    expect(buildLand(ISLAND_THEMES.discovery, 'archipelago', {}).lake).toBeNull()
    expect(buildLand(ISLAND_THEMES.arcade, 'hexes', {}).stages).toHaveLength(17)
  })

  it('places loaded models as copies and keeps their geometry when the island is disposed', () => {
    const geometry = new THREE.ConeGeometry(0.5, 1, 6)
    const palm = markShared(new THREE.Group().add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())))
    let disposed = false
    geometry.addEventListener('dispose', () => { disposed = true })
    const land = buildLand(ISLAND_THEMES.discovery, 'archipelago', { tree_palm: palm, tree_palmTall: palm })
    let copies = 0
    land.root.traverse(o => { if ((o as THREE.Mesh).geometry === geometry) copies++ })
    expect(copies).toBeGreaterThan(0)
    land.dispose()
    expect(disposed).toBe(false)
  })
})
