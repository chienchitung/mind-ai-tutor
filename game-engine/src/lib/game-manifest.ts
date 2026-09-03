import { supabase } from './supabase'
import type { GameDefinition, GameLessonOverride, GameSettings } from '../types/game'
import type { Lesson } from '../types/lesson'
import { normalizeMission } from './mission'

interface ManifestLessonRow {
  id: string
  title: string
  description: string | null
  duration: number | null
  level: string | null
  teaching_content: string | null
  markdown_content: string | null
  practice_exercises: unknown
  genially_link: string | null
  metadata: Record<string, unknown> | null
  position: number
}

interface ManifestPayload {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  settings: GameSettings | null
  lessons: ManifestLessonRow[]
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value))
    } catch {
      return {}
    }
  }

  return {}
}

function compactDescription(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length > 120 ? `${compact.slice(0, 119)}…` : compact
}

function mapLesson(
  row: ManifestLessonRow,
  override: GameLessonOverride = {},
): Lesson {
  const metadata = asRecord(row.metadata)
  const metadataRole = asString(metadata.game_role)
  const role = override.role ?? (
    metadataRole === 'intro' || metadataRole === 'final' ? metadataRole : 'standard'
  )
  const configuredNumber = override.number ?? asNumber(metadata.game_number)
  const metadataDescription = asString(metadata.card_description)
  const description = override.cardDescription ?? metadataDescription ?? row.description ?? ''
  const metadataFlow = asString(metadata.learning_flow)
  const learningFlow = metadataFlow === 'content_first' ? 'content_first' : 'challenge_first'
  const metadataMission = {
    objective: asString(metadata.learning_objective),
    scenario: asString(metadata.mission_scenario),
    mentorMessage: asString(metadata.mentor_message),
    completionMessage: asString(metadata.completion_message),
  }

  return {
    lesson_id: row.id,
    number: configuredNumber ?? row.position,
    title: row.title,
    description: compactDescription(description),
    content: row.teaching_content ?? row.markdown_content ?? '',
    duration: row.duration ? String(row.duration) : undefined,
    role,
    isFinal: role === 'final',
    showGame: role === 'final' || Boolean(row.genially_link),
    geniallyLink: row.genially_link,
    teachingContent: row.teaching_content,
    markdownContent: row.markdown_content,
    practiceExercises: row.practice_exercises,
    metadata,
    learningFlow,
    mission: normalizeMission({ ...metadataMission, ...(override.mission || {}) }),
  }
}

export async function getPublicGameManifest(gameId: string): Promise<GameDefinition> {
  const { data, error } = await supabase.rpc('get_public_game_manifest', {
    p_game_id: gameId,
  })

  if (error) {
    throw new Error(error.message || 'Unable to load game configuration')
  }

  const payload = data as ManifestPayload | null
  if (!payload) {
    throw new Error('Game not found or is not active')
  }

  const settings = payload.settings ?? {}
  const lessonOverrides = settings.lessonOverrides ?? {}
  const lessons = (payload.lessons ?? []).map(row =>
    mapLesson(row, lessonOverrides[row.id]),
  )

  // The shared template always has a final challenge. Existing games predate
  // metadata.game_role, so the last configured lesson is the safe backwards-
  // compatible default until the teacher explicitly marks lesson roles.
  if (lessons.length > 0 && !lessons.some(lesson => lesson.role === 'final')) {
    lessons[lessons.length - 1] = {
      ...lessons[lessons.length - 1],
      role: 'final',
      isFinal: true,
      showGame: true,
    }
  }

  return {
    id: payload.id,
    title: payload.title,
    description: payload.description ?? '',
    thumbnailUrl: payload.thumbnail_url,
    settings,
    lessons,
  }
}
