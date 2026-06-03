import { Injectable, signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
  Application,
  ApplicationStatus,
  ApplicationStatusEnum,
  ApplicationCategoryEnum,
  ApplicationKind,
  ApplicationKindEnum,
  ApplicationGroupTypeEnum,
  AppGroupView,
  DeployWizardConfiguration,
  DeploymentProgress,
} from '../model/application.models';
import { ApplicationsService } from '../../core/api/api/applications.service';
import { ClusterService } from './cluster.service';
import { AppRuntimeWebSocketService, OperationProgressEvent } from './app-runtime-websocket.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppConfigService } from '../../core/services/app-config.service';

export interface GenerateWorkflowParams {
  branch: string;
  framework: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  nodeVersion?: string;
  javaVersion?: string;
  dotnetVersion?: string;
  port?: number;
  buildTool?: 'maven' | 'gradle';
  appName?: string;
}

export interface GenerateWorkflowResult {
  committed: boolean;
  workflowUrl: string;
  runId?: string;
}

export interface WorkflowStatusResult {
  runId: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  url: string;
  /** Full 40-char commit SHA for the workflow run (added by backend). */
  headSha?: string;
}

interface BundleMeta {
  name: string;
  slug: string;
  url?: string;
  primaryComponentId?: string;
  catalogSlug?: string;
  category: Application['category'];
  createdAt: string;
}

const STATUS_SEVERITY: ApplicationStatus[] = [
  ApplicationStatusEnum.Failed,
  ApplicationStatusEnum.Degraded,
  ApplicationStatusEnum.Deleting,
  ApplicationStatusEnum.RollingBack,
  ApplicationStatusEnum.Updating,
  ApplicationStatusEnum.Provisioning,
  ApplicationStatusEnum.AwaitingBuild,
  ApplicationStatusEnum.Pending,
  ApplicationStatusEnum.Stopped,
  ApplicationStatusEnum.Running,
];

function aggregateStatus(statuses: ApplicationStatus[]): ApplicationStatus {
  for (const candidate of STATUS_SEVERITY) {
    if (statuses.includes(candidate)) return candidate;
  }
  return ApplicationStatusEnum.Running;
}

@Injectable({
  providedIn: 'root',
})
export class ApplicationService {
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly clusterService = inject(ClusterService);
  private readonly wsService = inject(AppRuntimeWebSocketService);
  private readonly notificationService = inject(NotificationService);
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  // State signals
  private readonly applicationsList = signal<Application[]>([]);
  private readonly bundleMeta = signal<Record<string, BundleMeta>>({});
  private readonly selectedApplicationSignal = signal<Application | null>(null);
  private readonly isLoading = signal<boolean>(false);
  private readonly error = signal<string | null>(null);

  // Deploy wizard tracking (kept for wizard/progress compatibility)
  private readonly currentDeploymentProgress = signal<DeploymentProgress | null>(null);
  private deploymentPollingInterval: ReturnType<typeof setInterval> | null = null;

  // Delete operation tracking
  private readonly _deleteProgress = signal<OperationProgressEvent | null>(null);
  private readonly _deletingAppIds = new Set<string>();
  private readonly _deletedAppIds = new Set<string>();

  // Background revalidation (SWR pattern)
  private readonly isBackgroundRefreshing = signal<boolean>(false);

  // Public readonly signals
  readonly applications = this.applicationsList.asReadonly();
  readonly loading = this.isLoading.asReadonly();
  readonly backgroundRefreshing = this.isBackgroundRefreshing.asReadonly();
  readonly errorMessage = this.error.asReadonly();
  readonly deployment = this.currentDeploymentProgress.asReadonly();
  readonly deleteProgress = this._deleteProgress.asReadonly();

  // Computed signals
  readonly hasApplications = computed(() => this.applicationsList().length > 0);

