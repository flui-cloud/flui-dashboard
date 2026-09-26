import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicationManagementService } from '../../core/api/api/applicationManagement.service';
import { HttpClient } from '@angular/common/http';
import { AppConfigService } from '../../core/services/app-config.service';
import { ToastService } from '../../shared/services/toast.service';
import { AppRuntimeResponseDto } from '../../core/api/model/appRuntimeResponseDto';
import { UpdateResourcesDto } from '../../core/api/model/updateResourcesDto';
import { UpdateReplicasDto } from '../../core/api/model/updateReplicasDto';
import {
  AppRuntimeWebSocketService,
  RolloutProgressEvent,
} from './app-runtime-websocket.service';

export interface ResourceProposal {
  containerName: string;
  currentRequests: { cpu: string | null; memory: string | null };
  currentLimits: { cpu: string | null; memory: string | null };
  reasons: { kind: 'oom' | 'near-limit' | 'above-request'; sentence: string }[];
  consequence: ResourcesConsequence;
  restart: string;
  configurationNote: string | null;
  diagnosisId: string | null;
}

export interface ResourceProposalAnswer {
  proposal: ResourceProposal | null;
  usageRead: boolean;
}

export type PlacementVerdict = 'fits' | 'buys' | 'proposes' | 'nothing-hosts' | 'unknown';

export interface ResourcesConsequence {
  requests: { cpu: string | null; memory: string | null };
  limits: { cpu: string | null; memory: string | null };
  problem: string | null;
  placement: {
    verdict: PlacementVerdict;
    sentence: string;
    node: string | null;
    shape: string | null;
    region: string | null;
    monthlyEur: number | null;
    why: string | null;
    largest: { shape: string | null; cpuMillicores: number; memoryMi: number } | null;
  };
}

export interface RolloutState {
  active: boolean;
  operation: string;
  percentage: number;
  readyReplicas: number;
  desiredReplicas: number;
  message: string;
  waitingForRoom?: number;
}

@Injectable({ providedIn: 'root' })
export class AppRuntimeService {
  private readonly api = inject(ApplicationManagementService);
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly toast = inject(ToastService);
  private readonly ws = inject(AppRuntimeWebSocketService);

  private readonly runtimeData = signal<AppRuntimeResponseDto | null>(null);
  private readonly loadingData = signal(false);
  private readonly savingReplicasData = signal(false);
  private readonly savingResourcesData = signal(false);
  private readonly savingRestartData = signal(false);
  private readonly errorData = signal<string | null>(null);
  private readonly rolloutData = signal<RolloutState | null>(null);
  private currentAppId: string | null = null;

  readonly runtime = this.runtimeData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly savingReplicas = this.savingReplicasData.asReadonly();
  readonly savingResources = this.savingResourcesData.asReadonly();
  readonly savingRestart = this.savingRestartData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly rollout = this.rolloutData.asReadonly();

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
      const written = result?.containers.find(c => c.name === dto.containerName) ?? result?.containers[0];
      this.toast.showSuccess({
        title: 'Resources saved — the app restarts with them',
        message: written
          ? `CPU ${written.requests.cpu ?? '—'} reserved, ${written.limits.cpu ?? '—'} at most · memory ${written.requests.memory ?? '—'} reserved, ${written.limits.memory ?? '—'} at most`
          : 'The new values are being applied.',
      });
      return true;
    } catch (err: unknown) {
      const message = this.extractErrorMessage(err, 'Failed to update resources');
      this.errorData.set(message);
      this.toast.showError({ title: 'Resources not saved', message });
      return false;
    } finally {
      this.savingResourcesData.set(false);
    }
  }

  proposal(appId: string): Promise<ResourceProposalAnswer> {
    return firstValueFrom(
      this.http.get<ResourceProposalAnswer>(
        `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/resources/proposal`,
      ),
    );
  }

  async applyProposal(appId: string, proposal: ResourceProposal): Promise<ResourceProposalAnswer | null> {
    this.savingResourcesData.set(true);
    try {
      const answer = await firstValueFrom(
        this.http.post<ResourceProposalAnswer>(
          `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/resources/proposal/apply`,
          {},
        ),
      );
      this.watchRollout(appId, 'update-resources');
      this.toast.showSuccess({
        title: 'Proposal applied — the app restarts with it',
        message: `Memory ${proposal.consequence.requests.memory ?? '—'} reserved, ${proposal.consequence.limits.memory ?? '—'} at most`,
      });
      await this.loadRuntime(appId);
      return answer;
    } catch (err: unknown) {
      const message = this.extractErrorMessage(err, 'Failed to apply the proposal');
      this.toast.showError({ title: 'Proposal not applied', message });
      return null;
    } finally {
      this.savingResourcesData.set(false);
    }
  }

  consequence(appId: string, dto: UpdateResourcesDto): Promise<ResourcesConsequence> {
    return firstValueFrom(
      this.http.post<ResourcesConsequence>(
        `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/resources/consequence`,
        dto,
      ),
    );
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
          waitingForRoom: e.waitingForRoom ?? 0,
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
