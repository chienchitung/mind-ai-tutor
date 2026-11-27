import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { GameVisualTemplate } from '../../types/game'
import { animateCharacter, buildPlayer } from './character'

const TEMPLATES: GameVisualTemplate[] = ['discovery', 'neo-brutal', 'arcade', 'forest-camp', 'arcane-archive', 'orbital-lab']
const colours = (o: THREE.Object3D) => {
  const set = new Set<number>()
  o.traverse(c => { const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if ((c as THREE.Mesh).isMesh && m?.color) set.add(m.color.getHex()) })
  return set
}
const SKIN = 0xf0c8a0

describe('island player', () => {
  it.each(TEMPLATES)('the %s player is a person standing on its feet, about a building tall', template => {
    const player = buildPlayer(template)
    expect(colours(player.root).has(SKIN)).toBe(true)
    const box = new THREE.Box3().setFromObject(player.root)
    expect(box.min.y).toBeGreaterThanOrEqual(-0.1)
    expect(box.max.y - box.min.y).toBeGreaterThan(1.6)
    expect(box.max.y).toBeLessThan(3.6)
    player.dispose()
  })

  it('every template dresses the player its own way', () => {
    const outfits = new Set(TEMPLATES.map(t => [...colours(buildPlayer(t).root)].sort().join()))
    expect(outfits.size).toBe(TEMPLATES.length)
  })

  it('swings its legs while walking and stands still at rest', () => {
    const c = buildPlayer('discovery')
    animateCharacter(c, 0.3, { moving: true, hopping: false, shake: 0 })
    expect(Math.abs(c.legL.rotation.x)).toBeGreaterThan(0.1)
    expect(c.legR.rotation.x).toBeCloseTo(-c.legL.rotation.x)
    animateCharacter(c, 0.3, { moving: false, hopping: false, shake: 0 })
    expect(c.legL.rotation.x).toBe(0)
  })

  it('holds still at time zero, which is what reduced motion passes', () => {
    const c = buildPlayer('discovery')
    animateCharacter(c, 0, { moving: false, hopping: false, shake: 0 })
    expect(c.body.position.y).toBe(0)
    expect(c.armL.rotation.x).toBe(0)
    expect(c.armR.rotation.x).toBe(-0)
  })

  it('shakes its head when refused, and only then', () => {
    const c = buildPlayer('forest-camp')
    animateCharacter(c, 0.05, { moving: false, hopping: false, shake: 1 })
    expect(Math.abs(c.head.rotation.y)).toBeGreaterThan(0.1)
    animateCharacter(c, 0.05, { moving: false, hopping: false, shake: 0 })
    expect(c.head.rotation.y).toBe(0)
  })
})
