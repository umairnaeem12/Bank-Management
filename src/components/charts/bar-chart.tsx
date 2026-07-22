'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CategoryPoint } from '@/hooks/use-bank-data';
import { chartChrome, chartSeries, statusSeriesColor } from '@/lib/charts/palette';
import { formatNumber, titleCase } from '@/lib/utils/format';
import { ChartEmpty, ChartTooltip, useIsDarkChart } from './chart-primitives';

export interface CategoryBarChartProps {
  data: CategoryPoint[];
  height?: number;
  formatValue?: (value: number) => string;
  /** Horizontal bars read better when category names are long. */
  layout?: 'vertical' | 'horizontal';
  useStatusColors?: boolean;
}

export function CategoryBarChart({
  data,
  height = 260,
  formatValue = (v) => formatNumber(v, true),
  layout = 'vertical',
  useStatusColors = false,
}: CategoryBarChartProps) {
  const isDark = useIsDarkChart();
  const palette = chartSeries(isDark);
  const chrome = chartChrome(isDark);

  if (data.length === 0) return <ChartEmpty />;

  const colorFor = (point: CategoryPoint, index: number) =>
    useStatusColors ? statusSeriesColor(point.name, isDark) : palette[index % palette.length];

  const isHorizontal = layout === 'horizontal';
  const labelled = data.map((d) => ({ ...d, label: titleCase(d.name) }));

  const tooltip = (
    <Tooltip
      cursor={{ fill: isDark ? '#ffffff0a' : '#0f172a08' }}
      content={(props) => {
        const { active, payload } = props as unknown as {
          active?: boolean;
          payload?: ReadonlyArray<{ value?: number; payload?: { name: string; label: string } }>;
        };
        if (!active || !payload?.length) return null;

        const name = payload[0].payload?.name ?? '';
        const index = data.findIndex((d) => d.name === name);

        return (
          <ChartTooltip
            entries={[
              {
                name: payload[0].payload?.label ?? titleCase(name),
                value: Number(payload[0].value ?? 0),
                color: colorFor(data[index] ?? data[0], index < 0 ? 0 : index),
              },
            ]}
            isDark={isDark}
            formatValue={formatValue}
          />
        );
      }}
    />
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      {isHorizontal ? (
        <BarChart data={labelled} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={chrome.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            stroke={chrome.axis}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={formatValue}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke={chrome.axis}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            width={96}
          />
          {tooltip}
          {/* Rounded data-end anchored to the baseline. */}
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {labelled.map((point, index) => (
              <Cell key={point.name} fill={colorFor(point, index)} />
            ))}
          </Bar>
        </BarChart>
      ) : (
        <BarChart data={labelled} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={chrome.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke={chrome.axis}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            dy={6}
          />
          <YAxis
            stroke={chrome.axis}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            width={64}
            tickFormatter={formatValue}
          />
          {tooltip}
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44}>
            {labelled.map((point, index) => (
              <Cell key={point.name} fill={colorFor(point, index)} />
            ))}
          </Bar>
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
