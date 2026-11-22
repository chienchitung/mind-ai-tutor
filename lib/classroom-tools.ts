// Classroom tools (course timer and random presentation order). Settings
// live in this browser only: they are a teacher's own screen preferences,
// not class records.

export const MIN_GROUPS = 2;
export const MAX_GROUPS = 20;
export const MAX_TIMER_MINUTES = 180;
export const TIMER_PRESETS_MINUTES = [3, 5, 10, 15] as const;
const STORAGE_KEY = 'classroom-tools:v1';

export interface ClassroomToolSettings {
  courseName: string;
  durationSeconds: number;
  groupNames: string[];
  muted: boolean;
  /** The tool on screen. */
  tab: 'timer' | 'groups';
}

export function defaultGroupName(index: number, zh: boolean): string {
  return zh ? `第 ${index + 1} 組` : `Group ${index + 1}`;
}

export function defaultSettings(zh: boolean): ClassroomToolSettings {
  return {
    courseName: '',
    durationSeconds: 5 * 60,
    groupNames: Array.from({ length: 4 }, (_, index) => defaultGroupName(index, zh)),
    muted: false,
    tab: 'timer',
  };
}

export const clampGroupCount = (count: number) =>
  Math.min(MAX_GROUPS, Math.max(MIN_GROUPS, Math.round(Number.isFinite(count) ? count : MIN_GROUPS)));

export const clampSeconds = (seconds: number) =>
  Math.min(MAX_TIMER_MINUTES * 60, Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0)));

/** Keeps the names already typed, adds default ones, or drops the last ones. */
export function resizeGroups(names: string[], count: number, zh: boolean): string[] {
  const size = clampGroupCount(count);
  return Array.from({ length: size }, (_, index) => names[index] ?? defaultGroupName(index, zh));
}

/** An unbiased shuffle (Fisher–Yates); `random` is injectable for tests. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${String(minutes).padStart(2, '0')}:${rest}`;
}

export function loadSettings(zh: boolean): ClassroomToolSettings {
  const fallback = defaultSettings(zh);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const value = JSON.parse(raw) as Partial<ClassroomToolSettings>;
    const names = Array.isArray(value.groupNames) ? value.groupNames.filter((name): name is string => typeof name === 'string').map((name) => name.slice(0, 40)) : fallback.groupNames;
    return {
      courseName: typeof value.courseName === 'string' ? value.courseName.slice(0, 80) : '',
      durationSeconds: typeof value.durationSeconds === 'number' && value.durationSeconds > 0 ? clampSeconds(value.durationSeconds) : fallback.durationSeconds,
      groupNames: resizeGroups(names, names.length, zh),
      muted: value.muted === true,
      tab: value.tab === 'groups' ? 'groups' : 'timer',
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(settings: ClassroomToolSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private windows or blocked storage: the tools still work, just unsaved.
  }
}
