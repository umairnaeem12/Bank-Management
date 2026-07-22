'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyPoint } from '@/hooks/use-bank-data';
import { chartChrome, chartSeries } from '@/lib/charts/palette';
import { formatNumber } from '@/lib/utils/format';
import { ChartEmpty, ChartLegend, ChartTooltip, useIsDarkChart, type TooltipEntry } from './chart-primitives';

const SERIES = [
  { key: 'deposits', label: 'Deposits', slot: 0 },
  { key: 'withdrawals', label: 'Withdrawals', slot: 2 },
  { key: 'transfers', label: 'Transfers', slot: 1 },
] as const;

/**
 * Twelve-month money-movement trend.
 *
 * Single y-axis by design: all three series are the same measure (money moved
 * per month), so they share a scale and remain directly comparable.
 */
export function CashflowChart({ data, height = 300 }: { data: MonthlyPoint[]; height?: number }) {
  const isDark = useIsDarkChart();
  const palette = chartSeries(isDark);
  const chrome = chartChrome(isDark);

  const hasData = data.some((d) => d.deposits > 0 || d.withdrawals > 0 || d.transfers > 0);
  if (!hasData) return <ChartEmpty />;

  const legendItems = SERIES.map((s) => ({ label: s.label, color: palette[s.slot] }));

  return (
    <div>
      <ChartLegend items={legendItems} className="mb-4 justify-end" />

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <defs>
            {SERIES.map((series) => (
              <linearGradient
                key={series.key}
                id={`fill-${series.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={palette[series.slot]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={palette[series.slot]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid stroke={chrome.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
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
            tickFormatter={(value: number) => formatNumber(value, true)}
          />

          <Tooltip
            cursor={{ stroke: chrome.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
            content={(props) => {
              const { active, payload, label } = props as unknown as {
                active?: boolean;
                label?: string;
                payload?: ReadonlyArray<{ name?: string; value?: number; color?: string }>;
              };
              if (!active || !payload?.length) return null;

              const entries: TooltipEntry[] = payload.map((item, i) => ({
                name: String(item.name ?? SERIES[i].label),
                value: Number(item.value ?? 0),
                color: item.color ?? palette[i],
              }));

              return (
                <ChartTooltip
                  label={label}
                  entries={entries}
                  isDark={isDark}
                  formatValue={(v) => `$${formatNumber(v)}`}
                />
              );
            }}
          />

          {SERIES.map((series) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={palette[series.slot]}
              strokeWidth={2}
              fill={`url(#fill-${series.key})`}
              // Points appear on hover only; a dot on every month is noise.
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: chrome.tooltipBg }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
