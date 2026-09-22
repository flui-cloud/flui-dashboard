import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ClusterMetricsLogsService } from '../../core/api/api/clusterMetricsLogs.service';
import {
  ClusterMetricsHistoryResponseDto,
  MetricsDataPointDto,
  ServerMetricsHistoryDto,
} from '../../core/api/model/models';
import { TimeSeriesChartData, TimeSeriesSeries, NODE_SERIES_COLORS } from '../../shared/components/charts';

export type MetricsRange = '1h' | '3h' | '6h' | '1d';

/** Window length and sampling step per range, kept in one place. */
const RANGES: Record<MetricsRange, { hours: number; step: string; stepSeconds: number; label: string }> = {
  '1h': { hours: 1, step: '30s', stepSeconds: 30, label: 'last hour' },
  '3h': { hours: 3, step: '1m', stepSeconds: 60, label: 'last 3 hours' },
  '6h': { hours: 6, step: '2m', stepSeconds: 120, label: 'last 6 hours' },
  '1d': { hours: 24, step: '5m', stepSeconds: 300, label: 'last day' },
};

/** Samples older than this many steps no longer describe the reading on screen. */
const STALE_AFTER_STEPS = 3;

/** Floor on how often the window is re-fetched, whatever the step. */
const MIN_REFRESH_MS = 30_000;

type PercentField = 'cpu_percent' | 'memory_percent' | 'disk_percent';

/**
 * Holds the historical series behind the cluster monitoring page: one fetch
 * per range, four chart datasets out. Kept out of the components so the same
 * window can feed the summary tiles and the charts without fetching twice.
 */
@Injectable({ providedIn: 'root' })
export class ClusterMetricsHistoryService {
  private readonly metricsApi = inject(ClusterMetricsLogsService);

  private readonly rangeSignal = signal<MetricsRange>('3h');
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly historySignal = signal<ClusterMetricsHistoryResponseDto | null>(null);

  /** Which cluster the stored window belongs to — this service outlives the page. */
  private readonly loadedFor = signal<string | null>(null);
  private pendingFor: string | null = null;

  readonly range = this.rangeSignal.asReadonly();
  readonly isLoading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly rangeLabel = computed(() => RANGES[this.rangeSignal()].label);
  readonly hasData = computed(() => (this.historySignal()?.servers?.length ?? 0) > 0);

  /** Epoch ms of the newest sample in the window, or null when the window is empty. */
  readonly newestSampleAt = computed<number | null>(() => {
    const servers = this.historySignal()?.servers ?? [];
    let newest = 0;
    servers.forEach((server) =>
      server.data_points.forEach((point) => {
        const at = Date.parse(point.datetime);
        if (at > newest) newest = at;
      })
    );
    return newest || null;
  });

  /** How old a sample may be before it stops describing the current reading. */
  readonly freshnessBudgetMs = computed(() => RANGES[this.rangeSignal()].stepSeconds * STALE_AFTER_STEPS * 1000);

  /**
   * How often the window should be re-fetched to keep reaching the present.
   * One sampling step, floored so the shortest range does not query in a loop.
   */
  readonly refreshIntervalMs = computed(() =>
    Math.max(MIN_REFRESH_MS, RANGES[this.rangeSignal()].stepSeconds * 1000)
  );

  /**
   * Whether the window still reaches the present. Read from a caller that
   * already recomputes on the live poll — a signal cannot notice time passing
   * on its own.
   */
  isFresh(now = Date.now()): boolean {
    const newest = this.newestSampleAt();
    return newest != null && now - newest <= this.freshnessBudgetMs();
  }

  /** Nodes in the stored window — the chart changes shape past what the palette can name. */
  readonly nodeCount = computed(() => this.historySignal()?.servers?.length ?? 0);
  readonly isSummarised = computed(() => this.nodeCount() > NODE_SERIES_COLORS.length);
  readonly seriesSubtitle = computed(() =>
    this.isSummarised() ? `average and busiest of ${this.nodeCount()} nodes` : 'per node'
  );

