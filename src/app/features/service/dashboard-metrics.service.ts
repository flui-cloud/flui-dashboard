import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ClusterService } from './cluster.service';
import { ClusterMetricsLogsService } from '../../core/api/api/clusterMetricsLogs.service';
import { ClusterStatus } from '../model/cluster.models';

export interface ClusterMetricsSummary {
  clusterId: string;
  clusterName: string;
  cpu: number;
  memory: number;
  disk: number;
  cores: number;
  nodes: number;
}

type Severity = 'success' | 'warning' | 'danger';

export function getSeverity(value: number, warn: number, danger: number): Severity {
  if (value >= danger) return 'danger';
  if (value >= warn) return 'warning';
  return 'success';
}

@Injectable({ providedIn: 'root' })
export class DashboardMetricsService {
  private readonly clusterService = inject(ClusterService);
  private readonly metricsApi = inject(ClusterMetricsLogsService);

  private readonly clusterMetricsSignal = signal<ClusterMetricsSummary[]>([]);
  private readonly isLoadingSignal = signal(false);

  readonly clusterMetrics = this.clusterMetricsSignal.asReadonly();
  readonly isLoading = this.isLoadingSignal.asReadonly();
  readonly hasData = computed(() => this.clusterMetricsSignal().length > 0);

  async loadMetrics(): Promise<void> {
    const activeClusters = this.clusterService
      .clusters()
      .filter((c) => c.status === ClusterStatus.ACTIVE && !!c.id);

    if (activeClusters.length === 0) {
      this.clusterMetricsSignal.set([]);
      return;
    }

    this.isLoadingSignal.set(true);

    const results = await Promise.allSettled(
      activeClusters.map((c) =>
        firstValueFrom(
          this.metricsApi.serverMetricsControllerGetClusterMetrics(c.id!)
        ).then((data) => ({ cluster: c, data }))
      )
    );

    const summaries: ClusterMetricsSummary[] = [];

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { cluster, data } = result.value;
      if (!data?.servers?.length) continue;

      const servers = data.servers;
      const count = servers.length;
      const cpu = servers.reduce((s, n) => s + (n.cpu?.usage_percent ?? 0), 0) / count;
      const memory = servers.reduce((s, n) => s + (n.memory?.usage_percent ?? 0), 0) / count;
      const disk = servers.reduce((s, n) => s + (n.disk?.usage_percent ?? 0), 0) / count;
      const cores = servers.reduce((s, n) => s + (n.cpu?.cores ?? 0), 0);

      summaries.push({
        clusterId: cluster.id!,
        clusterName: cluster.name ?? cluster.id!,
        cpu,
        memory,
        disk,
        cores,
        nodes: count,
      });
    }

    this.clusterMetricsSignal.set(summaries);
    this.isLoadingSignal.set(false);
  }
}
