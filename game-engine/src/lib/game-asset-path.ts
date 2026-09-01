/** Keep public assets aligned with next.config.ts basePath. */
export const GAME_BASE_PATH = '/games'

export function gameAssetPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return value
  if (value === GAME_BASE_PATH || value.startsWith(`${GAME_BASE_PATH}/`)) return value
  return `${GAME_BASE_PATH}${value}`
}
