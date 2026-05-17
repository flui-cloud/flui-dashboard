/**
 * Chart Models and Interfaces
 * Shared types for all chart components
 */

/**
 * Theme options for charts
 */
export type ChartTheme = 'light' | 'dark';

/**
 * Color severity levels for metrics
 */
export type MetricSeverity = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * Base configuration for all chart components
 */
export interface BaseChartConfig {
  /** Chart theme (auto-detected from system if not provided) */
  theme?: ChartTheme;
  /** Chart height (CSS value) */
  height?: string;
  /** Enable animations */
  animated?: boolean;
  /** Make chart responsive to container size */
  responsive?: boolean;
}

/**
 * Color scheme for different metric severities
 */
export interface ChartColorScheme {
  success: string[];
  warning: string[];
  danger: string[];
  info: string[];
  neutral: string[];
  gradient?: {
    success: [string, string];
    warning: [string, string];
    danger: [string, string];
    info: [string, string];
  };
}

/**
 * Configuration for gauge charts (ring and grade)
 */
export interface GaugeChartConfig extends BaseChartConfig {
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Show value label in center */
  showValue?: boolean;
  /** Show title above/below gauge */
  showTitle?: boolean;
  /** Custom format for value display */
  valueFormatter?: (value: number) => string;
  /** Unit of measurement (%, GB, ms, etc.) */
  unit?: string;
  /** Severity thresholds for color coding */
  thresholds?: {
    warning: number;  // Value above which shows warning color
    danger: number;   // Value above which shows danger color
  };
  /** Fixed severity (overrides threshold-based color) */
  severity?: MetricSeverity;
}

/**
 * Data for gauge charts
 */
export interface GaugeChartData {
  /** Current value */
  value: number;
  /** Chart title/label */
  title: string;
  /** Subtitle or additional info */
  subtitle?: string;
  /** Previous value for trend calculation */
  previousValue?: number;
}

/**
 * Default color scheme matching Tailwind theme
 */
export const DEFAULT_CHART_COLORS: ChartColorScheme = {
  success: ['#10b981', '#34d399', '#6ee7b7'],
  warning: ['#f59e0b', '#fbbf24', '#fcd34d'],
  danger: ['#ef4444', '#f87171', '#fca5a5'],
  info: ['#3b82f6', '#60a5fa', '#93c5fd'],
  neutral: ['#6b7280', '#9ca3af', '#d1d5db'],
  gradient: {
    success: ['#10b981', '#34d399'],
    warning: ['#f59e0b', '#fbbf24'],
    danger: ['#ef4444', '#f87171'],
    info: ['#3b82f6', '#60a5fa'],
  }
};

/**
 * Default configuration values
 */
export const DEFAULT_GAUGE_CONFIG: Required<Omit<GaugeChartConfig, 'theme' | 'thresholds' | 'severity' | 'valueFormatter'>> = {
  min: 0,
  max: 100,
  height: '240px',
  animated: true,
  responsive: true,
  showValue: true,
  showTitle: true,
  unit: '%',
};

/**
 * Time range options for time series charts
 */
export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

/**
 * Data point for time series
 */
export interface TimeSeriesDataPoint {
  timestamp: Date | number;
  value: number;
}

/**
 * Series for time series chart (can have multiple series)
 */
export interface TimeSeriesSeries {
  name: string;
  data: TimeSeriesDataPoint[];
  color?: string;
  showArea?: boolean;  // Fill area under line
  smooth?: boolean;    // Smooth curve vs angular line
}

/**
 * Configuration for time series line charts
 */
export interface TimeSeriesChartConfig extends BaseChartConfig {
  /** Show grid lines */
  showGrid?: boolean;
  /** Show legend for multiple series */
  showLegend?: boolean;
  /** Enable zoom/pan */
  enableZoom?: boolean;
  /** Time range selector */
  timeRange?: TimeRange;
  /** Y-axis min value */
  yMin?: number;
  /** Y-axis max value */
  yMax?: number;
  /** Unit of measurement */
  unit?: string;
  /** Custom value formatter */
  valueFormatter?: (value: number) => string;
  /** Custom time formatter */
  timeFormatter?: (timestamp: Date) => string;
  /** Show data points (circles on line) */
  showDataPoints?: boolean;
  /** Threshold lines (horizontal lines at specific values) */
  thresholds?: {
    warning?: number;
    danger?: number;
  };
}

/**
 * Data for time series chart
 */
export interface TimeSeriesChartData {
  title: string;
  series: TimeSeriesSeries[];
}

/**
 * Default time series configuration
 */
export const DEFAULT_TIMESERIES_CONFIG: Required<Omit<TimeSeriesChartConfig, 'theme' | 'yMin' | 'yMax' | 'valueFormatter' | 'timeFormatter' | 'thresholds'>> = {
  height: '300px',
  animated: true,
  responsive: true,
  showGrid: true,
  showLegend: true,
  enableZoom: false,
  timeRange: '1h',
  unit: '',
  showDataPoints: false,
};

/**
 * Single stat item for MultiStatCard
 */
export interface StatItem {
  label: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  severity?: MetricSeverity;
}

/**
 * Configuration for multi-stat card
 */
export interface MultiStatCardConfig extends BaseChartConfig {
  /** Layout direction */
  layout?: 'horizontal' | 'vertical' | 'grid';
  /** Show trend indicators */
  showTrend?: boolean;
  /** Show mini sparklines */
  showSparkline?: boolean;
}

/**
 * Data for multi-stat card
 */
export interface MultiStatCardData {
  title: string;
  subtitle?: string;
  stats: StatItem[];
}

/**
 * Default multi-stat configuration
 */
