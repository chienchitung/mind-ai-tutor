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
export const MAX_DISTANCE = 46
/** Land and decoration reach this far beyond the outermost stops. */
const LAND_MARGIN = 2.6
/** Headroom above the ground for buildings, the player and stop badges. */
const FIGURE_ROOM = 1.6

/**
 * Frames the part of the island the student's route has opened, so it fills the view:
 * a two-region island is shown close up, and the camera pulls back as regions open.
 */
export function frameOpenIsland(spots: IslandSpot[], stopCount: number, aspect: number, fovDegrees: number): IslandFrame {
  const open = spots.slice(0, Math.max(1, Math.min(stopCount, spots.length)))
  const xs = open.map(s => s.x), zs = open.map(s => s.z), ys = open.map(s => s.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const center = { x: (minX + maxX) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, z: (minZ + maxZ) / 2 }
  // Project the open area's footprint onto the view: the camera looks down at a fixed angle
  // and from a fixed side, so the ground's depth is foreshortened and its corners turn.
  const halfX = (maxX - minX) / 2 + LAND_MARGIN, halfZ = (maxZ - minZ) / 2 + LAND_MARGIN
  const azimuth = Math.atan2(VIEW_DIRECTION.x, VIEW_DIRECTION.z), pitch = Math.asin(VIEW_DIRECTION.y)
  const across = halfX * Math.cos(azimuth) + halfZ * Math.sin(azimuth)
  const deep = (halfX * Math.sin(azimuth) + halfZ * Math.cos(azimuth)) * Math.sin(pitch) + FIGURE_ROOM
  const halfVertical = (fovDegrees * Math.PI) / 360
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * Math.max(aspect, 0.1))
  const distance = Math.max(across / Math.tan(halfHorizontal), deep / Math.tan(halfVertical))
  return { center, distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance)) }
}
