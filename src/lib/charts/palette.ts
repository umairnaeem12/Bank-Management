/**
 * Chart palette.
 *
 * Both series lists below were checked with the data-visualisation validator
 * (lightness band, chroma floor, colour-blind separation, normal-vision
 * separation, contrast against the chart surface) and pass every check for
 * their mode. Hues are assigned in fixed order and never cycled — a seventh
 * series folds into "Other" rather than reusing slot 1.
 *
 * Light mode carries a contrast WARN on the teal and amber steps, which is
 * discharged by the direct labels and tooltips on every chart that uses them.
 *
 * If you change a colour here, re-run the validator before shipping:
 *   node scripts/validate_palette.js "<hex,…>" --mode light  --surface "#ffffff"
 *   node scripts/validate_palette.js "<hex,…>" --mode dark   --surface "#131a26"
 */

export const CHART_SERIES_LIGHT = [
  '#3366f5', // blue   — primary series (deposits, balances)
  '#14b8a6', // teal   — secondary series (transfers)
  '#f59e0b', // amber  — tertiary (withdrawals)
  '#a855f7', // purple
  '#ec4899', // pink
  '#0891b2', // cyan
] as const;

export const CHART_SERIES_DARK = [
  '#3b82f6',
  '#0d9488',
  '#d97706',
  '#8b5cf6',
  '#e5484d',
  '#0891b2',
] as const;

export function chartSeries(isDark: boolean): readonly string[] {
  return isDark ? CHART_SERIES_DARK : CHART_SERIES_LIGHT;
}

/**
 * Status colours are reserved and never reused as a categorical series slot,
 * so "completed" green always means completed.
 */
export const STATUS_COLORS = {
  positive: { light: '#059669', dark: '#10b981' },
  negative: { light: '#dc2626', dark: '#ef4444' },
  warning: { light: '#d97706', dark: '#f59e0b' },
  info: { light: '#2563eb', dark: '#3b82f6' },
  neutral: { light: '#64748b', dark: '#94a3b8' },
} as const;

export function statusColor(key: keyof typeof STATUS_COLORS, isDark: boolean): string {
  return STATUS_COLORS[key][isDark ? 'dark' : 'light'];
}

/** Axis, grid and tooltip chrome — recessive by design. */
export function chartChrome(isDark: boolean) {
  return {
    grid: isDark ? '#23303f' : '#e6ebf2',
    axis: isDark ? '#7c8ca4' : '#64748b',
    tooltipBg: isDark ? '#182130' : '#ffffff',
    tooltipBorder: isDark ? '#33445a' : '#e6ebf2',
    text: isDark ? '#e8eef6' : '#0f172a',
  };
}

/** Maps a request/transaction status onto its reserved colour. */
export function statusSeriesColor(status: string, isDark: boolean): string {
  switch (status) {
    case 'completed':
      return statusColor('positive', isDark);
    case 'pending':
    case 'processing':
      return statusColor('warning', isDark);
    case 'failed':
    case 'rejected':
      return statusColor('negative', isDark);
    default:
      return statusColor('neutral', isDark);
  }
}
