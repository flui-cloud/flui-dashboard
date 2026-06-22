import { Component, OnInit, inject, computed, signal, effect, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCpu,
  lucideGlobe,
  lucideSettings,
  lucideHistory,
  lucideArrowRight,
  lucideCheckCircle,
  lucideAlertCircle,
  lucideServer,
  lucideTrash2,
  lucideExternalLink,
  lucideLoader,
  lucidePin,
} from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';
import { AppRuntimeService } from '../../service/app-runtime.service';
import { AppVariablesService } from '../../service/app-variables.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { AppRevisionsService } from '../../service/app-revisions.service';
import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import { DiagnosesBannerComponent } from './crash-diagnoses/diagnoses-banner.component';
import { evaluateEndpointReadiness } from '../../model/endpoint-readiness';
import { buildOpenAppUrl, CATALOG_APP_LABEL } from '../../model/open-app-url';
import { hasPublicEndpoint, isBuildingBlock } from '../../model/app-exposure';
import { CatalogService } from '../../service/catalog.service';
import { ClientConnectionSectionComponent } from './client-connection-section.component';
import { InternalServiceInfoComponent, InternalServiceMode } from './internal-service-info.component';
import { AppLatestReleaseCardComponent } from './app-latest-release-card.component';
import { AppProjectSectionComponent } from './app-project-section.component';

@Component({
  selector: 'app-overview-tab',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgIconComponent,
    ConfirmationDialogComponent,
    DiagnosesBannerComponent,
    ClientConnectionSectionComponent,
    InternalServiceInfoComponent,
    AppLatestReleaseCardComponent,
    AppProjectSectionComponent,
  ],
  providers: [
    provideIcons({
      lucideCpu,
      lucideGlobe,
      lucideSettings,
      lucideHistory,
      lucideArrowRight,
      lucideCheckCircle,
      lucideAlertCircle,
      lucideServer,
      lucideTrash2,
      lucideExternalLink,
      lucideLoader,
      lucidePin,
    }),
  ],
  templateUrl: './app-overview-tab.component.html',
})
export class AppOverviewTabComponent implements OnInit {
  private readonly appService = inject(ApplicationService);
  readonly monitoringService = inject(ApplicationMonitoringService);
  readonly runtimeService = inject(AppRuntimeService);
  readonly variablesService = inject(AppVariablesService);
  readonly endpointsService = inject(AppEndpointsService);
  readonly revisionsService = inject(AppRevisionsService);
  readonly catalogService = inject(CatalogService);

  readonly app = this.appService.selectedApplication;
  readonly runtime = this.runtimeService.runtime;

  @ViewChild('deleteDialog') deleteDialog!: ConfirmationDialogComponent;

  readonly isDeleting = signal(false);
  readonly deleteStepMessage = signal<string | null>(null);

  constructor() {
    effect(() => {
      const progress = this.appService.deleteProgress();
      const appId = this.app()?.id;
      if (progress && progress.appId === appId) {
        this.deleteStepMessage.set(progress.message);
      }
    });

    effect(async () => {
      const slug = this.catalogSlug();
      if (!slug) {
        this.catalogEntrypointPath.set(undefined);
        return;
      }
      const path = await this.catalogService.getEntrypointPathBySlug(slug);
      this.catalogEntrypointPath.set(path);
    });
  }

  readonly varCount = computed(() => Object.keys(this.variablesService.plainData()).length);
  readonly secretCount = computed(() => this.variablesService.sensitiveKeys().length);

  readonly appEndpoints = computed(() => {
    const appId = this.app()?.id;
    if (!appId) return [];
    return this.endpointsService.endpoints().filter(e => e.applicationId === appId);
  });
  readonly appEndpointCount = computed(() => this.appEndpoints().length);
  readonly syncedEndpointCount = computed(() =>
    this.appEndpoints().filter(e => e.reconciliationStatus === 'IN_SYNC').length
  );
  readonly driftEndpointCount = computed(() =>
    this.appEndpoints().filter(e => e.reconciliationStatus === 'DRIFT' || e.reconciliationStatus === 'ERROR').length
  );
  readonly primaryEndpoint = computed(() =>
    this.appEndpoints().find(e => e.reconciliationStatus === 'IN_SYNC') ?? null
  );
  readonly extraInSyncCount = computed(() => Math.max(0, this.syncedEndpointCount() - 1));

  readonly primaryEndpointReadiness = computed(() =>
    evaluateEndpointReadiness(this.primaryEndpoint()),
  );

