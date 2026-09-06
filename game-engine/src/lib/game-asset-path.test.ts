import { describe, expect, it } from 'vitest'
import { gameAssetPath } from './game-asset-path'

describe('gameAssetPath', () => {
  it('prefixes public assets with the deployed base path', () => {
    expect(gameAssetPath('/excel-master-logo.svg')).toBe('/games/excel-master-logo.svg')
    expect(gameAssetPath('/avatars/mentor-roki.webp')).toBe('/games/avatars/mentor-roki.webp')
  })
  it('does not double-prefix assets or alter external URLs', () => {
    expect(gameAssetPath('/games/excel-master-logo.svg')).toBe('/games/excel-master-logo.svg')
    expect(gameAssetPath('https://cdn.example/logo.svg')).toBe('https://cdn.example/logo.svg')
    expect(gameAssetPath('//cdn.example/logo.svg')).toBe('//cdn.example/logo.svg')
  })
})
