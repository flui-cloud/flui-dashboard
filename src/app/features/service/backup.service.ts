import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BackupsService } from '../../core/api/api/backups.service';
import { CreateBackupDestinationDto } from '../../core/api/model/createBackupDestinationDto';
import { CreateBackupPolicyDto } from '../../core/api/model/createBackupPolicyDto';
import { CreateRestoreJobDto } from '../../core/api/model/createRestoreJobDto';
import { RestorePreviewDto } from '../../core/api/model/restorePreviewDto';
import { QuickSetupDto } from '../../core/api/model/quickSetupDto';
import {
  ActiveOperation,
  BackupArtifact,
  BackupDestination,
  BackupJob,
  BackupPolicy,
  BackupStatus,
  RestoreJob,
  RestorePreviewResult,
  SetupOptions,
} from '../model/backup.models';
import {
  InfrastructureOperationCompletedDto,
  InfrastructureOperationFailedDto,
  InfrastructureOperationProgressDto,
  InfrastructureWebSocketService,
} from './infrastructure-websocket.service';

export interface RunBackupResult {
  job: BackupJob;
  operationId?: string;
}

export interface CreateRestoreResult {
  restore: RestoreJob;
  operationId?: string;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly api = inject(BackupsService);
  private readonly ws = inject(InfrastructureWebSocketService);

  private readonly _destinations = signal<BackupDestination[]>([]);
  private readonly _policies = signal<BackupPolicy[]>([]);
  private readonly _jobs = signal<BackupJob[]>([]);
  private readonly _restoreJobs = signal<RestoreJob[]>([]);
  private readonly _selectedDestination = signal<BackupDestination | null>(null);
  private readonly _selectedPolicy = signal<BackupPolicy | null>(null);
  private readonly _selectedJob = signal<BackupJob | null>(null);
  private readonly _selectedRestore = signal<RestoreJob | null>(null);
  private readonly _activeOps = signal<Record<string, ActiveOperation>>({});
  private readonly _status = signal<BackupStatus | null>(null);
  private readonly _statusLoading = signal(false);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly destinations = this._destinations.asReadonly();
  readonly policies = this._policies.asReadonly();
  readonly jobs = this._jobs.asReadonly();
  readonly restoreJobs = this._restoreJobs.asReadonly();
  readonly selectedDestination = this._selectedDestination.asReadonly();
  readonly selectedPolicy = this._selectedPolicy.asReadonly();
  readonly selectedJob = this._selectedJob.asReadonly();
  readonly selectedRestore = this._selectedRestore.asReadonly();
  readonly activeOperations = this._activeOps.asReadonly();
  readonly status = this._status.asReadonly();
  readonly statusLoading = this._statusLoading.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly degradedPolicies = computed(() =>
    this._policies().filter((p) => p.status === 'degraded' || p.status === 'failed')
  );
  readonly totalUsageBytes = computed(() =>
    this._destinations().reduce((sum, d) => sum + Number(d.usageBytes ?? 0), 0)
  );

  policiesByCluster(clusterId: string): BackupPolicy[] {
    return this._policies().filter((p) => p.clusterId === clusterId);
  }