export const DEFAULT_MULTISTAT_CONFIG: Required<Omit<MultiStatCardConfig, 'theme' | 'showSparkline'>> = {
  height: 'auto',
  animated: true,
  responsive: true,
  layout: 'horizontal',
  showTrend: true,
};

/**
 * Status for timeline events
 */
export type TimelineStatus = 'up' | 'down' | 'degraded' | 'maintenance';

/**
 * Event in status timeline
 */
export interface TimelineEvent {
  timestamp: Date | number;
  status: TimelineStatus;
  duration?: number;  // Duration in milliseconds
  message?: string;   // Incident description
}

/**
 * Configuration for status timeline
 */
export interface StatusTimelineConfig extends BaseChartConfig {
  /** Show uptime percentage */
  showUptimePercentage?: boolean;
  /** Number of days to show */
  daysToShow?: number;
  /** Compact mode (smaller blocks) */
  compact?: boolean;
}

/**
 * Data for status timeline
 */
export interface StatusTimelineData {
  title: string;
  subtitle?: string;
  events: TimelineEvent[];
  uptimePercentage?: number;
}

/**
 * Default status timeline configuration
 */
export const DEFAULT_TIMELINE_CONFIG: Required<Omit<StatusTimelineConfig, 'theme'>> = {
  height: 'auto',
  animated: true,
  responsive: true,
  showUptimePercentage: true,
  daysToShow: 90,
  compact: false,
};

/**
 * Single slice/segment in a distribution chart
 */
export interface DistributionSlice {
  name: string;
  value: number;
  color?: string;
}

/**
 * Configuration for proportion donut chart
 */
export interface ProportionDonutConfig extends BaseChartConfig {
  /** Show legend */
  showLegend?: boolean;
  /** Legend position */
  legendPosition?: 'bottom' | 'right' | 'top';
  /** Unit of measurement (GB, %, etc.) */
  unit?: string;
  /** Custom value formatter for tooltip/labels */
  valueFormatter?: (value: number, percent: number) => string;
  /** Inner radius ratio (0 = pie, 0.6 = donut). Default 0.4 */
  innerRadius?: number;
  /** Show label lines outside slices (classic style with connecting lines). Disables legend when true. */
  showLabels?: boolean;
  /** Padding angle between slices in degrees (0-10). Default 5 for modern look */
  padAngle?: number;
  /** Border radius for each slice (px). Default 10 */
  borderRadius?: number;
  /** Rose/Nightingale chart type: 'radius' (radius varies) or 'area' (area varies) */
  roseType?: 'radius' | 'area';
}

/**
 * Data for proportion donut chart
 */
export interface ProportionDonutData {
  title: string;
  subtitle?: string;
  slices: DistributionSlice[];
}

/**
 * Default proportion donut configuration
 */
export const DEFAULT_DONUT_CONFIG: Required<Omit<ProportionDonutConfig, 'theme' | 'valueFormatter' | 'roseType'>> = {
  height: '380px',
  animated: true,
  responsive: true,
  showLegend: true,
  legendPosition: 'top',
  unit: '',
  innerRadius: 0.4,
  showLabels: false,
  padAngle: 5,
  borderRadius: 10,
};

/**
 * Configuration for proportion bar chart (horizontal stacked)
 */
export interface ProportionBarConfig extends BaseChartConfig {
  /** Show legend */
  showLegend?: boolean;
  /** Unit of measurement */
  unit?: string;
  /** Custom value formatter for tooltip */
  valueFormatter?: (value: number, percent: number) => string;
  /** Bar thickness in px */
  barHeight?: number;
  /** Show percentage labels inside bar segments */
  showPercentLabels?: boolean;
}

/**
 * Data for proportion bar chart
 */
export interface ProportionBarData {
  title: string;
  subtitle?: string;
  slices: DistributionSlice[];
}

/**
 * Default proportion bar configuration
 */
export const DEFAULT_BAR_CONFIG: Required<Omit<ProportionBarConfig, 'theme' | 'valueFormatter'>> = {
  height: 'auto',
  animated: true,
  responsive: true,
  showLegend: true,
  unit: '',
  barHeight: 32,
  showPercentLabels: true,
};

// ─── Log Volume Histogram ────────────────────────────────────────────────────

/**
 * A single bucket/point in a log level series
 */
export interface LogVolumeBucket {
  /** Unix timestamp in seconds */
  timestamp: number;
  datetime: string;
  count: number;
}

/**
 * One series per log level (error, warn, info, debug, trace)
 */
export interface LogVolumeLevelSeries {
  level: string;
  series: LogVolumeBucket[];
}

/**
 * Input data for LogVolumeHistogramComponent (mirrors AppLogVolumeResponseDto)
 */
export interface LogVolumeData {
  range_start: string;
  range_end: string;
  series: LogVolumeLevelSeries[];
}

/**
 * Emitted when the user selects a brush range on the histogram
 */
export interface LogVolumeRangeSelection {
  start: Date;
  end: Date;
}

/**
 * Configuration for LogVolumeHistogramComponent
 */
export interface LogVolumeHistogramConfig extends BaseChartConfig {
  /** Show legend */
  showLegend?: boolean;
  /**
   * Optional sub-range to highlight on the chart (e.g. after a brush selection).
   * Drawn as a semi-transparent overlay via ECharts markArea.
   */
  highlightRange?: { start: Date; end: Date } | null;
}

export const LOG_LEVEL_COLORS: Record<string, string> = {
  error: '#ef4444',
  warn:  '#f59e0b',
  info:  '#3b82f6',
  debug: '#6b7280',
  trace: '#8b5cf6',
};

/**
 * Default color palette for distribution charts (12 distinguishable colors)
 */
export const DISTRIBUTION_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#a855f7', // purple
  '#84cc16', // lime
];
