export const DATE_RANGES = ['all', '7d', '30d', '90d'] as const;
export type DateRange = (typeof DATE_RANGES)[number];

const RANGE_DAYS: Record<Exclude<DateRange, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

interface DatedRecord {
  started_at_taipei?: string;
  started_at?: string;
  start_time?: string;
}

export function recordStartTime(record: DatedRecord): number | null {
  const value = record.started_at_taipei || record.started_at || record.start_time;
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

// Earliest timestamp a range includes, or null for "all".
export function rangeStart(range: DateRange, now = Date.now()): number | null {
  return range === 'all' ? null : now - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
}

// Undated records only appear under "all": a range filter can't place them,
// and silently counting them in "last 7 days" would inflate that view.
export function filterByDateRange<T extends DatedRecord>(records: T[], range: DateRange, now = Date.now()): T[] {
  const since = rangeStart(range, now);
  if (since === null) return records;
  return records.filter(record => {
    const time = recordStartTime(record);
    return time !== null && time >= since;
  });
}
