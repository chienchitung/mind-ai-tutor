import { describe, expect, it } from 'vitest'
import { islandSummary, stopForKey } from './keyboard'

describe('stopForKey', () => {
  it('steps along the route and stops at its ends', () => {
    expect(stopForKey('ArrowRight', 2, 5)).toBe(3)
    expect(stopForKey('ArrowDown', 2, 5)).toBe(3)
    expect(stopForKey('ArrowLeft', 2, 5)).toBe(1)
    expect(stopForKey('ArrowUp', 2, 5)).toBe(1)
    expect(stopForKey('Home', 2, 5)).toBe(0)
    expect(stopForKey('End', 2, 5)).toBe(4)
    expect(stopForKey('ArrowRight', 4, 5)).toBeNull()
    expect(stopForKey('ArrowLeft', 0, 5)).toBeNull()
    expect(stopForKey('a', 2, 5)).toBeNull()
    expect(stopForKey('ArrowRight', 0, 0)).toBeNull()
  })
})

describe('islandSummary', () => {
  it('says where the student is and how to move', () => {
    expect(islandSummary(8, 2, '任務 02：常用函數')).toContain('共 8 站，已完成 2 站，目前在「任務 02：常用函數」')
    expect(islandSummary(8, 8, null)).toContain('全部關卡都已完成')
  })
})
