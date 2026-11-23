import {
  GaugeChartData,
  GaugeChartConfig,
  TimeSeriesChartData,
  TimeSeriesChartConfig,
  TimeSeriesDataPoint,
  MultiStatCardData,
  StatusTimelineData,
  TimelineEvent,
  TimelineStatus,
  ProportionDonutData,
  ProportionDonutConfig,
  ProportionBarData,
  ProportionBarConfig,
} from '../chart.models';
import { cssColor } from '../chart-colors';

function demoRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}

function timeSeries(points: number, minValue: number, maxValue: number): TimeSeriesDataPoint[] {
  const data: TimeSeriesDataPoint[] = [];
  const now = Date.now();
  const interval = 5 * 60 * 1000;
  for (let i = points - 1; i >= 0; i--) {
    data.push({
      timestamp: now - i * interval,
      value: minValue + demoRandom() * (maxValue - minValue),
    });
  }
  return data;
}

const INCIDENTS: Record<Exclude<TimelineStatus, 'up'>, string> = {
  down: 'Server crash, automatic restart',
  degraded: 'High latency detected',
  maintenance: 'Scheduled maintenance window',
};

function uptimeEvents(days: number): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = new Date();
  const kinds = Object.keys(INCIDENTS) as Exclude<TimelineStatus, 'up'>[];
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - i));
    if (demoRandom() < 0.005) {
      const status = kinds[Math.floor(demoRandom() * kinds.length)];
      events.push({
        timestamp: date,
        status,
        duration: Math.floor(demoRandom() * 3600000),
        message: INCIDENTS[status],
      });
    } else {
      events.push({ timestamp: date, status: 'up' });
    }
  }
  return events;
}

export function jitter(data: GaugeChartData, step: number, max: number): GaugeChartData {
  const value = data.value;
  return {
    ...data,
    previousValue: value,
    value: Math.min(max, Math.max(0, value + (demoRandom() * step * 2 - step))),
  };
}

export type DemoGauge = 'cpu' | 'memory' | 'disk' | 'custom' | 'latency';

export const DEMO_GAUGES: Record<DemoGauge, GaugeChartData> = {
  cpu: {
    value: 45,
    title: 'CPU Usage',
    subtitle: '4 cores active',
    previousValue: 40,
  },
  memory: {
    value: 82,
    title: 'Memory',
    subtitle: '8.2 GB / 10 GB',
    previousValue: 78,
  },
  disk: {
    value: 65,
    title: 'Disk Usage',
    subtitle: '325 GB / 500 GB',
  },
  custom: {
    value: 15,
    title: 'Network Load',
    subtitle: '150 Mbps',
  },
  latency: {
    value: 45,
    title: 'Latency',
    subtitle: 'API Response Time',
  },
};

export const CPU_CONFIG: GaugeChartConfig = {
  unit: '%',
  thresholds: {
    warning: 70,
    danger: 90,
  },
  height: '240px',
};

export const MEMORY_CONFIG: GaugeChartConfig = {
  unit: '%',
  thresholds: {
    warning: 75,
    danger: 90,
  },
  height: '240px',
};

export const DISK_CONFIG: GaugeChartConfig = {
  unit: '%',
  thresholds: {
    warning: 80,
    danger: 95,
  },
  height: '240px',
};

export const CUSTOM_CONFIG: GaugeChartConfig = {
  min: 0,
  max: 1000,
  unit: ' Mbps',
  severity: 'success',
  height: '240px',
  valueFormatter: (value) => value.toFixed(0),
};

export const LATENCY_CONFIG: GaugeChartConfig = {
  min: 0,
  max: 200,
  unit: 'ms',
  thresholds: {
    warning: 100,
    danger: 150,
  },
  height: '240px',
};

export const MEMORY_DISTRIBUTION_DATA: ProportionDonutData = {
  title: 'Memory by Application',
  subtitle: 'Modern style with legend',
  slices: [
    { name: 'API Gateway', value: 2048 },
    { name: 'Auth Service', value: 1024 },
    { name: 'Worker Pool', value: 1536 },
    { name: 'Cache Layer', value: 768 },
    { name: 'Monitoring', value: 512 },
    { name: 'Other', value: 256 },
  ],
};

export const MEMORY_DISTRIBUTION_LABEL_DATA: ProportionDonutData = {
  title: 'Memory by Application',
  subtitle: 'Classic style with label lines',
  slices: [
    { name: 'API Gateway', value: 2048 },
    { name: 'Auth Service', value: 1024 },
    { name: 'Worker Pool', value: 1536 },
    { name: 'Cache Layer', value: 768 },
    { name: 'Monitoring', value: 512 },
    { name: 'Other', value: 256 },
  ],
};

export const MEMORY_DISTRIBUTION_CONFIG: ProportionDonutConfig = {
  unit: 'MB',
  height: '380px',
  padAngle: 5,
  borderRadius: 10,
  innerRadius: 0.4,
  legendPosition: 'top',
};

export const MEMORY_DISTRIBUTION_LABEL_CONFIG: ProportionDonutConfig = {
  unit: 'MB',
  height: '380px',
  padAngle: 5,
  borderRadius: 10,
  innerRadius: 0.4,
  showLabels: true,
  showLegend: false,
};

