import { describe, expect, it } from 'vitest'
import { LAYOUT_FOR_TEMPLATE, islandSpots } from './layout'
import { MAX_DISTANCE, MIN_DISTANCE, VIEW_DIRECTION, frameOpenIsland } from './framing'

describe('island framing', () => {
  it('looks along a fixed unit direction', () => {
    expect(Math.hypot(VIEW_DIRECTION.x, VIEW_DIRECTION.y, VIEW_DIRECTION.z)).toBeCloseTo(1)
  })

  it.each(Object.values(LAYOUT_FOR_TEMPLATE))('pulls back as more of the %s island opens', layout => {
    const spots = islandSpots(layout)
    const distances = [3, 9, 17].map(count => frameOpenIsland(spots, count, 16 / 9, 42).distance)
    expect(distances[0]).toBeLessThanOrEqual(distances[1])
    expect(distances[1]).toBeLessThanOrEqual(distances[2])
    distances.forEach(d => { expect(d).toBeGreaterThanOrEqual(MIN_DISTANCE); expect(d).toBeLessThanOrEqual(MAX_DISTANCE) })
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
