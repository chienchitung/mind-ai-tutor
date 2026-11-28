import type { IslandSpot } from './layout'

export interface IslandFrame {
  /** Where the camera looks: the middle of the island's open part. */
  center: { x: number; y: number; z: number }
  /** How far back the camera sits along its viewing direction. */
  distance: number
}

/** The camera's fixed viewing direction (from the island toward the camera), unit length. */
export const VIEW_DIRECTION = (() => {
  const [x, y, z] = [11, 13.5, 17.5]
  const length = Math.hypot(x, y, z)
  return { x: x / length, y: y / length, z: z / length }
})()

export const MIN_DISTANCE = 8
/** How far the student may zoom out by hand; the framing itself goes further when a narrow view needs it. */
export const MAX_DISTANCE = 46
/** Land and decoration reach about this far around each stop. */
const LAND_MARGIN = 2
const AROUND = [[0, 0], [LAND_MARGIN, 0], [-LAND_MARGIN, 0], [0, LAND_MARGIN], [0, -LAND_MARGIN]] as const
/** Stop badges float about this high over the ground. */
const BADGE_HEIGHT = 2.5
/** Keep a little air between the outermost point and the frame edge. */
const FRAME_FILL = 0.94

type Vec = { x: number; y: number; z: number }
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec, b: Vec) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const normalize = (a: Vec) => { const l = Math.hypot(a.x, a.y, a.z); return { x: a.x / l, y: a.y / l, z: a.z / l } }

/**
 * Frames the part of the island the student's route has opened, so it fills the view:
 * a two-region island is shown close up, and the camera pulls back as regions open.
 */
export function frameOpenIsland(spots: IslandSpot[], stopCount: number, aspect: number, fovDegrees: number): IslandFrame {
  const open = spots.slice(0, Math.max(1, Math.min(stopCount, spots.length)))
  const xs = open.map(s => s.x), zs = open.map(s => s.z), ys = open.map(s => s.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const center = { x: (minX + maxX) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, z: (minZ + maxZ) / 2 }
  // Exact fit: for each point that must show (the land around every open stop, at ground level
  // and at badge height) find how far back the camera has to be for it to land inside the frame
  // edge, and take the furthest. The camera looks at `center` along a fixed direction.
  const forward = { x: -VIEW_DIRECTION.x, y: -VIEW_DIRECTION.y, z: -VIEW_DIRECTION.z }
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }))
  const up = cross(right, forward)
  const tanV = Math.tan((fovDegrees * Math.PI) / 360) * FRAME_FILL
  const tanH = Math.tan((fovDegrees * Math.PI) / 360) * Math.max(aspect, 0.1) * FRAME_FILL
  let distance = MIN_DISTANCE
  for (const s of open) for (const [dx, dz] of AROUND) for (const lift of [0, BADGE_HEIGHT]) {
    const v = { x: s.x + dx - center.x, y: s.y + lift - center.y, z: s.z + dz - center.z }
    // Depth in front of the camera is distance - v·VIEW_DIRECTION; the point fits when its offset
    // across (or up) is within that depth times the half-angle's tangent
    const back = dot(v, VIEW_DIRECTION)
    distance = Math.max(distance, Math.abs(dot(v, right)) / tanH + back, Math.abs(dot(v, up)) / tanV + back)
  }
  return { center, distance }
}
