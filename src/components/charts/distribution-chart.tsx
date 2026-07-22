'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryPoint } from '@/hooks/use-bank-data';
import { chartSeries, statusSeriesColor } from '@/lib/charts/palette';
import { formatNumber, titleCase } from '@/lib/utils/format';
import { ChartEmpty, ChartTooltip, useIsDarkChart } from './chart-primitives';

export interface DonutChartProps {
  data: CategoryPoint[];
  height?: number;
  /** Formats the tooltip and centre total. */
  formatValue?: (value: number) => string;
  /** Centre label; the total is rendered beneath it. */
  centerLabel?: string;
  /** Use reserved status colours instead of the categorical ramp. */
  useStatusColors?: boolean;
}

/**
 * Donut for part-to-whole breakdowns.
 *
 * Every slice is direct-labelled in the adjacent list, so the chart never
 * relies on colour alone to convey identity.
 */
export function DonutChart({
  data,
  height = 260,
  formatValue = (v) => formatNumber(v),
  centerLabel = 'Total',
  useStatusColors = false,
}: DonutChartProps) {
  const isDark = useIsDarkChart();
  const palette = chartSeries(isDark);

  if (data.length === 0 || data.every((d) => d.value === 0)) return <ChartEmpty />;

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const colorFor = (point: CategoryPoint, index: number) =>
    useStatusColors ? statusSeriesColor(point.name, isDark) : palette[index % palette.length];

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              // A 2px gap between segments keeps adjacent fills legible.
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((point, index) => (
                <Cell key={point.name} fill={colorFor(point, index)} />
              ))}
            </Pie>

            <Tooltip
              content={(props) => {
                const { active, payload } = props as unknown as {
                  active?: boolean;
                  payload?: ReadonlyArray<{ name?: string; value?: number; payload?: CategoryPoint }>;
                };
                if (!active || !payload?.length) return null;

                const item = payload[0];
                const name = String(item.name ?? '');
                const index = data.findIndex((d) => d.name === name);

                return (
                  <ChartTooltip
                    entries={[
                      {
                        name: titleCase(name),
                        value: Number(item.value ?? 0),
                        color: colorFor(data[index] ?? data[0], index < 0 ? 0 : index),
                      },
                    ]}
                    isDark={isDark}
                    formatValue={formatValue}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre total — the headline the donut is answering. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-medium tracking-wide text-muted-text uppercase">
            {centerLabel}
          </span>
          <span className="text-lg font-semibold text-primary-text tabular">
            {formatValue(total)}
          </span>
        </div>
      </div>

      {/* Direct labels — the secondary encoding that discharges the contrast WARN. */}
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {data.map((point, index) => {
          const share = total > 0 ? (point.value / total) * 100 : 0;

          return (
            <li key={point.name} className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: colorFor(point, index) }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-xs text-secondary-text">
                {titleCase(point.name)}
              </span>
              <span className="text-xs font-medium text-primary-text tabular">
                {formatValue(point.value)}
              </span>
              <span className="w-10 text-right text-xs text-muted-text tabular">
                {share.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
