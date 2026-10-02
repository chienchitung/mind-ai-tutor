'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// Shared look for every report chart. Colors are the validated tokens in
// app/globals.css (--chart-*), so one series always reads the same blue and
// the grid/axes stay a recessive hairline.
export const CHART = {
  series: 'var(--chart-1)',
  seriesSoft: 'var(--chart-1-soft)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  tick: 'var(--chart-tick)',
} as const;

export const AXIS_TICK = { fontSize: 12, fill: CHART.tick };
// Bars are capped so a chart with few categories doesn't turn into blocks.
export const MAX_BAR_SIZE = 22;

// Truncate by rough rendered width: CJK glyphs are about twice as wide as
// Latin ones at the same font size.
export function truncateLabel(label: string, maxUnits = 12) {
  let units = 0;
  const chars = Array.from(label);
  for (let i = 0; i < chars.length; i++) {
    units += /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(chars[i]) ? 1 : 0.55;
    if (units > maxUnits) return `${chars.slice(0, i).join('').trimEnd()}…`;
  }
  return label;
}

// Category tick on one line - Recharts' default tick wraps long labels into
// a cramped second line. The full title stays available on hover.
function CategoryTick({ x, y, payload, maxUnits }: { x?: number; y?: number; payload?: { value: string }; maxUnits: number }) {
  const value = String(payload?.value ?? '');
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill={CHART.tick}>
      <title>{value}</title>
      {truncateLabel(value, maxUnits)}
    </text>
  );
}

// Phones get a narrower label column so the bars keep most of the width.
function useNarrowViewport() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 640px)');
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return narrow;
}

export interface TooltipRow {
  label: string;
  value: string;
  swatch?: string;
}

export function ChartTooltipCard({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="max-w-[260px] rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium leading-snug text-foreground">{title}</p>
      <dl className="space-y-0.5">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <dt className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              {row.swatch && (
                <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: row.swatch }} aria-hidden="true" />
              )}
              <span className="truncate">{row.label}</span>
            </dt>
            <dd className="font-medium tabular-nums text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">{children}</div>
  );
}

export interface RankedBarDatum {
  key: string;
  label: string;
  value: number;
}

const ROW_HEIGHT = 40;
const X_AXIS_BAND = 32;

// One series of categories (lessons) as horizontal bars, so long lesson
// titles stay readable instead of being rotated under the axis. The value
// sits at each bar's tip; the tooltip carries the full title and detail.
export function RankedBarChart({
  data,
  formatValue,
  tooltipRows,
  axisFormatter,
  allowDecimals = true,
}: {
  data: RankedBarDatum[];
  formatValue: (value: number) => string;
  tooltipRows: (datum: RankedBarDatum) => TooltipRow[];
  axisFormatter?: (value: number) => string;
  allowDecimals?: boolean;
}) {
  const height = Math.max(160, data.length * ROW_HEIGHT + X_AXIS_BAND);
  const narrow = useNarrowViewport();

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }}>
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            allowDecimals={allowDecimals}
            tickFormatter={axisFormatter}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={narrow ? 100 : 150}
            tick={<CategoryTick maxUnits={narrow ? 6.5 : 10} />}
            tickLine={false}
            axisLine={{ stroke: CHART.axis }}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
            content={({ active, payload }) => {
              const datum = payload?.[0]?.payload as RankedBarDatum | undefined;
              if (!active || !datum) return null;
              return <ChartTooltipCard title={datum.label} rows={tooltipRows(datum)} />;
            }}
          />
          <Bar dataKey="value" fill={CHART.series} radius={[0, 4, 4, 0]} maxBarSize={MAX_BAR_SIZE} isAnimationActive={false}>
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              fill={CHART.tick}
              fontSize={12}
              formatter={(value: unknown) => formatValue(Number(value))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