  readonly catalogSlug = computed<string | undefined>(() => {
    const labels = (this.app() as { labels?: Record<string, string> } | null)?.labels;
    return labels?.[CATALOG_APP_LABEL];
  });

  private readonly catalogEntrypointPath = signal<string | undefined>(undefined);

  readonly openAppUrl = computed(() =>
    buildOpenAppUrl(
      this.primaryEndpoint()?.fqdn,
      this.catalogEntrypointPath(),
      this.primaryEndpoint()?.tlsEnabled ?? false,
    ),
  );

  readonly primaryEndpointScheme = computed(() =>
    this.primaryEndpoint()?.tlsEnabled ? 'https' : 'http',
  );

  readonly isPublicApp = computed(() => hasPublicEndpoint(this.app()));

  readonly internalServiceMode = computed<InternalServiceMode>(() =>
    isBuildingBlock(this.app()) ? 'building-block' : 'internal-app',
  );

  readonly internalUrlReadiness = computed<'pending' | 'failed' | 'ready' | 'not-configured'>(() => {
    const app = this.app();
    if (!app) return 'not-configured';
    if (app.internalUrl) return 'ready';
    const r = app.reconciliationStatus as string;
    if (r === 'ERROR') return 'failed';
    if (r === 'RECONCILING' || r === 'PENDING' || app.status === 'provisioning') return 'pending';
    return 'not-configured';
  });

  readonly replicaCounts = computed(() => {
    const status = this.monitoringService.statusMetrics();
    const rt = this.runtime();
    const app = this.app();
    const ready = status?.replicas_ready ?? rt?.replicas?.ready ?? 0;
    const desired =
      status?.replicas_desired ?? rt?.replicas?.desired ?? app?.replicas ?? 0;
    return { ready, desired };
  });

  readonly recentEvents = computed(() => this.revisionsService.events().slice(0, 3));

  openDeleteDialog(): void {
    this.deleteDialog.open();
  }

  async onDeleteConfirmed(): Promise<void> {
    const id = this.app()?.id;
    if (!id) return;
    this.deleteDialog.setProcessing(true);
    this.isDeleting.set(true);
    try {
      await this.appService.deleteApplication(id);
      this.deleteDialog.close();
    } catch {
      this.deleteDialog.setProcessing(false);
      this.isDeleting.set(false);
    }
  }

  ngOnInit(): void {
    const app = this.app();
    if (!app) return;
    this.variablesService.loadVariables(app.id);
    if (app.clusterId) {
      this.endpointsService.loadEndpoints(app.clusterId);
    }
    this.revisionsService.loadEvents(app.id, undefined, 3);
  }

  getLimitPercent(usage: number | null, limit: number | null): number {
    if (!limit || limit <= 0) return 0;
    return Math.min(((usage ?? 0) / limit) * 100, 100);
  }

  getMetricColor(value: number, warn: number, danger: number): string {
    if (value >= danger) return 'text-red-600 dark:text-red-400';
    if (value >= warn) return 'text-orange-600 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  }

  progressBarColor(value: number, warn: number, danger: number): string {
    if (value >= danger) return 'bg-red-500';
    if (value >= warn) return 'bg-orange-400';
    return 'bg-green-500';
  }

  formatCpu(cores: number): string {
    if (cores >= 1) return `${cores.toFixed(2)}c`;
    return `${(cores * 1000).toFixed(0)}m`;
  }

  formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${bytes.toFixed(0)}B`;
  }

  private resolveStatus(m: AppMetricsDto): 'healthy' | 'degraded' | 'down' {
    const s = m.status;
    if (s.replicas_ready == null && s.replicas_desired == null) {
      const running = m.pods?.some(p => p.phase === 'Running' && (p.count ?? 0) > 0) ?? false;
      return running ? 'healthy' : 'down';
    }
    const ready = s.replicas_ready ?? 0;
    const desired = s.replicas_desired ?? 0;
    if (ready === 0) return 'down';
    if (ready < desired) return 'degraded';
    return 'healthy';
  }

  statusLabel(m: AppMetricsDto): string {
    const r = this.resolveStatus(m);
    if (r === 'down') return 'Down';
    if (r === 'degraded') return 'Degraded';
    return 'Healthy';
  }

  statusColor(m: AppMetricsDto): string {
    const r = this.resolveStatus(m);
    if (r === 'down') return 'text-red-600 dark:text-red-400';
    if (r === 'degraded') return 'text-orange-500 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  }

  statusDotColor(m: AppMetricsDto): string {
    const r = this.resolveStatus(m);
    if (r === 'down') return 'bg-red-500';
    if (r === 'degraded') return 'bg-orange-400';
    return 'bg-green-500';
  }
}
