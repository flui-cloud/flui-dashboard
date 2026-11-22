/**
 * Chart Models and Interfaces
 * Shared types for all chart components
 */

import tokens from '../../../../theme/tokens.json';

const c = (primitive: keyof typeof tokens.primitives): string => tokens.primitives[primitive];

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
    warning: number; // Value above which shows warning color
    danger: number; // Value above which shows danger color
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
 * Chart colors come from the console tokens: charts draw on canvas, where CSS variables do not reach.
 */
export const DEFAULT_CHART_COLORS: ChartColorScheme = {
  success: [c('green-700'), c('green-400'), c('green-200')],
  warning: [c('amber-700'), c('amber-400'), c('amber-200')],
  danger: [c('red-700'), c('red-400'), c('red-200')],
  info: [c('blue-600'), c('blue-400'), c('blue-200')],
  neutral: [c('gray-600'), c('gray-500'), c('gray-300')],
  gradient: {
    success: [c('green-700'), c('green-400')],
    warning: [c('amber-700'), c('amber-400')],
    danger: [c('red-700'), c('red-400')],
    info: [c('blue-600'), c('blue-400')],
  },
};

/**
 * Default configuration values
 */
export const DEFAULT_GAUGE_CONFIG: Required<
  Omit<GaugeChartConfig, 'theme' | 'thresholds' | 'severity' | 'valueFormatter'>
> = {
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
  showArea?: boolean; // Fill area under line
  smooth?: boolean; // Smooth curve vs angular line
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
  /**
   * Draw the data's title inside the plot. Off where the card around the chart
   * already names it: the same words twice cost a line of height and read as
   * two different things.
   */
  showTitle?: boolean;
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
export const DEFAULT_TIMESERIES_CONFIG: Required<
  Omit<
    TimeSeriesChartConfig,
    'theme' | 'yMin' | 'yMax' | 'valueFormatter' | 'timeFormatter' | 'thresholds'
  >
> = {
  height: '300px',
  animated: true,
  responsive: true,
  showGrid: true,
  showLegend: true,
  enableZoom: false,
  timeRange: '1h',
  unit: '',
  showDataPoints: false,
  showTitle: true,
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
export const DEFAULT_MULTISTAT_CONFIG: Required<
  Omit<MultiStatCardConfig, 'theme' | 'showSparkline'>
> = {
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
  duration?: number; // Duration in milliseconds
  message?: string; // Incident description
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
export const DEFAULT_DONUT_CONFIG: Required<
  Omit<ProportionDonutConfig, 'theme' | 'valueFormatter' | 'roseType'>
> = {
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
 * Distribution charts tell slices apart by lightness within the accent and neutral ramps, never by a
 * new hue: the console keeps one accent, and green, amber and red for state only.
 */
export const DISTRIBUTION_PALETTE = [
  c('blue-600'),
  c('gray-700'),
  c('blue-300'),
  c('gray-500'),
  c('blue-800'),
  c('gray-300'),
  c('blue-400'),
  c('gray-600'),
  c('blue-200'),
  c('gray-800'),
  c('blue-500'),
  c('gray-200'),
];

/**
 * Per-node series palette for cluster metrics, assigned by node index in this fixed order. The first
 * node takes the accent, the rest step through neutral and lighter accent so nodes differ by
 * lightness, not hue; past four nodes the charts summarise rather than name each node by color.
 */
export const NODE_SERIES_COLORS = [c('blue-600'), c('gray-700'), c('blue-300'), c('gray-500')];

/** Horizontal usage bar with optional warning/danger tick marks. */
export interface MeterBarConfig {
  warning?: number;
  danger?: number;
  /** Width of the track in pixels; omit to fill the container. */
  width?: number;
  height?: number;
}

/** A compact headline figure with a sparkline underneath. */
export interface StatTileData {
  label: string;
  value: string;
  unit?: string;
  /** Signed change against the window's typical value, already formatted. */
  delta?: string;
  deltaTone?: 'up' | 'down' | 'flat';
  /** What the change is measured against, e.g. "vs typical in the last hour". */
  deltaHint?: string;
  footnote?: string;
  /** Left out when the figure has no history to draw; an empty one reads "no history yet". */
  spark?: number[];
  color?: string;
  /** One line of explanation behind an info icon next to the label. */
  hint?: string;
  /** Remarks under the value in neutral text, marked by a dot: amber, red when bad, none when muted. */
  notes?: StatTileNote[];
}

export interface StatTileNote {
  text: string;
  hint?: string;
  kind?: 'line' | 'chip';
  tone?: 'warn' | 'bad' | 'muted';
}
