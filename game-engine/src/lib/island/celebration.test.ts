// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { CELEBRATION_SECONDS, cheerAt, confettiAt, confettiPieces, readSeenStop, rememberSeenStop, unlockFrom } from './celebration'

describe('unlockFrom', () => {
  it('celebrates only when the student has moved past the stop they last saw', () => {
    expect(unlockFrom(null, 3)).toBeNull()
    expect(unlockFrom(3, 3)).toBeNull()
    expect(unlockFrom(5, 0)).toBeNull()
    expect(unlockFrom(2, 3)).toBe(2)
  })
})

describe('seen stop storage', () => {
  beforeEach(() => window.localStorage.clear())
  it('is kept per game and ignores junk', () => {
    expect(readSeenStop('g1')).toBeNull()
    rememberSeenStop('g1', 4)
    expect(readSeenStop('g1')).toBe(4)
    expect(readSeenStop('g2')).toBeNull()
    window.localStorage.setItem('game:g3:island_seen_stop', 'nope')
    expect(readSeenStop('g3')).toBeNull()
  })
})

describe('confetti', () => {
  it('is the same burst every time', () => {
    expect(confettiPieces()).toEqual(confettiPieces())
  })
  it('flies up out of the stop and is gone when the burst ends', () => {
    for (const piece of confettiPieces()) {
      expect(piece.velocity.y).toBeGreaterThan(0)
      const early = confettiAt(piece, 0.3), late = confettiAt(piece, CELEBRATION_SECONDS)
      expect(early.position.y).toBeGreaterThan(confettiAt(piece, 0).position.y)
      expect(early.scale).toBe(1)
      expect(late.scale).toBe(0)
      expect(Math.hypot(late.position.x, late.position.z)).toBeLessThan(3)
    }
  })
  it('cheers only during the burst', () => {
    expect(cheerAt(-0.1)).toBe(0)
    expect(cheerAt(0.8)).toBe(1)
    expect(cheerAt(CELEBRATION_SECONDS)).toBe(0)
  })
})
