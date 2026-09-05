import type { GameMission, GameTheme, GameVisualTemplate } from '../types/game'
import type { Lesson } from '../types/lesson'

export const missionLimits = { scenario: 600, objective: 200, mentorMessage: 300, completionMessage: 300 } as const

export function normalizeMission(value: unknown): GameMission | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const mission: GameMission = {}
  for (const key of Object.keys(missionLimits) as (keyof GameMission)[]) {
    const text = (value as Record<string, unknown>)[key]
    if (typeof text === 'string' && text.trim()) mission[key] = text.trim().slice(0, missionLimits[key])
  }
  return Object.keys(mission).length ? mission : undefined
}

/** Matches the existing home-page unlock rule, including intro exceptions. */
export function canEnterLesson(lessons: Lesson[], index: number, completed: string[], signedIn: boolean) {
  const lesson = lessons[index]
  return !!lesson && signedIn && (lesson.role === 'intro' || index === 0 || completed.includes(lessons[index - 1].lesson_id))
}

export function missionObjective(lesson: Lesson) {
  return lesson.mission?.objective || lesson.description || `閱讀「${lesson.title}」的學習資料，依課程指引完成練習。`
}

export function gameThemeStyle(theme?: GameTheme): Record<string, string> {
  // Accept only hex colors, never arbitrary CSS from public configuration.
  const color = (value: unknown, fallback: string) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback
  return { '--quest-primary': color(theme?.primaryColor, '#1764d8'), '--quest-accent': color(theme?.accentColor, '#0f8a91') }
}

export function gameVisualTemplate(theme?: GameTheme): GameVisualTemplate {
  return theme?.template === 'neo-brutal' || theme?.template === 'arcade' ? theme.template : 'discovery'
}

export function gameBrandKind(label: string, isLegacy: boolean) {
  return isLegacy || /^excel\s*master$/i.test(label.trim()) ? 'excel' : 'generic'
}
