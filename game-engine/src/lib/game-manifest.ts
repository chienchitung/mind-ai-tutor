import { supabase } from './supabase'
import type { GameDefinition, GameSettings } from '@/types/game'
import type { Lesson } from '@/types/lesson'

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

function mapLesson(row: ManifestLessonRow): Lesson {
  const metadata = row.metadata ?? {}
  const role = asString(metadata.game_role)
  const configuredNumber = asNumber(metadata.game_number)

  return {
    lesson_id: row.id,
    number: configuredNumber ?? row.position,
    title: row.title,
    description: row.description ?? '',
    content: row.teaching_content ?? row.markdown_content ?? '',
    duration: row.duration ? String(row.duration) : undefined,
    role: role === 'intro' || role === 'final' ? role : 'standard',
    isFinal: role === 'final',
    showGame: role === 'final' || Boolean(row.genially_link),
    geniallyLink: row.genially_link,
    teachingContent: row.teaching_content,
    markdownContent: row.markdown_content,
    practiceExercises: row.practice_exercises,
    metadata,
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

  const lessons = (payload.lessons ?? []).map(mapLesson)

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
    settings: payload.settings ?? {},
    lessons,
  }
}
