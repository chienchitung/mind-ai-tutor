import { gameStorageKey } from '../game-storage'

/**
 * When the student comes back to the island having opened a new stop, the player walks there
 * from where they last saw it and the stop celebrates. The stop they last saw is kept per game
 * (and per class assignment, like the rest of the game's local progress).
 */
const SEEN_KEY = 'island_seen_stop'

export function readSeenStop(gameId?: string): number | null {
  try {
    const value = window.localStorage.getItem(gameStorageKey(gameId, SEEN_KEY))
    if (value === null) return null
    const index = Number.parseInt(value, 10)
    return Number.isInteger(index) && index >= 0 ? index : null
  } catch {
    return null
  }
}

export function rememberSeenStop(gameId: string | undefined, index: number) {
  try { window.localStorage.setItem(gameStorageKey(gameId, SEEN_KEY), String(index)) } catch { /* the celebration is optional */ }
}

/**
 * The stop the player should walk from to celebrate reaching `reached`, or null when nothing new
 * opened: on the first visit (nothing seen yet), or when progress was reset or went back.
 */
export function unlockFrom(seen: number | null, reached: number): number | null {
  return seen !== null && seen < reached ? seen : null
}

export const CONFETTI_COUNT = 42
/** Seconds the burst lasts. */
export const CELEBRATION_SECONDS = 2.2
const GRAVITY = 7

export interface ConfettiPiece {
  velocity: { x: number; y: number; z: number }
  spin: { x: number; y: number }
  /** Which of the burst's colours it takes. */
  tone: number
}

/** A small deterministic generator, so a burst looks the same every time (and in snapshots). */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Pieces thrown up and outward in a fountain. */
export function confettiPieces(count = CONFETTI_COUNT, tones = 3, seed = 7): ConfettiPiece[] {
  const random = seeded(seed)
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + random() * 0.6
    const out = 1.2 + random() * 1.6
    return {
      velocity: { x: Math.cos(angle) * out, y: 4.2 + random() * 2.4, z: Math.sin(angle) * out },
      spin: { x: (random() - 0.5) * 14, y: (random() - 0.5) * 14 },
      tone: i % tones,
    }
  })
}

export interface ConfettiState {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number }
  /** 1 while flying, shrinking to 0 as the burst ends. */
  scale: number
}

/** Where a piece is `t` seconds into the burst, relative to the stop. */
export function confettiAt(piece: ConfettiPiece, t: number): ConfettiState {
  const time = Math.max(0, Math.min(t, CELEBRATION_SECONDS))
  // Air drag slows the sideways drift; gravity pulls the piece back down
  const drift = (1 - Math.exp(-1.4 * time)) / 1.4
  const y = Math.max(-0.2, piece.velocity.y * time - 0.5 * GRAVITY * time * time)
  const fade = Math.min(1, Math.max(0, (CELEBRATION_SECONDS - time) / 0.6))
  return {
    position: { x: piece.velocity.x * drift, y: 0.6 + y, z: piece.velocity.z * drift },
    rotation: { x: piece.spin.x * time, y: piece.spin.y * time },
    scale: fade,
  }
}

/** 0–1 strength of the player's cheer `t` seconds after it arrives: up quickly, then easing off. */
export function cheerAt(t: number): number {
  if (t < 0 || t >= CELEBRATION_SECONDS) return 0
  return Math.min(1, t / 0.15) * Math.min(1, (CELEBRATION_SECONDS - t) / 0.5)
}
