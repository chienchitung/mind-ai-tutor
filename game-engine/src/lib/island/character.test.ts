import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { GameVisualTemplate } from '../../types/game'
import { animateCharacter, buildOwner, buildPlayer } from './character'

const TEMPLATES: GameVisualTemplate[] = ['discovery', 'neo-brutal', 'arcade', 'forest-camp', 'arcane-archive', 'orbital-lab']
const colours = (o: THREE.Object3D) => {
  const set = new Set<number>()
  o.traverse(c => { const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if ((c as THREE.Mesh).isMesh && m?.color) set.add(m.color.getHex()) })
  return set
}
const SKIN = 0xf0c8a0
const meshes = (o: THREE.Object3D) => { let n = 0; o.traverse(c => { if ((c as THREE.Mesh).isMesh) n++ }); return n }

describe('island figures', () => {
  it.each(TEMPLATES)('the %s player is a person who walks, dressed differently from the owner', template => {
    const player = buildPlayer(template), owner = buildOwner(template)
    expect(player.hover).toBe(false)
    expect(player.legL).not.toBeNull()
    const box = new THREE.Box3().setFromObject(player.root)
    expect(box.min.y).toBeGreaterThanOrEqual(-0.1)
    expect(box.max.y - box.min.y).toBeGreaterThan(1.6)
    expect(box.max.y).toBeLessThan(3.6)
    expect(colours(player.root).has(SKIN)).toBe(true)
    expect(colours(owner.root).has(SKIN)).toBe(false)
    player.dispose(); owner.dispose()
  })

  it('every template dresses the player its own way', () => {
    const outfits = new Set(TEMPLATES.map(t => [...colours(buildPlayer(t).root)].sort().join()))
    expect(outfits.size).toBe(TEMPLATES.length)
  })

  it.each(TEMPLATES)('builds the %s owner so it stands on its feet and is about a building tall', template => {
    const c = buildOwner(template)
    expect(meshes(c.root)).toBeGreaterThan(8)
    const box = new THREE.Box3().setFromObject(c.root)
    expect(box.min.y).toBeGreaterThanOrEqual(-0.1)
    expect(box.max.y - box.min.y).toBeGreaterThan(1.6)
    expect(box.max.y).toBeLessThan(3.6)
    c.dispose()
  })

  it('walkers swing their legs while walking and stand still at rest', () => {
    const c = buildOwner('discovery')
    animateCharacter(c, 0.3, { moving: true, hopping: false, shake: 0 })
    expect(Math.abs(c.legL!.rotation.x)).toBeGreaterThan(0.1)
    expect(c.legR!.rotation.x).toBeCloseTo(-c.legL!.rotation.x)
    animateCharacter(c, 0.3, { moving: false, hopping: false, shake: 0 })
    expect(c.legL!.rotation.x).toBe(0)
  })

  it('the book and the space robot float instead of walking', () => {
    for (const template of ['arcane-archive', 'orbital-lab'] as const) {
      const c = buildOwner(template)
      expect(c.hover).toBe(true)
      expect(c.legL).toBeNull()
      animateCharacter(c, 1, { moving: false, hopping: false, shake: 0 })
      expect(c.body.position.y).toBeGreaterThan(0.1)
    }
  })

  it('shakes its head when refused, and only then', () => {
    const c = buildOwner('forest-camp')
    animateCharacter(c, 0.05, { moving: false, hopping: false, shake: 1 })
    expect(Math.abs(c.head.rotation.y)).toBeGreaterThan(0.1)
    animateCharacter(c, 0.05, { moving: false, hopping: false, shake: 0 })
    expect(c.head.rotation.y).toBe(0)
  })
})
