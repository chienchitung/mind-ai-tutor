export function gameStorageKey(gameId: string | undefined, key: string): string {
  return gameId ? `game:${gameId}:${key}` : key
}
