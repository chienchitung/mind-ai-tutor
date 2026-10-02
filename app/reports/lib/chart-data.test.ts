import { describe, expect, it } from 'vitest';
import {
  activityOverTime, bucketLabel, completionByLesson, formatDuration, questionsByLesson, timeByLesson,
} from './chart-data';

const titleOf = (id: string) => ({ a: '第一課', b: '第二課' }[id] ?? id);

describe('timeByLesson', () => {
  it('sums time per lesson and ranks by time spent', () => {
    expect(timeByLesson([
      { lesson_id: 'a', time_spent_seconds: 300 },
      { lesson_id: 'b', time_spent_seconds: 900 },
      { lesson_id: 'a', time_spent_seconds: 90 },
      { lesson_id: 'b' },
    ], titleOf)).toEqual([
      { key: 'b', label: '第二課', value: 15, seconds: 900, sessions: 1 },
      { key: 'a', label: '第一課', value: 6.5, seconds: 390, sessions: 2 },
    ]);
  });

  it('falls back to start/end times when no duration is stored', () => {
    expect(timeByLesson([
      { lesson_id: 'a', started_at: '2025-09-20T10:00:00', completed_at: '2025-09-20T10:05:00' },
    ], titleOf)[0].seconds).toBe(300);
  });
});

describe('completionByLesson', () => {
  it('counts completed sessions per lesson, unfinished lessons first', () => {
    expect(completionByLesson([
      { lesson_id: 'a', completed_at: '2025-09-20T10:05:00' },
      { lesson_id: 'b', completed_at: '2025-09-20T10:05:00' },
      { lesson_id: 'b', completed_at: null },
    ], titleOf)).toEqual([
      { key: 'b', label: '第二課', completed: 1, total: 2 },
      { key: 'a', label: '第一課', completed: 1, total: 1 },
    ]);
  });
});

describe('questionsByLesson', () => {
  it('sums question counts per lesson and drops empty lessons', () => {
    expect(questionsByLesson([
      { lesson_id: 'a', question_count: 2 },
      { lesson_id: 'a', question_count: 3 },
      { lesson_id: 'b', question_count: 0 },
    ], titleOf)).toEqual([{ key: 'a', label: '第一課', value: 5 }]);
  });
});

describe('activityOverTime', () => {
  it('keeps empty days in a short span so gaps stay visible', () => {
    const { granularity, buckets } = activityOverTime([
      { lesson_id: 'a', started_at: '2025-09-20T10:00:00', time_spent_seconds: 600 },
      { lesson_id: 'b', started_at: '2025-09-22T09:00:00', time_spent_seconds: 300 },
      { lesson_id: 'a', started_at: '2025-09-22T15:00:00', time_spent_seconds: 120 },
    ], titleOf);
    expect(granularity).toBe('day');
    expect(buckets.map(b => [bucketLabel(b, granularity), b.minutes, b.sessions])).toEqual([
      ['9/20', 10, 1], ['9/21', 0, 0], ['9/22', 7, 2],
    ]);
    expect(buckets[2].lessons).toEqual([{ label: '第二課', minutes: 5 }, { label: '第一課', minutes: 2 }]);
  });

  it('switches to weekly buckets for long spans', () => {
    const { granularity, buckets } = activityOverTime([
      { lesson_id: 'a', started_at: '2025-05-05T10:00:00', time_spent_seconds: 60 },
      { lesson_id: 'a', started_at: '2025-09-01T10:00:00', time_spent_seconds: 60 },
    ], titleOf);
    expect(granularity).toBe('week');
    expect(buckets).toHaveLength(18);
    expect(buckets.filter(b => b.sessions > 0)).toHaveLength(2);
  });

  it('returns nothing for undated records', () => {
    expect(activityOverTime([{ lesson_id: 'a', time_spent_seconds: 60 }], titleOf).buckets).toEqual([]);
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(45, true)).toBe('45 秒');
    expect(formatDuration(780, true)).toBe('13 分');
    expect(formatDuration(3900, true)).toBe('1 小時 5 分');
    expect(formatDuration(3600, false)).toBe('1h');
  });
});
