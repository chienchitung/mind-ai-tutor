'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarRange } from 'lucide-react';
import { DATE_RANGES, type DateRange } from '../lib/date-range';

const LABELS: Record<DateRange, { zh: string; en: string }> = {
  all: { zh: '全部期間', en: 'All time' },
  '7d': { zh: '最近 7 天', en: 'Last 7 days' },
  '30d': { zh: '最近 30 天', en: 'Last 30 days' },
  '90d': { zh: '最近 90 天', en: 'Last 90 days' },
};

export function dateRangeLabel(range: DateRange, chinese: boolean) {
  return chinese ? LABELS[range].zh : LABELS[range].en;
}

export function DateRangeSelector({
  value,
  onChange,
  chinese,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  chinese: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <CalendarRange className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <Select value={value} onValueChange={(next) => onChange(next as DateRange)}>
        <SelectTrigger className="w-[150px]" aria-label={chinese ? '資料期間' : 'Date range'}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGES.map(range => (
            <SelectItem key={range} value={range}>{dateRangeLabel(range, chinese)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