  readonly applicationGroups = computed<AppGroupView[]>(() => {
    const meta = this.bundleMeta();
    const byInstall = new Map<string, Application[]>();
    const standalone: Application[] = [];
    for (const app of this.applicationsList()) {
      const installId = app.catalogInstallId;
      if (installId && meta[installId]) {
        const bucket = byInstall.get(installId) ?? [];
        bucket.push(app);
        byInstall.set(installId, bucket);
      } else {
        standalone.push(app);
      }
    }

    const groups: Array<AppGroupView & { _sort: number }> = [];
    for (const [installId, components] of byInstall) {
      const m = meta[installId];
      groups.push({
        id: installId,
        type: ApplicationGroupTypeEnum.Composed,
        name: m.name,
        status: aggregateStatus(components.map((c) => c.status)),
        category: m.category,
        clusterId: components[0].clusterId,
        url: m.url,
        catalogSlug: m.catalogSlug,
        catalogInstallId: installId,
        primaryComponentId: m.primaryComponentId,
        createdAt: m.createdAt,
        components,
        _sort: new Date(m.createdAt).getTime(),
      });
    }
    for (const app of standalone) {
      groups.push({
        id: app.id,
        type: ApplicationGroupTypeEnum.Standalone,
        name: app.name,
        status: app.status,
        category: app.category,
        clusterId: app.clusterId,
        catalogSlug: app.catalogSlug,
        catalogInstallId: app.catalogInstallId,
        createdAt: app.createdAt,
        components: [app],
        _sort: new Date(app.createdAt).getTime(),
      });
    }

    return groups
      .sort((a, b) => b._sort - a._sort)
      .map(({ _sort, ...g }) => g);
  });

  readonly selectedApplication = computed(() => this.selectedApplicationSignal());

  refreshSelectedApplication(app: Application): void {
    this.selectedApplicationSignal.set(app);
  }

  clearSelectedApplication(): void {
    this.selectedApplicationSignal.set(null);
  }

  readonly runningAppsCount = computed(
    () => this.applicationGroups().filter(
      (g) => g.status === ApplicationStatusEnum.Running
    ).length
  );

  readonly failedAppsCount = computed(
    () => this.applicationGroups().filter(
      (g) => g.status === ApplicationStatusEnum.Failed
    ).length
  );

  readonly provisioningAppsCount = computed(
    () => this.applicationGroups().filter(
      (g) => g.status === ApplicationStatusEnum.Provisioning
    ).length
  );

  readonly systemAppsCount = computed(
    () => this.applicationGroups().filter(
      (g) => g.category === ApplicationCategoryEnum.System
    ).length
  );

  readonly userAppsCount = computed(
    () => this.applicationGroups().filter(
      (g) => g.category === ApplicationCategoryEnum.User
    ).length
  );

  readonly databasesCount = computed(
    () => this.applicationGroups().filter(
      (g) => this.groupKind(g) === ApplicationKindEnum.Database
    ).length
  );

  readonly applicationsCount = computed(
    () => this.applicationGroups().filter(
      (g) => this.groupKind(g) === ApplicationKindEnum.Application
    ).length
  );

  readonly toolsCount = computed(
    () => this.applicationGroups().filter(
      (g) => this.groupKind(g) === ApplicationKindEnum.Tool
    ).length
  );

  readonly systemKindCount = computed(
    () => this.applicationGroups().filter(
      (g) => this.groupKind(g) === ApplicationKindEnum.System
    ).length
  );

  readonly userTotalAppsCount = computed(
    () => this.databasesCount() + this.applicationsCount() + this.toolsCount()
  );

  private groupKind(g: AppGroupView): ApplicationKind {
    const primary =
      g.components.find((c) => c.id === g.primaryComponentId) ?? g.components[0];
    return primary?.kind ?? ApplicationKindEnum.Application;
  }

  /**
   * Load all applications across all clusters.
   * Without explicit refresh=true, uses Stale-While-Revalidate:
   * shows DB data immediately, then refreshes from Kubernetes in background.
   */
  async loadApplications(refresh?: boolean): Promise<void> {
    if (refresh === true) {
      // Manual refresh: show loading spinner, single slow call to Kubernetes
      await this._doFetch(true, true);
    } else {
      // SWR: fast DB call first, then background revalidation from Kubernetes
      await this._doFetch(false, true);
      this.isBackgroundRefreshing.set(true);
      this._doFetch(true, false)
        .finally(() => this.isBackgroundRefreshing.set(false));
    }
  }

