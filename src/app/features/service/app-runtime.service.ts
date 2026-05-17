import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicationManagementService } from '../../core/api/api/applicationManagement.service';
import { ClusterMetricsLogsService } from '../../core/api/api/clusterMetricsLogs.service';
import { AppRuntimeResponseDto } from '../../core/api/model/appRuntimeResponseDto';
import { UpdateResourcesDto } from '../../core/api/model/updateResourcesDto';
import { UpdateReplicasDto } from '../../core/api/model/updateReplicasDto';
import {
  AppRuntimeWebSocketService,
  RolloutProgressEvent,
} from './app-runtime-websocket.service';

export interface RolloutState {
  active: boolean;
  operation: string;
  percentage: number;
  readyReplicas: number;
  desiredReplicas: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AppRuntimeService {
  private readonly api = inject(ApplicationManagementService);
  private readonly metricsApi = inject(ClusterMetricsLogsService);
  private readonly ws = inject(AppRuntimeWebSocketService);

  private readonly runtimeData = signal<AppRuntimeResponseDto | null>(null);
  private readonly loadingData = signal(false);
  private readonly savingReplicasData = signal(false);
  private readonly savingResourcesData = signal(false);
  private readonly savingRestartData = signal(false);
  private readonly errorData = signal<string | null>(null);
  private readonly maxCpuMcData = signal(4000);
  private readonly maxMemMibData = signal(4096);
  private readonly rolloutData = signal<RolloutState | null>(null);
  private currentAppId: string | null = null;

  readonly runtime = this.runtimeData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly savingReplicas = this.savingReplicasData.asReadonly();
  readonly savingResources = this.savingResourcesData.asReadonly();
  readonly savingRestart = this.savingRestartData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly maxCpuMc = this.maxCpuMcData.asReadonly();
  readonly maxMemMib = this.maxMemMibData.asReadonly();
  readonly rollout = this.rolloutData.asReadonly();

  async loadClusterCapacity(clusterId: string): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.metricsApi.serverMetricsControllerGetClusterMetrics(clusterId)
      );
      const servers = result?.servers ?? [];
      if (!servers.length) return;
      const totalCores = servers.reduce((s, n) => s + (n.cpu?.cores ?? 0), 0);
      const totalBytes = servers.reduce((s, n) => s + (n.memory?.total_bytes ?? 0), 0);
      this.maxCpuMcData.set(Math.floor(totalCores * 1000 * 0.8));
      this.maxMemMibData.set(Math.floor((totalBytes / (1024 * 1024)) * 0.8));
    } catch {
      // silently keep defaults on error
    }
  }

  async loadRuntime(appId: string): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.appManagementControllerGetRuntimeStatus(appId)
      );
      this.runtimeData.set(result ?? null);
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to load runtime status'));
    } finally {
      this.loadingData.set(false);
    }
  }

  async updateResources(appId: string, dto: UpdateResourcesDto): Promise<boolean> {
    this.savingResourcesData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.appManagementControllerUpdateResources(appId, dto)
      );
      this.runtimeData.set(result ?? null);
      this.watchRollout(appId, 'update-resources');
      return true;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to update resources'));
      return false;
    } finally {
      this.savingResourcesData.set(false);
    }
  }

  async updateReplicas(appId: string, dto: UpdateReplicasDto): Promise<boolean> {
    this.savingReplicasData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.appManagementControllerUpdateReplicas(appId, dto)
      );
      this.runtimeData.set(result ?? null);
      this.watchRollout(appId, 'scale');
      return true;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to update replicas'));
      return false;
    } finally {
      this.savingReplicasData.set(false);
    }
  }

  async restart(appId: string): Promise<boolean> {
    this.savingRestartData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.appManagementControllerRestartDeployment(appId)
      );
      this.runtimeData.set(result ?? null);
      this.watchRollout(appId, 'restart');
      return true;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to restart application'));
      return false;
    } finally {
      this.savingRestartData.set(false);
    }
  }

  clearRuntime(): void {
    if (this.currentAppId) {
      this.ws.unsubscribeFromApp(this.currentAppId);
      this.currentAppId = null;
    }
    this.runtimeData.set(null);
    this.rolloutData.set(null);
  }

  clearError(): void {
    this.errorData.set(null);
  }

  private watchRollout(appId: string, operation: string): void {
    if (this.currentAppId && this.currentAppId !== appId) {
      this.ws.unsubscribeFromApp(this.currentAppId);
    }
    this.currentAppId = appId;

    this.rolloutData.set({
      active: true,
      operation,
      percentage: 0,
      readyReplicas: 0,
      desiredReplicas: this.runtimeData()?.replicas?.desired ?? 1,
      message: 'Rolling update started…',
    });

    this.ws.subscribeToApp(appId, {
      onProgress: (e: RolloutProgressEvent) => {
        this.rolloutData.set({
          active: true,
          operation: e.operation,
          percentage: e.percentage,
          readyReplicas: e.readyReplicas,
          desiredReplicas: e.desiredReplicas,
          message: e.message,
        });
      },
      onCompleted: (e) => {
        this.runtimeData.set(e.runtimeSnapshot ?? null);
        this.rolloutData.set(null);
        this.ws.unsubscribeFromApp(appId);
      },
      onFailed: (e) => {
        this.errorData.set(e.error || 'Rollout failed');
        this.rolloutData.set(null);
        this.ws.unsubscribeFromApp(appId);
      },
    });
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
