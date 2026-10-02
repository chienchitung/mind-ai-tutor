import { recordStartTime } from './date-range';

export interface ChartRecord {
  lesson_id: string | number;
  started_at_taipei?: string;
  started_at?: string;
  start_time?: string;
  completed_at_taipei?: string;
  completed_at?: string | null;
  end_time?: string;
  time_spent_seconds?: number;
  duration?: number;
}

type TitleOf = (lessonId: string) => string;

export function recordSeconds(record: ChartRecord): number {
  if (record.time_spent_seconds) return record.time_spent_seconds;
  if (record.duration) return record.duration;
  const start = recordStartTime(record);
  const endValue = record.completed_at_taipei || record.completed_at || record.end_time;
  if (start === null || !endValue) return 0;
  const end = new Date(endValue).getTime();
  return Number.isNaN(end) ? 0 : Math.max(0, (end - start) / 1000);
}

export function isCompleted(record: ChartRecord) {
  return Boolean(record.completed_at_taipei || record.completed_at || record.end_time);
}

export function formatDuration(seconds: number, chinese: boolean) {
  const total = Math.round(seconds);
  if (total < 60) return chinese ? `${total} 秒` : `${total}s`;
  const minutes = Math.round(total / 60);
  if (minutes < 60) return chinese ? `${minutes} 分` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (chinese) return rest ? `${hours} 小時 ${rest} 分` : `${hours} 小時`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export interface LessonTime {
  key: string;
  label: string;
  value: number; // minutes
  seconds: number;
  sessions: number;
}

// Total time per lesson, most time first: the chart answers "where did this
// student's time go", so ranking beats arbitrary record order.
export function timeByLesson(records: ChartRecord[], titleOf: TitleOf): LessonTime[] {
  const groups = new Map<string, LessonTime>();
  for (const record of records) {
    const seconds = recordSeconds(record);
    if (seconds <= 0) continue;
    const key = String(record.lesson_id);
    const group = groups.get(key) ?? { key, label: titleOf(key), value: 0, seconds: 0, sessions: 0 };
    group.seconds += seconds;
    group.sessions += 1;
    groups.set(key, group);
  }
  return Array.from(groups.values())
    .map(group => ({ ...group, value: Math.round((group.seconds / 60) * 10) / 10 }))
    .sort((a, b) => b.seconds - a.seconds);
}

export interface LessonCompletion {
  key: string;
  label: string;
  completed: number;
  total: number;
}

export function completionByLesson(records: ChartRecord[], titleOf: TitleOf): LessonCompletion[] {
  const groups = new Map<string, LessonCompletion>();
  for (const record of records) {
    const key = String(record.lesson_id);
    const group = groups.get(key) ?? { key, label: titleOf(key), completed: 0, total: 0 };
    group.total += 1;
    if (isCompleted(record)) group.completed += 1;
    groups.set(key, group);
  }
  // Lessons with unfinished sessions first - those are the ones to look at.
  return Array.from(groups.values()).sort((a, b) =>
    (a.completed / a.total) - (b.completed / b.total) || b.total - a.total);
}

export interface QuestionCountRow {
  lesson_id: string;
  question_count: number;
}

export function questionsByLesson(rows: QuestionCountRow[], titleOf: TitleOf) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.lesson_id);
    totals.set(key, (totals.get(key) ?? 0) + (row.question_count || 0));
  }
  return Array.from(totals.entries())
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ key, label: titleOf(key), value }))
    .sort((a, b) => b.value - a.value);
}

export type Granularity = 'day' | 'week' | 'month';

export interface ActivityBucket {
  key: string;
  start: number;
  end: number; // exclusive
  minutes: number;
  sessions: number;
  lessons: { label: string; minutes: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function bucketStart(time: number, granularity: Granularity) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  if (granularity === 'week') {
    // Weeks start on Monday.
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  } else if (granularity === 'month') {
    date.setDate(1);
  }
  return date.getTime();
}

function nextBucket(start: number, granularity: Granularity) {
  const date = new Date(start);
  if (granularity === 'day') date.setDate(date.getDate() + 1);
  else if (granularity === 'week') date.setDate(date.getDate() + 7);
  else date.setMonth(date.getMonth() + 1);
  return date.getTime();
}

// Learning minutes over a continuous time axis - empty days/weeks stay in
// as zero so gaps in activity are visible rather than collapsed away. The
// bucket size grows with the span so the chart never needs hundreds of bars.
export function activityOverTime(records: ChartRecord[], titleOf: TitleOf) {
  const dated = records
    .map(record => ({ record, time: recordStartTime(record) }))
    .filter((item): item is { record: ChartRecord; time: number } => item.time !== null);
  if (dated.length === 0) return { granularity: 'day' as Granularity, buckets: [] as ActivityBucket[] };

  const first = Math.min(...dated.map(item => item.time));
  const last = Math.max(...dated.map(item => item.time));
  const spanDays = (last - first) / DAY_MS;
  const granularity: Granularity = spanDays <= 62 ? 'day' : spanDays <= 7 * 104 ? 'week' : 'month';

  const buckets: ActivityBucket[] = [];
  const index = new Map<number, ActivityBucket>();
  for (let start = bucketStart(first, granularity); start <= last; start = nextBucket(start, granularity)) {
    const bucket = { key: String(start), start, end: nextBucket(start, granularity), minutes: 0, sessions: 0, lessons: [] };
    buckets.push(bucket);
    index.set(start, bucket);
  }

  const lessonMinutes = new Map<ActivityBucket, Map<string, number>>();
  for (const { record, time } of dated) {
    const bucket = index.get(bucketStart(time, granularity));
    if (!bucket) continue;
    const minutes = recordSeconds(record) / 60;
    bucket.minutes += minutes;
    bucket.sessions += 1;
    const perLesson = lessonMinutes.get(bucket) ?? new Map<string, number>();
    const label = titleOf(String(record.lesson_id));
    perLesson.set(label, (perLesson.get(label) ?? 0) + minutes);
    lessonMinutes.set(bucket, perLesson);
  }

  for (const bucket of buckets) {
    bucket.minutes = Math.round(bucket.minutes * 10) / 10;
    bucket.lessons = Array.from(lessonMinutes.get(bucket)?.entries() ?? [])
      .map(([label, minutes]) => ({ label, minutes: Math.round(minutes * 10) / 10 }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  return { granularity, buckets };
}

export function bucketLabel(bucket: ActivityBucket, granularity: Granularity) {
  const date = new Date(bucket.start);
  if (granularity === 'month') return `${date.getFullYear()}/${date.getMonth() + 1}`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function bucketRangeLabel(bucket: ActivityBucket, granularity: Granularity, chinese: boolean) {
  const start = new Date(bucket.start);
  const fmt = (date: Date) => `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  if (granularity === 'day') return fmt(start);
  if (granularity === 'month') return chinese ? `${start.getFullYear()} 年 ${start.getMonth() + 1} 月` : `${start.getFullYear()}/${start.getMonth() + 1}`;
  const end = new Date(bucket.end - DAY_MS);
  return `${fmt(start)} – ${end.getMonth() + 1}/${end.getDate()}`;
}