  readonly cpu = computed(() => this.percentSeries('cpu_percent', 'CPU per node'));
  readonly memory = computed(() => this.percentSeries('memory_percent', 'Memory per node'));
  readonly disk = computed(() => this.percentSeries('disk_percent', 'Disk per node'));
  readonly network = computed<TimeSeriesChartData | null>(() => {
    const servers = this.historySignal()?.servers;
    if (!servers?.length) return null;

    const totals = new Map<string, { inBytes: number; outBytes: number }>();
    servers.forEach((server) =>
      server.data_points.forEach((point) => {
        // A sample with no network reading is missing, not zero traffic. Counting
        // it as zero drags the window's typical value down and makes the change
        // against it as large as the reading itself.
        if (point.network_in == null && point.network_out == null) return;
        const bucket = totals.get(point.datetime) ?? { inBytes: 0, outBytes: 0 };
        bucket.inBytes += point.network_in ?? 0;
        bucket.outBytes += point.network_out ?? 0;
        totals.set(point.datetime, bucket);
      })
    );

    const ordered = [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (ordered.length === 0) return null;

    return {
      title: 'Network, cluster total',
      series: [
        {
          name: 'Inbound',
          color: NODE_SERIES_COLORS[0],
          smooth: true,
          data: ordered.map(([datetime, v]) => ({ timestamp: new Date(datetime), value: v.inBytes })),
        },
        {
          name: 'Outbound',
          color: NODE_SERIES_COLORS[2],
          smooth: true,
          data: ordered.map(([datetime, v]) => ({ timestamp: new Date(datetime), value: v.outBytes })),
        },
      ],
    };
  });

  /** Plain value arrays for the summary sparklines — cluster average per sample. */
  readonly averages = computed(() => ({
    cpu: this.averageOf('cpu_percent'),
    memory: this.averageOf('memory_percent'),
    disk: this.averageOf('disk_percent'),
    network: this.networkTotals(),
  }));

  setRange(range: MetricsRange): void {
    if (this.rangeSignal() === range) return;
    this.rangeSignal.set(range);
  }

  async load(clusterId: string): Promise<void> {
    // Another cluster's window must never be on screen under this one's name,
    // not even for the length of a request.
    if (this.loadedFor() !== clusterId) {
      this.historySignal.set(null);
      this.loadedFor.set(null);
    }
    this.pendingFor = clusterId;

    const { hours, step } = RANGES[this.rangeSignal()];
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3_600_000);

    try {
      this.loadingSignal.set(true);
      this.errorSignal.set(null);
      const response = await firstValueFrom(
        this.metricsApi.serverMetricsControllerGetClusterMetricsHistory(
          clusterId,
          start.toISOString(),
          end.toISOString(),
          step
        )
      );
      // A slow answer for the cluster we left must not overwrite the one we opened.
      if (this.pendingFor !== clusterId) return;
      this.historySignal.set(response);
      this.loadedFor.set(clusterId);
    } catch (error) {
      console.error('Failed to load metrics history:', error);
      if (this.pendingFor === clusterId) this.errorSignal.set('History is unavailable for this window.');
    } finally {
      if (this.pendingFor === clusterId) this.loadingSignal.set(false);
    }
  }

  private percentSeries(field: PercentField, title: string): TimeSeriesChartData | null {
    const servers = this.historySignal()?.servers;
    if (!servers?.length) return null;

    const series = this.isSummarised()
      ? this.summarySeries(servers, field)
      : servers.map((server, index) => ({
          name: this.nameOf(server),
          color: NODE_SERIES_COLORS[index],
          smooth: true,
          data: server.data_points
            .filter((point) => point[field] != null)
            .map((point) => ({ timestamp: new Date(point.datetime), value: point[field] as number })),
        }));

    return series.some((s) => s.data.length > 0) ? { title, series } : null;
  }

  /**
   * Past the palette there is no honest way to give each node its own colour —
   * no larger set of hues clears colour-vision separation — so the chart stops
   * claiming per-node identity and shows the shape of the cluster instead: what
   * it typically runs at, and the node closest to the threshold. Every node is
   * still listed, by name, in the nodes table.
   */
  private summarySeries(servers: ServerMetricsHistoryDto[], field: PercentField): TimeSeriesSeries[] {
    const byTimestamp = new Map<string, number[]>();
    servers.forEach((server) =>
      server.data_points.forEach((point) => {
        const value = point[field];
        if (value == null) return;
        byTimestamp.set(point.datetime, [...(byTimestamp.get(point.datetime) ?? []), value]);
      })
    );

    const ordered = [...byTimestamp.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const at = (pick: (values: number[]) => number) =>
      ordered.map(([datetime, values]) => ({ timestamp: new Date(datetime), value: pick(values) }));

    return [
      {
        name: 'Cluster average',
        color: NODE_SERIES_COLORS[0],
        smooth: true,
        data: at((values) => values.reduce((sum, v) => sum + v, 0) / values.length),
      },
      {
        name: 'Busiest node',
        color: NODE_SERIES_COLORS[2],
        smooth: true,
        data: at((values) => Math.max(...values)),
      },
    ];
  }

  private nameOf(server: ServerMetricsHistoryDto): string {
    return server.server_id || server.instance;
  }

  private averageOf(field: PercentField): number[] {
    const servers = this.historySignal()?.servers;
    if (!servers?.length) return [];

    const sums = new Map<string, { total: number; count: number }>();
    servers.forEach((server) =>
      server.data_points.forEach((point: MetricsDataPointDto) => {
        const value = point[field];
        if (value == null) return;
        const bucket = sums.get(point.datetime) ?? { total: 0, count: 0 };
        bucket.total += value;
        bucket.count += 1;
        sums.set(point.datetime, bucket);
      })
    );

    return [...sums.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v.total / v.count);
  }

  private networkTotals(): number[] {
    const data = this.network();
    if (!data) return [];
    const [inbound, outbound] = data.series;
    return inbound.data.map((point, i) => point.value + (outbound.data[i]?.value ?? 0));
  }
}
