import type { GameLessonOverride } from '../game-engine/src/types/game';
import { normalizeMission } from '../game-engine/src/lib/mission';

export function normalizeLessonOverrides(
  lessonIds: string[],
  overrides: Record<string, GameLessonOverride>,
  lessons: { id: string; description: string }[],
): Record<string, GameLessonOverride> {
  const startsWithIntro = overrides[lessonIds[0]]?.role === 'intro';
  return lessonIds.reduce<Record<string, GameLessonOverride>>((result, lessonId, index) => {
    const lesson = lessons.find(item => item.id === lessonId);
    const existing = overrides[lessonId] ?? {};
    result[lessonId] = {
      ...existing,
      number: startsWithIntro ? index : index + 1,
      role: existing.role ?? 'standard',
      cardDescription: existing.cardDescription ?? lesson?.description ?? '',
    };
    return result;
  }, {});
}

/** Normalize optional story text only on save, not while the teacher types. */
export function serializeLessonOverrides(overrides: Record<string, GameLessonOverride>) {
  return Object.fromEntries(Object.entries(overrides).map(([id, override]) => [id, {
    ...override,
    mission: normalizeMission(override.mission),
  }]));
}