  /**
   * Core fetch implementation.
   * @param refresh - whether to reconcile from Kubernetes (true=slow, false=DB only)
   * @param setLoadingState - whether to update isLoading signal and surface errors to UI
   */
  private async _doFetch(refresh: boolean, setLoadingState: boolean): Promise<void> {
    if (setLoadingState) {
      this.isLoading.set(true);
      this.error.set(null);
    }

    try {
      let clusters = this.clusterService.clusters();
      if (clusters.length === 0) {
        await this.clusterService.loadClusters();
        clusters = this.clusterService.clusters();
      }

      const validClusters = clusters.filter((c) => !!c.id);

      const results = await Promise.allSettled(
        validClusters.map((cluster) =>
          firstValueFrom(
            this.applicationsApi.applicationsControllerListGroupedByCluster(cluster.id!, refresh)
          )
        )
      );

      const allApps: Application[] = [];
      const meta: Record<string, BundleMeta> = {};
      for (const result of results) {
        if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
        for (const group of result.value) {
          allApps.push(...group.components);
          if (group.type === 'composed' && group.catalogInstallId) {
            meta[group.catalogInstallId] = {
              name: group.name,
              slug: group.slug,
              url: group.url,
              primaryComponentId: group.primaryComponentId,
              catalogSlug: group.catalogSlug,
              category: group.category,
              createdAt: group.createdAt,
            };
          }
        }
      }
      this.bundleMeta.set(meta);

      const filtered = allApps.filter(a =>
        a.status !== 'deleted' && !this._deletedAppIds.has(a.id)
      );

      // Preserve local 'deleting' status for apps the server hasn't caught up on yet
      const merged = filtered.map(a =>
        this._deletingAppIds.has(a.id) ? { ...a, status: ApplicationStatusEnum.Deleting } : a
      );

      this.applicationsList.set(merged);
      merged.forEach(a => { if (a.id && a.name) this.wsService.registerAppName(a.id, a.name); });
    } catch (error: any) {
      if (setLoadingState) {
        const errorMessage = error?.error?.message || error?.message || 'Failed to load applications';
        console.error('Failed to load applications:', error);
        this.error.set(errorMessage);
        throw error;
      } else {
        console.warn('Background revalidation failed:', error);
      }
    } finally {
      if (setLoadingState) this.isLoading.set(false);
    }
  }

  /**
   * Get a specific application by ID
   */
  async getApplication(id: string): Promise<Application | null> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const app = await firstValueFrom(
        this.applicationsApi.applicationsControllerFindById(id, true)
      );

      this.selectedApplicationSignal.set(app);
      if (app?.id && app?.name) this.wsService.registerAppName(app.id, app.name);
      return app;
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to load application';
      console.error('Failed to load application:', error);
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Silent fetch of an application for polling use cases (e.g. deploy monitor).
   * Unlike getApplication(), does NOT toggle the global isLoading / error signals,
   * so poll ticks don't flicker global loading indicators. Keeps
   * selectedApplicationSignal in sync so other views observe fresh data.
   * Throws on network errors so the caller can count consecutive failures.
   */
  async refreshApplication(id: string): Promise<Application | null> {
    const app = await firstValueFrom(
      this.applicationsApi.applicationsControllerFindById(id, true)
    );
    if (app) {
      this.selectedApplicationSignal.set(app);
      if (app.id && app.name) this.wsService.registerAppName(app.id, app.name);
    }
    return app;
  }

  /**
   * Delete an application — initiates async deletion, tracks via WebSocket
   * with polling as fallback. WS is subscribed BEFORE the API call to avoid
   * race conditions where the operation completes before subscription is live.
   */
  async deleteApplication(id: string): Promise<void> {
    this.error.set(null);

    try {
      const appName = this.applicationsList().find(a => a.id === id)?.name
        ?? this.selectedApplicationSignal()?.name
        ?? 'Application';

      // cancelled flag shared between WS and polling — first to fire wins
      const cancelled = { value: false };

      // Mark as deleting immediately so UI shows it right away
      this._deletingAppIds.add(id);
      this._updateAppStatus(id, ApplicationStatusEnum.Deleting);

      // Subscribe BEFORE the API call to eliminate the race condition
      this.wsService.subscribeToOperationEvents(id, {
        onProgress: (e) => {
          this._deleteProgress.set(e);
        },
        onCompleted: () => {
          if (cancelled.value) return;
          cancelled.value = true;
          this._onDeleteCompleted(id);
        },
        onFailed: () => {
          if (cancelled.value) return;
          cancelled.value = true;
          this._onDeleteFailed(id);
        },
      });

      const response = await firstValueFrom(
        this.applicationsApi.applicationsControllerDelete(id)
      );

      this.notificationService.add({
        title: `Deleting ${appName}`,
        body: 'The application is being removed.',
        link: { label: 'View applications', route: '/apps/applications' },
        type: 'info',
        source: 'websocket',
        category: 'app-delete',
      });

      const operationId = response?.operation?.id;
      if (operationId) {
        this._pollDeleteOperation(id, operationId, cancelled, appName);
      }
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to delete application';
      console.error('Failed to delete application:', error);
      this.error.set(errorMessage);
      throw error;
    }
  }

