import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ClusterService } from './cluster.service';
import { ApplicationService } from './application.service';
import { ProvidersService } from './providers.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DashboardDnsService } from './dashboard-dns.service';
import { HealthService } from '../../core/api/api/health.service';
import { ClusterStatus } from '../model/cluster.models';

export type BackendHealth = 'online' | 'offline' | 'checking';

const OPERATION_STATUSES: Set<ClusterStatus> = new Set([
  ClusterStatus.CREATING,
  ClusterStatus.SCALING,
  ClusterStatus.UPDATING,
  ClusterStatus.STOPPING,
  ClusterStatus.STARTING,
  ClusterStatus.DELETING,
]);

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly clusterService = inject(ClusterService);
  private readonly applicationService = inject(ApplicationService);
  private readonly providersService = inject(ProvidersService);
  private readonly metricsService = inject(DashboardMetricsService);
  private readonly dashboardDnsService = inject(DashboardDnsService);
  private readonly healthApi = inject(HealthService);

  // Backend health
  private readonly backendHealthSignal = signal<BackendHealth>('checking');
  readonly backendHealth = this.backendHealthSignal.asReadonly();

  // Last refresh timestamp
  private readonly lastRefreshedAtSignal = signal<Date>(new Date());
  readonly lastRefreshedAt = this.lastRefreshedAtSignal.asReadonly();

  // Loading aggregation
  readonly isLoading = computed(
    () =>
      this.clusterService.listIsLoading() ||
      this.applicationService.loading() ||
      this.providersService.isLoading()
  );

  // Cluster aggregates
  readonly clusters = this.clusterService.clusters;

  readonly totalClusters = computed(() => this.clusterService.clusters().length);

  readonly activeClusters = computed(
    () => this.clusterService.clusters().filter((c) => c.status === ClusterStatus.ACTIVE).length
  );

  readonly unhealthyClusters = computed(
    () => this.clusterService.clusters().filter((c) => c.status === ClusterStatus.ERROR).length
  );

  readonly totalNodes = computed(() =>
    this.clusterService.clusters().reduce((sum, c) => sum + (c.nodeCount ?? 0), 0)
  );

  readonly clustersInOperation = computed(() =>
    this.clusterService.clusters().filter((c) => OPERATION_STATUSES.has(c.status))
  );

  readonly hasActiveOperations = computed(() => this.clustersInOperation().length > 0);

  // App aggregates
  readonly totalApps = computed(() => this.applicationService.applications().length);
  readonly userTotalApps = this.applicationService.userTotalAppsCount;
  readonly databasesApps = this.applicationService.databasesCount;
  readonly applicationsApps = this.applicationService.applicationsCount;
  readonly toolsApps = this.applicationService.toolsCount;
  readonly runningApps = this.applicationService.runningAppsCount;
  readonly failedApps = this.applicationService.failedAppsCount;
  readonly updatingApps = this.applicationService.provisioningAppsCount;

  // Provider aggregates
  readonly configuredProviders = this.providersService.configuredProviders;
  readonly activeProvidersCount = computed(() => this.providersService.activeProviders().length);

  // Pulse bar summary
  readonly pulseSummary = computed(() => ({
    backendOnline: this.backendHealthSignal() === 'online',
    activeOperations: this.clustersInOperation().length,
    providersConnected: this.activeProvidersCount(),
    totalClusters: this.totalClusters(),
    runningApps: this.runningApps(),
  }));

  async initialize(): Promise<void> {
    // Phase 1 — parallel base data load
    this.loadProviders();
    await Promise.allSettled([
      this.checkBackendHealth(),
      this.clusterService.loadClusters(),
      this.applicationService.loadApplications(),
    ]);
    // Phase 2 — requires clusters to be loaded first
    await Promise.allSettled([
      this.metricsService.loadMetrics(),
      this.dashboardDnsService.load(),
    ]);
    this.lastRefreshedAtSignal.set(new Date());
  }

  async refresh(): Promise<void> {
    this.backendHealthSignal.set('checking');
    await this.initialize();
  }

  private async checkBackendHealth(): Promise<void> {
    try {
      await firstValueFrom(this.healthApi.healthControllerPing());
      this.backendHealthSignal.set('online');
    } catch {
      this.backendHealthSignal.set('offline');
    }
  }

  private loadProviders(): void {
    this.providersService.loadProviders();
    this.providersService.loadConfigurations();
  }
}
