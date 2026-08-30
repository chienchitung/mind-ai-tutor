import type { Lesson } from './lesson'

export interface GameTheme {
  brandLabel?: string
  primaryColor?: string
  accentColor?: string
  logoUrl?: string
}

export interface GameRewards {
  starsPerLesson?: number
  xpPerLesson?: number
  claimCost?: number
  completionUrl?: string
}

export interface GameLessonOverride {
  number?: number
  role?: 'intro' | 'standard' | 'final'
  cardDescription?: string
  mission?: GameMission
}

/** Optional presentation only. Never changes assessment or lesson identity. */
export interface GameMission {
  scenario?: string
  objective?: string
  mentorMessage?: string
  completionMessage?: string
}

export interface GameSettings {
  tutorPrompt?: string
  theme?: GameTheme
  rewards?: GameRewards
  lessonOverrides?: Record<string, GameLessonOverride>
}

export interface GameDefinition {
  id: string
  title: string
  description: string
  thumbnailUrl?: string | null
  settings: GameSettings
  lessons: Lesson[]
}
