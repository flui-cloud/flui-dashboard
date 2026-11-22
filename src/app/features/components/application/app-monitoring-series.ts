import {
  DEFAULT_CHART_COLORS,
  TimeSeriesChartConfig,
  TimeSeriesChartData,
  TimeSeriesDataPoint,
  TimeSeriesSeries,
} from '../../../shared/components/charts';
import type { AppHistoryPoint } from '../../model/application.models';
import type { TrafficRange } from './app-traffic-section.component';

export type MonitoringTimeRange = '1h' | '2h' | '3h' | '6h' | '1d';

/** One config object per size, held stable so a 5s poll never re-applies chart options. */
export type SizedConfig = Record<'inline' | 'expanded', TimeSeriesChartConfig>;

export const INLINE_HEIGHT = '190px';
export const EXPANDED_HEIGHT = 'min(62vh, 560px)';

export const RANGES: { value: MonitoringTimeRange; label: string; long: string }[] = [
  { value: '1h', label: '1h', long: 'last hour' },
  { value: '2h', label: '2h', long: 'last 2 hours' },
  { value: '3h', label: '3h', long: 'last 3 hours' },
  { value: '6h', label: '6h', long: 'last 6 hours' },
  { value: '1d', label: '1d', long: 'last day' },
];

const STEPS: Record<MonitoringTimeRange, { hours: number; step: string }> = {
  '1h': { hours: 1, step: '30s' },
  '2h': { hours: 2, step: '1m' },
  '3h': { hours: 3, step: '1m' },
  '6h': { hours: 6, step: '2m' },
  '1d': { hours: 24, step: '5m' },
};

export function sizedPair(extra: TimeSeriesChartConfig): SizedConfig {
  const base = { showGrid: true, showLegend: true, showTitle: false, ...extra };
  return {
    inline: { ...base, height: INLINE_HEIGHT, enableZoom: false, animated: true },
    expanded: { ...base, height: EXPANDED_HEIGHT, enableZoom: true, animated: false },
  };
}

export function resolveRange(range: MonitoringTimeRange): TrafficRange {
  const end = new Date();
  const start = new Date();
  const { hours, step } = STEPS[range];
  if (hours === 24) start.setDate(start.getDate() - 1);
  else start.setHours(start.getHours() - hours);
  return { start, end, step };
}

export interface HistoryCharts {
  readonly cpu: TimeSeriesChartData;
  readonly memory: TimeSeriesChartData;
  readonly network: TimeSeriesChartData;
  readonly replicas: TimeSeriesChartData | null;
}

function pointsOf(
  dp: AppHistoryPoint[],
  value: (p: AppHistoryPoint) => number | null | undefined,
): TimeSeriesDataPoint[] {
  return dp
    .filter((p) => value(p) != null)
    .map((p) => ({ timestamp: new Date(p.datetime), value: value(p)! }));
}

export function historyCharts(dp: AppHistoryPoint[]): HistoryCharts {
  const cpuSeries: TimeSeriesSeries[] = [
    { name: 'Used', data: pointsOf(dp, (p) => p.cpu_utilization_percent), smooth: true },
  ];
  const throttled = pointsOf(dp, (p) => p.cpu_throttled_percent);
  if (throttled.length > 0) {
    cpuSeries.push({
      name: 'Throttled',
      data: throttled,
      smooth: true,
      color: DEFAULT_CHART_COLORS.warning[0],
    });
  }
  const ready = pointsOf(dp, (p) => p.replicas_ready);
  const desired = pointsOf(dp, (p) => p.replicas_desired);
  return {
    cpu: { title: 'CPU Usage History', series: cpuSeries },
    memory: {
      title: 'Memory Usage History',
      series: [
        { name: 'Memory %', data: pointsOf(dp, (p) => p.memory_utilization_percent), smooth: true },
      ],
    },
    network: {
      title: 'Network I/O History',
      series: [
        { name: 'Network In', data: pointsOf(dp, (p) => p.network_receive_rate), smooth: true },
        { name: 'Network Out', data: pointsOf(dp, (p) => p.network_transmit_rate), smooth: true },
      ],
    },
    replicas:
      ready.length || desired.length
        ? {
            title: 'Replicas',
            series: [
              { name: 'Ready', data: ready },
              { name: 'Desired', data: desired, color: DEFAULT_CHART_COLORS.neutral[0] },
            ],
          }
        : null,
  };
}
