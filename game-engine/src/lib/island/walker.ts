import type { IslandLayout, IslandSpot } from './layout'
import { REGION_CENTERS, regionOf } from './layout'

export interface Point { x: number; y: number; z: number }

/** Arcade stops are separate hexagonal stages; the player stands closer in so it stays on them. */
export const HEX_STAGE_RADIUS = 1.75
const OFFSETS = { open: [1.15, 0.9], hexes: [0.85, 0.65] } as const
const offsetsFor = (layout?: IslandLayout) => (layout === 'hexes' ? OFFSETS.hexes : OFFSETS.open)

/**
 * Islets and station discs are round, with the stops on a ring near the rim: a fixed offset
 * would push the player over the edge on some of them. There it steps in from the stop
 * toward the platform's centre instead, a little to one side.
 */
function inward(spot: IslandSpot, layout: 'floaters' | 'station', turn: number): Point {
  const [cx, cz] = REGION_CENTERS[layout][spot.region]
  const angle = Math.atan2(cz - spot.z, cx - spot.x) + turn
  return { x: spot.x + Math.cos(angle) * 1.2, y: spot.y, z: spot.z + Math.sin(angle) * 1.2 }
}
const ringLayout = (layout?: IslandLayout): layout is 'floaters' | 'station' => layout === 'floaters' || layout === 'station'

/** Where the player stands at a stop: just in front of the building, toward the camera. */
export function standPoint(spot: IslandSpot, layout?: IslandLayout): Point {
  if (ringLayout(layout)) return inward(spot, layout, 0.6)
  const [dx, dz] = offsetsFor(layout)
  return { x: spot.x + dx, y: spot.y, z: spot.z + dz }
}

/** Lesson indexes the player passes through, in order, to get from one stop to another. */
export function walkPath(from: number, to: number): number[] {
  const step = to >= from ? 1 : -1
  const path: number[] = []
  for (let i = from; i !== to + step; i += step) path.push(i)
  return path
}

export interface Walk {
  points: Point[]
  /** Length of each leg (points[i] → points[i + 1]). */
  lengths: number[]
  /** Legs that cross a gap (separate stages or islets) are jumped, not walked. */
  hops: boolean[]
  total: number
  /** Stop index each point belongs to (the first is the stop the walk left from). */
  stops: number[]
  /** Stop index the walk ends at. */
  target: number
}

function crossesGap(layout: IslandLayout, a: number, b: number) {
  if (layout === 'hexes') return a !== b
  if (layout === 'floaters' || layout === 'station') return regionOf(a) !== regionOf(b)
  return false
}

/**
 * Plans a walk along the route. `start` is where the player is now (a stand point, or a
 * point between two when the walk is redirected midway); `next` is the first stop it heads for.
 */
export function planWalk(layout: IslandLayout, spots: IslandSpot[], start: Point, from: number, next: number, target: number): Walk {
  const indexes = walkPath(next, target)
  const points = [start, ...indexes.map(i => standPoint(spots[i], layout))]
  const stopsAlong = [from, ...indexes]
  const lengths: number[] = [], hops: boolean[] = []
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k], b = points[k + 1]
    lengths.push(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z))
    hops.push(crossesGap(layout, stopsAlong[k], stopsAlong[k + 1]))
  }
  return { points, lengths, hops, total: lengths.reduce((sum, length) => sum + length, 0), stops: stopsAlong, target }
}

export interface WalkSample {
  position: Point
  /** Facing angle around Y (0 looks toward +Z). */
  heading: number
  /** Leg being travelled and the stop index at its far end. */
  leg: number
  done: boolean
  hopping: boolean
}

/** Where the player is after travelling `distance` along a planned walk. */
export function sampleWalk(walk: Walk, distance: number): WalkSample {
  const last = walk.points[walk.points.length - 1]
  if (walk.lengths.length === 0 || distance >= walk.total) {
    const leg = Math.max(0, walk.lengths.length - 1)
    return { position: { ...last }, heading: headingOf(walk, leg), leg, done: true, hopping: false }
  }
  let left = Math.max(0, distance), leg = 0
  while (leg < walk.lengths.length - 1 && left > walk.lengths[leg]) { left -= walk.lengths[leg]; leg++ }
  const a = walk.points[leg], b = walk.points[leg + 1]
  const t = walk.lengths[leg] > 0 ? Math.min(1, left / walk.lengths[leg]) : 1
  const hop = walk.hops[leg]
  const arc = hop ? Math.sin(Math.PI * t) * (0.5 + walk.lengths[leg] * 0.18) : 0
  return {
    position: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + arc, z: a.z + (b.z - a.z) * t },
    heading: headingOf(walk, leg),
    leg,
    done: false,
    hopping: hop,
  }
}

function headingOf(walk: Walk, leg: number) {
  const a = walk.points[leg], b = walk.points[leg + 1]
  if (!a || !b || (a.x === b.x && a.z === b.z)) return FACE_CAMERA
  return Math.atan2(b.x - a.x, b.z - a.z)
}

/**
 * Re-plans when the student picks another stop mid-walk: carry on to the stop ahead if the
 * new target lies that way, otherwise turn round at once.
 */
export function redirectWalk(layout: IslandLayout, spots: IslandSpot[], walk: Walk, travelled: number, target: number): Walk {
  const now = sampleWalk(walk, travelled)
  if (now.done) return planWalk(layout, spots, standPoint(spots[walk.target], layout), walk.target, nextToward(walk.target, target), target)
  const from = walk.stops[now.leg], ahead = walk.stops[now.leg + 1]
  const sameWay = Math.sign(ahead - from) === Math.sign(target - from) && target !== from
  return sameWay
    ? planWalk(layout, spots, now.position, from, ahead, target)
    : planWalk(layout, spots, now.position, ahead, from, target)
}

const nextToward = (from: number, target: number) => (target === from ? from : from + Math.sign(target - from))

/** Resting pose looks toward the default camera position. */
export const FACE_CAMERA = Math.atan2(14, 22)

/** World units per second. */
export const WALK_SPEED = 3.4
