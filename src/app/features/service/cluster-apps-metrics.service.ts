import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicationMetricsService } from '../../core/api/api/applicationMetrics.service';
import { AppMetricsDto } from '../../core/api/model/models';

export interface AppConsumption {
  appId: string;
  name: string;
  namespace: string;
  cpuCores: number | null;
  cpuPercent: number | null;
  memoryBytes: number | null;
  memoryPercent: number | null;
  replicas: string;
  replicasDegraded: boolean;
  restarts: number;
  healthy: boolean;
}

/**
 * Who is actually consuming the cluster. The per-application usage the API
 * already reports never reached the monitoring page; this ranks it so a node
 * running hot can be traced to the workload doing it.
 */
@Injectable({ providedIn: 'root' })
export class ClusterAppsMetricsService {
  private readonly metricsApi = inject(ApplicationMetricsService);

  private readonly appsSignal = signal<AppMetricsDto[]>([]);

  /** Which cluster the stored list belongs to — this service outlives the page. */
  private readonly loadedFor = signal<string | null>(null);
  private pendingFor: string | null = null;
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly isLoading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  /** Ranked by CPU in use, the measure that explains a hot node first. */
  readonly ranked = computed<AppConsumption[]>(() =>
    this.appsSignal()
      .map((app) => this.toConsumption(app))
      .sort((a, b) => (b.cpuCores ?? 0) - (a.cpuCores ?? 0))
  );

  readonly topConsumers = computed(() => this.ranked().slice(0, 5));
  readonly total = computed(() => this.appsSignal().length);

  async load(clusterId: string): Promise<void> {
    if (this.loadedFor() !== clusterId) {
      this.appsSignal.set([]);
      this.loadedFor.set(null);
    }
    this.pendingFor = clusterId;

    try {
      this.loadingSignal.set(true);
      this.errorSignal.set(null);
      const response = await firstValueFrom(
        this.metricsApi.applicationMetricsControllerGetClusterAppsMetrics(clusterId)
      );
      if (this.pendingFor !== clusterId) return;
      this.appsSignal.set(response.applications ?? []);
      this.loadedFor.set(clusterId);
    } catch (error) {
      console.error('Failed to load cluster app metrics:', error);
      if (this.pendingFor !== clusterId) return;
      this.errorSignal.set('Per-application usage is unavailable.');
      this.appsSignal.set([]);
    } finally {
      if (this.pendingFor === clusterId) this.loadingSignal.set(false);
    }
  }

  private toConsumption(app: AppMetricsDto): AppConsumption {
    const ready = app.status?.replicas_ready ?? null;
    const desired = app.status?.replicas_desired ?? null;

    return {
      appId: app.app_id,
      name: app.app_name,
      namespace: app.namespace,
      cpuCores: app.cpu?.usage_cores ?? null,
      cpuPercent: app.cpu?.utilization_percent ?? null,
      memoryBytes: app.memory?.usage_bytes ?? null,
      memoryPercent: app.memory?.utilization_percent ?? null,
      replicas: ready != null && desired != null ? `${ready}/${desired}` : '—',
      replicasDegraded: ready != null && desired != null && ready < desired,
      restarts: Math.round(app.status?.restart_rate_1h ?? 0),
      healthy: (app.status?.up ?? 1) > 0 && !(ready != null && desired != null && ready < desired),
    };
  }
}
