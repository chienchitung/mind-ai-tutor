import { describe, expect, it } from 'vitest';
import { filterByDateRange } from './date-range';

const now = new Date('2026-10-02T12:00:00Z').getTime();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

const records = [
  { id: 'today', started_at_taipei: daysAgo(0) },
  { id: '5d', started_at: daysAgo(5) },
  { id: '20d', start_time: daysAgo(20) },
  { id: '60d', started_at_taipei: daysAgo(60) },
  { id: '200d', started_at_taipei: daysAgo(200) },
  { id: 'undated' },
  { id: 'bad-date', started_at_taipei: 'not a date' },
];

const ids = (list: { id: string }[]) => list.map(r => r.id);

describe('filterByDateRange', () => {
  it('keeps everything, including undated records, for "all"', () => {
    expect(filterByDateRange(records, 'all', now)).toBe(records);
  });

  it('filters by each preset window using whichever start field is present', () => {
    expect(ids(filterByDateRange(records, '7d', now))).toEqual(['today', '5d']);
    expect(ids(filterByDateRange(records, '30d', now))).toEqual(['today', '5d', '20d']);
    expect(ids(filterByDateRange(records, '90d', now))).toEqual(['today', '5d', '20d', '60d']);
  });

  it('excludes undated or unparseable records from bounded ranges', () => {
    const result = ids(filterByDateRange(records, '90d', now));
    expect(result).not.toContain('undated');
    expect(result).not.toContain('bad-date');
  });
});
