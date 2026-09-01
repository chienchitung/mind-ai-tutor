import { describe, expect, it } from 'vitest'
import { gameAssetPath } from './game-asset-path'

describe('gameAssetPath', () => {
  it('prefixes public assets with the deployed base path', () => {
    expect(gameAssetPath('/excel-master-logo.svg')).toBe('/games/excel-master-logo.svg')
    expect(gameAssetPath('/avatars/ellis-robot-v2.svg')).toBe('/games/avatars/ellis-robot-v2.svg')
  })
  it('does not double-prefix assets or alter external URLs', () => {
    expect(gameAssetPath('/games/excel-master-logo.svg')).toBe('/games/excel-master-logo.svg')
    expect(gameAssetPath('https://cdn.example/logo.svg')).toBe('https://cdn.example/logo.svg')
    expect(gameAssetPath('//cdn.example/logo.svg')).toBe('//cdn.example/logo.svg')
  })
})
