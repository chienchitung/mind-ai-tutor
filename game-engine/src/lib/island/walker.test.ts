import { describe, expect, it } from 'vitest'
import { REGION_CENTERS, islandSpots } from './layout'
import { HEX_STAGE_RADIUS, ownerPoint, planWalk, redirectWalk, sampleWalk, standPoint, walkPath } from './walker'

const spots = islandSpots('archipelago')
const at = (i: number) => standPoint(spots[i])

describe('island owner walk', () => {
  it('passes every stop in between, in either direction', () => {
    expect(walkPath(2, 5)).toEqual([2, 3, 4, 5])
    expect(walkPath(5, 2)).toEqual([5, 4, 3, 2])
    expect(walkPath(3, 3)).toEqual([3])
  })

  it('stands beside the building rather than inside it', () => {
    spots.forEach(spot => {
      const p = standPoint(spot)
      expect(Math.hypot(p.x - spot.x, p.z - spot.z)).toBeGreaterThan(0.9)
    })
  })

  it('keeps both figures on the arcade stages, and the stages apart', () => {
    const hexes = islandSpots('hexes')
    // Inner radius of the hexagon, less room for the figure's feet
    const room = HEX_STAGE_RADIUS * Math.cos(Math.PI / 6) - 0.3
    hexes.forEach(spot => {
      for (const p of [standPoint(spot, 'hexes'), ownerPoint(spot, 'hexes')]) expect(Math.hypot(p.x - spot.x, p.z - spot.z)).toBeLessThan(room)
    })
    hexes.forEach((a, i) => hexes.slice(i + 1).forEach(b => expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(HEX_STAGE_RADIUS * 2)))
  })

  it.each(['floaters', 'station'] as const)('keeps both figures on the %s platforms, clear of the building', layout => {
    // Islets have radius 4.2 and station discs 4.1; leave room for the figure's feet
    const room = 4.1 - 0.5
    islandSpots(layout).forEach(spot => {
      const [cx, cz] = REGION_CENTERS[layout][spot.region]
      for (const p of [standPoint(spot, layout), ownerPoint(spot, layout)]) {
        expect(Math.hypot(p.x - cx, p.z - cz)).toBeLessThan(room)
        expect(Math.hypot(p.x - spot.x, p.z - spot.z)).toBeGreaterThan(0.9)
      }
      const player = standPoint(spot, layout), owner = ownerPoint(spot, layout)
      expect(Math.hypot(player.x - owner.x, player.z - owner.z)).toBeGreaterThan(1)
    })
  })

  it('walks from one stop to another along the route and stops there', () => {
    const walk = planWalk('archipelago', spots, at(1), 1, 2, 4)
    expect(walk.stops).toEqual([1, 2, 3, 4])
    expect(walk.total).toBeCloseTo(walk.lengths.reduce((a, b) => a + b, 0))
    expect(sampleWalk(walk, 0).position).toEqual(at(1))
    expect(sampleWalk(walk, 0).done).toBe(false)
    const end = sampleWalk(walk, walk.total + 1)
    expect(end.done).toBe(true)
    expect(end.position).toEqual(at(4))
    expect(sampleWalk(walk, walk.lengths[0] + 0.01).leg).toBe(1)
  })

  it('jumps between separate stages and islets, and walks on one island', () => {
    expect(planWalk('archipelago', spots, at(0), 0, 1, 6).hops.some(Boolean)).toBe(false)
    const hexes = islandSpots('hexes')
    const hop = planWalk('hexes', hexes, standPoint(hexes[0], 'hexes'), 0, 1, 1)
    expect(hop.hops).toEqual([true])
    expect(sampleWalk(hop, hop.total / 2).position.y).toBeGreaterThan(Math.max(hexes[0].y, hexes[1].y) + 0.3)
    const floaters = islandSpots('floaters')
    expect(planWalk('floaters', floaters, standPoint(floaters[3], 'floaters'), 3, 4, 6).hops).toEqual([false, true, false])
  })

  it('turns round mid-walk when the student picks a stop behind, and carries on when ahead', () => {
    const walk = planWalk('archipelago', spots, at(1), 1, 2, 5)
    const mid = walk.lengths[0] / 2
    const back = redirectWalk('archipelago', spots, walk, mid, 0)
    expect(back.stops).toEqual([2, 1, 0])
    expect(back.points[0]).toEqual(sampleWalk(walk, mid).position)
    const on = redirectWalk('archipelago', spots, walk, mid, 3)
    expect(on.stops).toEqual([1, 2, 3])
    const fromRest = redirectWalk('archipelago', spots, walk, walk.total, 3)
    expect(fromRest.stops).toEqual([5, 4, 3])
    expect(fromRest.points[0]).toEqual(at(5))
  })
})