  private _onDeleteCompleted(appId: string): void {
    this._deletingAppIds.delete(appId);
    this._deletedAppIds.add(appId);
    this._deleteProgress.set(null);
    this.applicationsList.update(apps => apps.filter(a => a.id !== appId));
    if (this.selectedApplicationSignal()?.id === appId) {
      this.selectedApplicationSignal.set(null);
    }
    this.wsService.unsubscribeFromApp(appId);
  }

  private _onDeleteFailed(appId: string): void {
    this._deletingAppIds.delete(appId);
    this._deleteProgress.set(null);
    this._updateAppStatus(appId, ApplicationStatusEnum.Failed);
    this.wsService.unsubscribeFromApp(appId);
  }

  private _pollDeleteOperation(appId: string, operationId: string, cancelled: { value: boolean }, appName: string): void {
    const POLL_INTERVAL = 3000;
    const MAX_POLLS = 60;
    let pollCount = 0;

    const poll = async (): Promise<void> => {
      if (cancelled.value || pollCount >= MAX_POLLS) return;
      pollCount++;
      try {
        const result = await firstValueFrom(
          this.http.get<{ status: string }>(`${this.appConfig.apiBaseUrl}/api/v1/operations/${operationId}`)
        );
        if (cancelled.value) return;
        if (result.status === 'COMPLETED') {
          cancelled.value = true;
          this._onDeleteCompleted(appId);
          return;
        }
        if (result.status === 'FAILED') {
          cancelled.value = true;
          this._onDeleteFailed(appId);
          return;
        }
      } catch (err: any) {
        if (cancelled.value) return;
        // 404 means the operation record was cleaned up — deletion completed
        if (err?.status === 404) {
          cancelled.value = true;
          this.notificationService.add({
            title: `${appName} deleted`,
            body: 'The application and all its resources have been removed.',
            link: { label: 'View applications', route: '/apps/applications' },
            type: 'success',
            source: 'websocket',
            category: 'app-delete',
          });
          this._onDeleteCompleted(appId);
          return;
        }
        // other errors: ignore and retry
      }
      setTimeout(() => poll(), POLL_INTERVAL);
    };

    setTimeout(() => poll(), POLL_INTERVAL);
  }

  async deploy(id: string, dto?: { imageRef?: string; commitSha?: string; buildId?: string; useCurrentImage?: boolean; reason?: string }): Promise<string | null> {
    this.error.set(null);
    this._updateAppStatus(id, ApplicationStatusEnum.Updating);
    try {
      const result = await firstValueFrom(
        this.applicationsApi.applicationsControllerDeploy(id, {
          imageRef: dto?.imageRef,
          commitSha: dto?.commitSha,
          buildId: dto?.buildId,
          useCurrentImage: dto?.useCurrentImage,
          reason: dto?.reason,
        })
      );
      const operationId: string | null = result?.id ?? null;
      if (operationId) {
        this._trackOperation(id, operationId);
      }
      return operationId;
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Deploy failed';
      this.error.set(msg);
      this._updateAppStatus(id, ApplicationStatusEnum.Failed);
      throw error;
    }
  }

  async stopApplication(id: string): Promise<void> {
    this.error.set(null);
    try {
      await firstValueFrom(this.applicationsApi.applicationsControllerStop(id));
      this._updateAppStatus(id, ApplicationStatusEnum.Stopped);
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Stop failed';
      this.error.set(msg);
      throw error;
    }
  }

  async startApplication(id: string): Promise<void> {
    this.error.set(null);
    try {
      const app = await firstValueFrom(this.applicationsApi.applicationsControllerStart(id));
      this._updateAppInList(app);
      this.selectedApplicationSignal.set(app);
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Start failed';
      this.error.set(msg);
      throw error;
    }
  }

  async rollback(id: string, revisionNumber: number, reason?: string): Promise<void> {
    this.error.set(null);
    this._updateAppStatus(id, ApplicationStatusEnum.RollingBack);
    try {
      await firstValueFrom(
        this.applicationsApi.applicationsControllerRollback(id, { revisionNumber, reason })
      );
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Rollback failed';
      this.error.set(msg);
      this._updateAppStatus(id, ApplicationStatusEnum.Failed);
      throw error;
    }
  }

