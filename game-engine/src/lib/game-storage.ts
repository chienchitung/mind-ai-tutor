export function gameStorageKey(gameId: string | undefined, key: string): string {
  if (!gameId) return key

  const baseKey = `game:${gameId}:${key}`
  // The assignment pointer itself must stay at the game level so a newly
  // opened class link can switch the active namespace. Every other device-
  // local value is isolated by assignment to prevent reused games from
  // carrying progress, identity, or timers between cohorts.
  if (key === 'game_assignment_id' || typeof window === 'undefined') return baseKey

  const assignmentId = window.localStorage?.getItem(`game:${gameId}:game_assignment_id`)
  return assignmentId ? `game:${gameId}:assignment:${assignmentId}:${key}` : baseKey
}