export const CPU_DISTRIBUTION_DATA: ProportionDonutData = {
  title: 'CPU by Namespace',
  subtitle: 'Nightingale chart, radius mode',
  slices: [
    { name: 'production', value: 40 },
    { name: 'staging', value: 33 },
    { name: 'monitoring', value: 28 },
    { name: 'kube-system', value: 22 },
    { name: 'development', value: 20 },
    { name: 'testing', value: 15 },
  ],
};

export const CPU_DISTRIBUTION_CONFIG: ProportionDonutConfig = {
  unit: 'vCPU',
  legendPosition: 'top',
  height: '380px',
  roseType: 'radius',
  borderRadius: 5,
  innerRadius: 0.2,
};

export const STORAGE_BY_APP_DATA: ProportionDonutData = {
  title: 'Storage by Application',
  subtitle: 'Nightingale chart, area mode',
  slices: [
    { name: 'PostgreSQL', value: 120 },
    { name: 'Elasticsearch', value: 85 },
    { name: 'Redis', value: 68 },
    { name: 'MongoDB', value: 45 },
    { name: 'App Logs', value: 32 },
    { name: 'Backups', value: 28 },
  ],
};

export const STORAGE_BY_APP_CONFIG: ProportionDonutConfig = {
  unit: 'GB',
  legendPosition: 'top',
  height: '380px',
  roseType: 'area',
  borderRadius: 5,
  innerRadius: 0.2,
};

export const STORAGE_DISTRIBUTION_DATA: ProportionBarData = {
  title: 'Storage Distribution',
  subtitle: 'Persistent volume usage by application',
  slices: [
    { name: 'PostgreSQL', value: 120 },
    { name: 'Redis', value: 32 },
    { name: 'Elasticsearch', value: 85 },
    { name: 'App Logs', value: 45 },
    { name: 'Backups', value: 68 },
  ],
};

export const STORAGE_DISTRIBUTION_CONFIG: ProportionBarConfig = {
  unit: 'GB',
  barHeight: 32,
};

export const POD_DISTRIBUTION_DATA: ProportionBarData = {
  title: 'Pods per Namespace',
  slices: [
    { name: 'production', value: 24 },
    { name: 'staging', value: 12 },
    { name: 'monitoring', value: 8 },
    { name: 'kube-system', value: 15 },
    { name: 'development', value: 6 },
  ],
};

export const NETWORK_DISTRIBUTION_DATA: ProportionBarData = {
  title: 'Network Bandwidth by Service',
  subtitle: 'Current outbound traffic',
  slices: [
    { name: 'API Gateway', value: 450 },
    { name: 'CDN Origin', value: 320 },
    { name: 'WebSocket', value: 180 },
    { name: 'gRPC Internal', value: 95 },
    { name: 'Metrics Export', value: 55 },
  ],
};

export const CPU_TIME_SERIES_DATA: TimeSeriesChartData = {
  title: 'CPU Usage History',
  series: [
    {
      name: 'CPU',
      data: timeSeries(30, 40, 70),
      showArea: true,
      smooth: true,
    },
  ],
};

export const CPU_TIME_SERIES_CONFIG: TimeSeriesChartConfig = {
  unit: '%',
  showGrid: true,
  showLegend: false,
  height: '300px',
  thresholds: {
    warning: 70,
    danger: 90,
  },
};

export const MEMORY_TIME_SERIES_DATA: TimeSeriesChartData = {
  title: 'Memory Usage History',
  series: [
    {
      name: 'Used',
      data: timeSeries(30, 60, 85),
      showArea: true,
      smooth: true,
      color: cssColor('--fl-accent'),
    },
    {
      name: 'Cached',
      data: timeSeries(30, 10, 20),
      showArea: true,
      smooth: true,
      color: cssColor('--fl-ink-muted'),
    },
  ],
};

export const MEMORY_TIME_SERIES_CONFIG: TimeSeriesChartConfig = {
  unit: '%',
  showGrid: true,
  showLegend: true,
  height: '300px',
};

export const LOAD_AVERAGE_DATA: MultiStatCardData = {
  title: 'System Load Average',
  subtitle: 'Load over 1, 5, and 15 minutes',
  stats: [
    { label: '1 min', value: 1.23, trend: 'up', trendValue: '+0.05' },
    { label: '5 min', value: 1.45, trend: 'stable' },
    { label: '15 min', value: 1.38, trend: 'down', trendValue: '-0.10' },
  ],
};

export const SYSTEM_INFO_DATA: MultiStatCardData = {
  title: 'System Information',
  subtitle: 'Current system metrics',
  stats: [
    { label: 'Uptime', value: '15d 4h', severity: 'success' },
    { label: 'Processes', value: '342', severity: 'info' },
    { label: 'Threads', value: '1,245', severity: 'info' },
    { label: 'Users', value: '12', severity: 'neutral' },
  ],
};

export const UPTIME_DATA: StatusTimelineData = {
  title: 'Cluster Uptime History',
  subtitle: 'Last 90 days availability',
  uptimePercentage: 99.95,
  events: uptimeEvents(90),
};