  async loadDestinations(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = (await firstValueFrom(
        this.api.backupDestinationsControllerList()
      )) as BackupDestination[];
      this._destinations.set(res ?? []);
    } catch (err: any) {
      this._error.set(err?.error?.message ?? err?.message ?? 'Failed to load destinations');
    } finally {
      this._loading.set(false);
    }
  }

  async getDestination(id: string): Promise<BackupDestination | null> {
    try {
      const res = (await firstValueFrom(
        this.api.backupDestinationsControllerGet(id)
      )) as BackupDestination;
      this._selectedDestination.set(res);
      return res;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to load destination');
      return null;
    }
  }

  async createDestination(dto: CreateBackupDestinationDto): Promise<BackupDestination | null> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = (await firstValueFrom(
        this.api.backupDestinationsControllerCreate(dto)
      )) as BackupDestination;
      this._destinations.update((list) => [res, ...list]);
      return res;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to create destination');
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async testDestination(id: string): Promise<{ healthy: boolean; error?: string } | null> {
    try {
      const res = (await firstValueFrom(
        this.api.backupDestinationsControllerTest(id)
      )) as { healthy: boolean; error?: string };
      // Server side updates healthStatus — refresh entry
      await this.refreshDestinationInList(id);
      return res;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to test destination');
      return null;
    }
  }

  async refreshUsage(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.backupDestinationsControllerRefresh(id));
      await this.refreshDestinationInList(id);
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to refresh usage');
    }
  }

  async deleteDestination(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.backupDestinationsControllerRemove(id));
      this._destinations.update((list) => list.filter((d) => d.id !== id));
      if (this._selectedDestination()?.id === id) this._selectedDestination.set(null);
      return true;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to delete destination');
      return false;
    }
  }

  private async refreshDestinationInList(id: string): Promise<void> {
    const fresh = await this.getDestination(id);
    if (!fresh) return;
    this._destinations.update((list) => {
      const idx = list.findIndex((d) => d.id === id);
      if (idx === -1) return [fresh, ...list];
      const copy = [...list];
      copy[idx] = fresh;
      return copy;
    });
  }

  async loadPolicies(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = (await firstValueFrom(
        this.api.backupPoliciesControllerList()
      )) as BackupPolicy[];
      this._policies.set(res ?? []);
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to load policies');
    } finally {
      this._loading.set(false);
    }
  }

  async loadPoliciesByCluster(clusterId: string): Promise<BackupPolicy[]> {
    try {
      const res = (await firstValueFrom(
        this.api.backupPoliciesControllerListByCluster(clusterId)
      )) as BackupPolicy[];
      return res ?? [];
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to load cluster policies');
      return [];
    }
  }

  async getPolicy(id: string): Promise<BackupPolicy | null> {
    try {
      const res = (await firstValueFrom(
        this.api.backupPoliciesControllerGet(id)
      )) as BackupPolicy;
      this._selectedPolicy.set(res);
      return res;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to load policy');
      return null;
    }
  }

  async createPolicy(dto: CreateBackupPolicyDto): Promise<BackupPolicy | null> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = (await firstValueFrom(
        this.api.backupPoliciesControllerCreate(dto)
      )) as BackupPolicy;
      this._policies.update((list) => [res, ...list]);
      return res;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to create policy');
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async deletePolicy(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.backupPoliciesControllerRemove(id));
      this._policies.update((list) => list.filter((p) => p.id !== id));
      if (this._selectedPolicy()?.id === id) this._selectedPolicy.set(null);
      return true;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to delete policy');
      return false;
    }
  }

  async loadJobsByCluster(clusterId: string): Promise<void> {
    try {
      const res = (await firstValueFrom(
        this.api.backupJobsControllerListByCluster(clusterId)
      )) as BackupJob[];
      this._jobs.set(res ?? []);
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to load jobs');
    }
  }

  async getJob(id: string): Promise<BackupJob | null> {
    try {
      const res = (await firstValueFrom(this.api.backupJobsControllerGet(id))) as BackupJob;
      this._selectedJob.set(res);
      this.upsertJob(res);
      return res;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to load job');
      return null;
    }
  }

  async runOnDemand(policyId: string, metadata?: object): Promise<RunBackupResult | null> {
    try {
      const job = (await firstValueFrom(
        this.api.backupJobsControllerCreate({ policyId, metadata })
      )) as BackupJob;
      this.upsertJob(job);
      const operationId = job.infrastructureOperationId;
      if (operationId) this.trackOperation(operationId, { jobId: job.id, resourceType: 'backup_job' });
      return { job, operationId };
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to start backup');
      return null;
    }
  }

  private upsertJob(job: BackupJob): void {
    this._jobs.update((list) => {
      const idx = list.findIndex((j) => j.id === job.id);
      if (idx === -1) return [job, ...list];
      const copy = [...list];
      copy[idx] = job;
      return copy;
    });
  }

  async loadRestoreJobs(): Promise<void> {
    try {
      const res = (await firstValueFrom(
        this.api.restoreJobsControllerList()
      )) as RestoreJob[];
      this._restoreJobs.set(res ?? []);
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to load restore jobs');
    }
  }

  async getRestoreJob(id: string): Promise<RestoreJob | null> {
    try {
      const res = (await firstValueFrom(
        this.api.restoreJobsControllerGet(id)
      )) as RestoreJob;
      this._selectedRestore.set(res);
      return res;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to load restore job');
      return null;
    }
  }

  async previewRestore(dto: RestorePreviewDto): Promise<RestorePreviewResult | null> {
    try {
      const res = (await firstValueFrom(
        this.api.restoreJobsControllerPreview(dto)
      )) as RestorePreviewResult;
      return res;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to preview restore');
      return null;
    }
  }

  async createRestore(dto: CreateRestoreJobDto): Promise<CreateRestoreResult | null> {
    try {
      const res = (await firstValueFrom(
        this.api.restoreJobsControllerCreate(dto)
      )) as RestoreJob;
      this._restoreJobs.update((list) => [res, ...list]);
      const operationId = res.infrastructureOperationId;
      if (operationId)
        this.trackOperation(operationId, { jobId: res.id, resourceType: 'restore_job' });
      return { restore: res, operationId };
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to start restore');
      return null;
    }
  }

  private trackOperation(
    operationId: string,
    meta: { jobId?: string; resourceType?: ActiveOperation['resourceType'] }
  ): void {
    this._activeOps.update((map) => ({
      ...map,
      [operationId]: {
        operationId,
        jobId: meta.jobId,
        resourceType: meta.resourceType,
        percentage: 0,
        currentStep: '',
        totalSteps: 0,
        message: 'Starting…',
        status: 'running',
        startedAt: Date.now(),
      },
    }));

    this.ws.subscribeToOperation(operationId, {
      onProgress: (e) => this.handleProgress(e),
      onCompleted: (e) => this.handleCompleted(e),
      onFailed: (e) => this.handleFailed(e),
    });
  }

  private handleProgress(e: InfrastructureOperationProgressDto): void {
    this._activeOps.update((map) => {
      const op = map[e.operationId];
      if (!op) return map;
      return {
        ...map,
        [e.operationId]: {
          ...op,
          percentage: e.percentage,
          currentStep: `${e.currentStepIndex}/${e.totalSteps}`,
          totalSteps: e.totalSteps,
          message: e.message,
        },
      };
    });
  }

  private handleCompleted(e: InfrastructureOperationCompletedDto): void {
    this._activeOps.update((map) => {
      const op = map[e.operationId];
      if (!op) return map;
      return {
        ...map,
        [e.operationId]: { ...op, status: 'completed', percentage: 100, endedAt: Date.now() },
      };
    });
    this.ws.unsubscribeFromOperation(e.operationId);
    const op = this._activeOps()[e.operationId];
    if (op?.jobId) {
      if (op.resourceType === 'backup_job') void this.getJob(op.jobId);
      if (op.resourceType === 'restore_job') void this.getRestoreJob(op.jobId);
    }
  }

  private handleFailed(e: InfrastructureOperationFailedDto): void {
    this._activeOps.update((map) => {
      const op = map[e.operationId];
      if (!op) return map;
      return {
        ...map,
        [e.operationId]: { ...op, status: 'failed', error: e.error, endedAt: Date.now() },
      };
    });
    this.ws.unsubscribeFromOperation(e.operationId);
  }

  async loadStatus(): Promise<BackupStatus | null> {
    this._statusLoading.set(true);
    try {
      const res = (await firstValueFrom(
        this.api.backupStatusControllerStatus()
      )) as BackupStatus;
      this._status.set(res);
      return res;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to load backup status');
      return null;
    } finally {
      this._statusLoading.set(false);
    }
  }

  async getSetupOptions(clusterId: string): Promise<SetupOptions | null> {
    try {
      const res = (await firstValueFrom(
        this.api.quickSetupControllerOptions(clusterId)
      )) as SetupOptions;
      return res;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Failed to load setup options');
      return null;
    }
  }

  async startQuickSetup(
    clusterId: string,
    dto: QuickSetupDto
  ): Promise<{ operationId: string } | null> {
    try {
      const res = (await firstValueFrom(
        this.api.quickSetupControllerStart(clusterId, dto)
      )) as { operationId: string };
      if (res?.operationId) {
        this.trackOperation(res.operationId, { resourceType: 'quick_setup' });
      }
      return res;
    } catch (err: any) {
      this._error.set(err?.error?.message ?? 'Quick setup failed');
      return null;
    }
  }

  clearOperation(operationId: string): void {
    this._activeOps.update((map) => {
      const { [operationId]: _, ...rest } = map;
      return rest;
    });
  }

  clearError(): void {
    this._error.set(null);
  }
}

export type { BackupArtifact };
