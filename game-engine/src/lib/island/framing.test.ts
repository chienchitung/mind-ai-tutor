import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { LAYOUT_FOR_TEMPLATE, islandSpots } from './layout'
import { MIN_DISTANCE, VIEW_DIRECTION, frameOpenIsland } from './framing'

describe('island framing', () => {
  it('looks along a fixed unit direction', () => {
    expect(Math.hypot(VIEW_DIRECTION.x, VIEW_DIRECTION.y, VIEW_DIRECTION.z)).toBeCloseTo(1)
  })

  it.each(Object.values(LAYOUT_FOR_TEMPLATE))('shows a young %s island closer than the whole island', layout => {
    const spots = islandSpots(layout)
    const young = frameOpenIsland(spots, 3, 16 / 9, 42).distance, whole = frameOpenIsland(spots, 17, 16 / 9, 42).distance
    expect(young).toBeLessThan(whole)
    expect(young).toBeGreaterThanOrEqual(MIN_DISTANCE)
  })

  it('centres on the open stops, not the whole island', () => {
    const spots = islandSpots('floaters')
    const { center } = frameOpenIsland(spots, 5, 16 / 9, 42)
    const xs = spots.slice(0, 5).map(s => s.x), zs = spots.slice(0, 5).map(s => s.z)
    expect(center.x).toBeGreaterThanOrEqual(Math.min(...xs))
    expect(center.x).toBeLessThanOrEqual(Math.max(...xs))
    expect(center.z).toBeGreaterThanOrEqual(Math.min(...zs))
    expect(center.z).toBeLessThanOrEqual(Math.max(...zs))
  })

  it('backs off on a tall, narrow (phone) view so the island still fits across', () => {
    const spots = islandSpots('archipelago')
    expect(frameOpenIsland(spots, 9, 0.6, 42).distance).toBeGreaterThan(frameOpenIsland(spots, 9, 2, 42).distance)
  })
})

describe('island framing on screen', () => {
  // Projects every open stop (and a badge's height above it) through the real camera
  const offscreen = (layout: Parameters<typeof islandSpots>[0], count: number, aspect: number) => {
    const spots = islandSpots(layout)
    const { center, distance } = frameOpenIsland(spots, count, aspect, 42)
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 400)
    camera.position.set(center.x + VIEW_DIRECTION.x * distance, center.y + VIEW_DIRECTION.y * distance, center.z + VIEW_DIRECTION.z * distance)
    camera.lookAt(center.x, center.y, center.z)
    camera.updateMatrixWorld()
    return spots.slice(0, count).flatMap((s, i) => [0, 2.5].map(lift => ({ i, p: new THREE.Vector3(s.x, s.y + lift, s.z).project(camera) })))
      .filter(({ p }) => Math.abs(p.x) > 1 || Math.abs(p.y) > 1).map(({ i }) => i)
  }

  it.each(Object.values(LAYOUT_FOR_TEMPLATE))('keeps every open %s stop and its badge in view, wide or narrow', layout => {
    for (const aspect of [0.5, 0.75, 1.2, 2])
      for (const count of [3, 5, 9, 13, 17]) expect(offscreen(layout, count, aspect), `${count} stops at ${aspect}`).toEqual([])
  })
})
