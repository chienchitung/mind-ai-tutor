/**
 * Keyboard moves between the island's stop badges as one group: Tab reaches the selected stop,
 * the arrow keys step along the route, Home and End jump to its ends.
 * Returns the stop to select, or null when the key does nothing here.
 */
export function stopForKey(key: string, from: number, count: number): number | null {
  if (count <= 0) return null
  const last = count - 1
  const to = key === 'ArrowRight' || key === 'ArrowDown' ? Math.min(last, from + 1)
    : key === 'ArrowLeft' || key === 'ArrowUp' ? Math.max(0, from - 1)
    : key === 'Home' ? 0
    : key === 'End' ? last
    : null
  return to === null || to === from ? null : to
}

/** A summary of the island for screen readers, read before the student reaches the stops. */
export function islandSummary(total: number, done: number, current: string | null): string {
  const where = current === null ? '全部關卡都已完成' : `目前在「${current}」`
  return `島嶼地圖共 ${total} 站，已完成 ${done} 站，${where}。按 Tab 移到關卡，用方向鍵切換，按 Enter 選取後，可在下方卡片進入任務。也可以改用「路線圖」檢視。`
}
