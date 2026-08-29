import { UserProgress } from '@/types/lesson'
import { gameStorageKey } from '@/lib/game-storage'

const PROGRESS_KEY = 'excel_master_progress'

export function getProgress(gameId?: string, initialLessonId?: string): UserProgress {
  if (typeof window === 'undefined') {
    return getInitialProgress(initialLessonId)
  }

  const savedProgress = localStorage.getItem(gameStorageKey(gameId, PROGRESS_KEY))
  if (!savedProgress) {
    return getInitialProgress(initialLessonId)
  }

  return JSON.parse(savedProgress)
}

export function getInitialProgress(initialLessonId?: string): UserProgress {
  return {
    completedLessons: [],
    stars: 0,
    streak: 1,
    level: 1,
    exp: 0,
    dailyProgress: 0,
    currentLesson: initialLessonId ?? "a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c",
    completed: false
  }
}

export function resetProgress(gameId?: string, initialLessonId?: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(
      gameStorageKey(gameId, PROGRESS_KEY),
      JSON.stringify(getInitialProgress(initialLessonId)),
    )
  }
}

export function updateLessonProgress(
  lessonId: string,
  starsEarned: number,
  expEarned: number,
  gameId?: string,
  initialLessonId?: string,
): UserProgress {
  const currentProgress = getProgress(gameId, initialLessonId)

  // Reward claims adjust an already-completed game's balance. Completion
  // rewards below remain idempotent per lesson.
  if (starsEarned < 0) {
    currentProgress.stars = Math.max(0, currentProgress.stars + starsEarned)
    localStorage.setItem(gameStorageKey(gameId, PROGRESS_KEY), JSON.stringify(currentProgress))
    return currentProgress
  }
  
  if (!currentProgress.completedLessons.includes(lessonId)) {
    currentProgress.completedLessons.push(lessonId)
    currentProgress.stars += starsEarned
    currentProgress.exp += expEarned
    currentProgress.dailyProgress += expEarned
    
    // Level up logic
    const newLevel = Math.floor(currentProgress.exp / 100) + 1
    if (newLevel > currentProgress.level) {
      currentProgress.level = newLevel
    }
  }

  localStorage.setItem(gameStorageKey(gameId, PROGRESS_KEY), JSON.stringify(currentProgress))
  return currentProgress
}