  async reconcile(id: string): Promise<void> {
    this.error.set(null);
    try {
      await firstValueFrom(this.applicationsApi.applicationsControllerReconcile(id));
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Reconcile failed';
      this.error.set(msg);
      throw error;
    }
  }

  private _updateAppStatus(id: string, status: Application['status']): void {
    this.applicationsList.update(apps =>
      apps.map(a => a.id === id ? { ...a, status } : a)
    );
    if (this.selectedApplicationSignal()?.id === id) {
      this.selectedApplicationSignal.update(a => a ? { ...a, status } : a);
    }
  }

  private _updateAppInList(app: Application): void {
    this.applicationsList.update(apps =>
      apps.map(a => a.id === app.id ? app : a)
    );
  }

  private _trackOperation(appId: string, operationId: string): void {
    this.wsService.ensureAppSubscription(appId);
    const matches = (e: { appId: string; operationId: string; operationType: string }) => {
      if (e.appId !== appId) return false;
      if (e.operationId !== operationId) return false;
      const type = (e.operationType ?? '').toLowerCase();
      return type === 'deploy_application' || type === 'rollback_application';
    };
    this.wsService.onGlobalOperationProgress((e) => {
      if (!matches(e)) return;
      this._updateAppStatus(appId, ApplicationStatusEnum.Updating);
    });
    this.wsService.onGlobalOperationCompleted((e) => {
      if (!matches(e)) return;
      if (e.applicationStatus) {
        this._updateAppStatus(appId, e.applicationStatus as Application['status']);
      }
      if (e.imageRef) {
        this.applicationsList.update(apps =>
          apps.map(a => a.id === appId ? { ...a, imageRef: e.imageRef } : a)
        );
        if (this.selectedApplicationSignal()?.id === appId) {
          this.selectedApplicationSignal.update(a => a ? { ...a, imageRef: e.imageRef } : a);
        }
      }
    });
    this.wsService.onGlobalOperationFailed((e) => {
      if (!matches(e)) return;
      this._updateAppStatus(appId, ApplicationStatusEnum.Failed);
    });
  }

  /** @deprecated Use generateWorkflowV3 for V3 Dockerfile-first flow */
  async generateWorkflow(applicationId: string, params: GenerateWorkflowParams): Promise<GenerateWorkflowResult> {
    try {
      const url = `${this.appConfig.apiBaseUrl}/api/v1/applications/${applicationId}/generate-workflow`;
      const result = await firstValueFrom(
        this.http.post<GenerateWorkflowResult>(url, params)
      );
      return result;
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Failed to generate workflow';
      throw new Error(msg);
    }
  }

  /**
   * V3 workflow generation — Dockerfile-first, universal workflow.
   * Commits .github/workflows/flui.yml to the repo.
   */
  async generateWorkflowV3(applicationId: string, params: { branch: string; isFluiManaged: boolean }): Promise<GenerateWorkflowResult> {
    try {
      const url = `${this.appConfig.apiBaseUrl}/api/v1/applications/${applicationId}/generate-workflow-v3`;
      const result = await firstValueFrom(
        this.http.post<GenerateWorkflowResult>(url, params)
      );
      return result;
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Failed to generate V3 workflow';
      throw new Error(msg);
    }
  }

  async getWorkflowStatus(applicationId: string): Promise<WorkflowStatusResult> {
    return firstValueFrom(
      this.applicationsApi.applicationsControllerGetWorkflowStatus(applicationId)
    );
  }

  clearError(): void {
    this.error.set(null);
  }

  // ===== LEGACY WIZARD METHODS (kept for deploy-wizard/deploy-progress compatibility) =====

  async startDeployment(_config: DeployWizardConfiguration): Promise<{ operationId: string; applicationId: string }> {
    throw new Error('Deploy wizard not yet migrated to new Application API');
  }

  async getDeploymentStatus(_operationId: string): Promise<void> {
    throw new Error('Deploy wizard not yet migrated to new Application API');
  }

  stopDeploymentPolling(): void {
    if (this.deploymentPollingInterval) {
      clearInterval(this.deploymentPollingInterval);
      this.deploymentPollingInterval = null;
    }
  }
}
