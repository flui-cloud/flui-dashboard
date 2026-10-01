import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import { BackupsService } from '../../core/api/api/backups.service';
import { ActiveOperation, BackupJob } from '../model/backup.models';
import { BackupJobOutcome, backupJobOutcome } from '../model/backup-job-outcome';
import {
  InfrastructureOperationProgressDto,
  InfrastructureWebSocketService,
} from './infrastructure-websocket.service';

export interface TrackOptions {
  jobId?: string;
  resourceType?: NonNullable<ActiveOperation['resourceType']>;
  onSettled?: (op: ActiveOperation) => void;
}

interface PolledOperation {
  status?: string;
  progress?: number;
  currentStep?: string;
  errorMessage?: string;
}

const POLL_MS = 3_000;
const POLL_FOR_MS = 30 * 60_000;

function humanStep(step: string): string {
  const words = step.replaceAll('_', ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Follows the operations behind backup runs, restores and setups until they
 * end. A backup run is settled from the run itself, which says whether it was
 * complete, partial or failed and why; the operation only adds progress.
 */
@Injectable({ providedIn: 'root' })
export class BackupOperationsTracker {
  private readonly api = inject(BackupsService);
  private readonly ws = inject(InfrastructureWebSocketService);
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly _ops = signal<Record<string, ActiveOperation>>({});
  private readonly settledHooks = new Map<string, (op: ActiveOperation) => void>();
  readonly operations = this._ops.asReadonly();

  track(operationId: string, options: TrackOptions = {}): void {
    this._ops.update((map) => ({
      ...map,
      [operationId]: {
        operationId,
        jobId: options.jobId,
        resourceType: options.resourceType,
        percentage: 0,
        currentStep: '',
        totalSteps: 0,
        message: 'Starting…',
        status: 'running',
        startedAt: Date.now(),
      },
    }));
    if (options.onSettled) this.settledHooks.set(operationId, options.onSettled);
    this.ws.subscribeToOperation(operationId, {
      onProgress: (e) => this.progress(e),
      onCompleted: () => void this.settleFromJobOr(operationId, { status: 'completed', partial: false }),
      onFailed: (e) =>
        void this.settleFromJobOr(operationId, { status: 'failed', partial: false, detail: e.error }),
    });
    void this.poll(operationId);
  }

  clear(operationId: string): void {
    this.settledHooks.delete(operationId);
    this.ws.unsubscribeFromOperation(operationId);
    this._ops.update((map) => {
      const { [operationId]: _, ...rest } = map;
      return rest;
    });
  }

  private running(operationId: string): ActiveOperation | null {
    const op = this._ops()[operationId];
    return op?.status === 'running' ? op : null;
  }

  private async poll(operationId: string): Promise<void> {
    const deadline = Date.now() + POLL_FOR_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const tracked = this.running(operationId);
      if (!tracked) return;
      const job = await this.readJob(tracked);
      const outcome = job ? backupJobOutcome(job) : null;
      if (outcome) {
        this.settle(operationId, outcome);
        return;
      }
      const op = await this.readOperation(operationId);
      if (!op) continue;
      const status = (op.status ?? '').toUpperCase();
      const settlesHere = !job || tracked.resourceType !== 'backup_job';
      if (settlesHere && status === 'COMPLETED') {
        this.settle(operationId, { status: 'completed', partial: false });
        return;
      }
      if (settlesHere && (status === 'FAILED' || status === 'CANCELLED')) {
        this.settle(operationId, { status: 'failed', partial: false, detail: op.errorMessage ?? 'The operation failed' });
        return;
      }
      this.patch(operationId, (current) => ({
        percentage: Math.max(current.percentage, op.progress ?? 0),
        message: op.currentStep ? humanStep(op.currentStep) : current.message,
      }));
    }
  }

  private async readJob(op: ActiveOperation): Promise<BackupJob | null> {
    if (op.resourceType !== 'backup_job' || !op.jobId) return null;
    try {
      return (await firstValueFrom(this.api.backupJobsControllerGet(op.jobId))) as BackupJob;
    } catch {
      return null;
    }
  }

  private async readOperation(operationId: string): Promise<PolledOperation | null> {
    try {
      return await firstValueFrom(
        this.http.get<PolledOperation>(
          `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/operations/${operationId}`,
        ),
      );
    } catch {
      return null;
    }
  }

  private async settleFromJobOr(operationId: string, fallback: BackupJobOutcome): Promise<void> {
    const tracked = this.running(operationId);
    if (!tracked) return;
    const job = await this.readJob(tracked);
    this.settle(operationId, (job && backupJobOutcome(job)) || fallback);
  }

  private progress(e: InfrastructureOperationProgressDto): void {
    this.patch(e.operationId, () => ({
      percentage: e.percentage,
      currentStep: `${e.currentStepIndex}/${e.totalSteps}`,
      totalSteps: e.totalSteps,
      message: e.message,
    }));
  }

  private patch(operationId: string, change: (op: ActiveOperation) => Partial<ActiveOperation>): void {
    this._ops.update((map) => {
      const current = map[operationId];
      if (current?.status !== 'running') return map;
      return { ...map, [operationId]: { ...current, ...change(current) } };
    });
  }

  private settle(operationId: string, outcome: BackupJobOutcome): void {
    if (!this.running(operationId)) return;
    this.patch(operationId, (current) => ({
      status: outcome.status,
      partial: outcome.partial,
      detail: outcome.status === 'completed' ? outcome.detail : undefined,
      error: outcome.status === 'failed' ? (outcome.detail ?? 'The operation failed') : undefined,
      percentage: outcome.status === 'completed' ? 100 : current.percentage,
      endedAt: Date.now(),
    }));
    this.ws.unsubscribeFromOperation(operationId);
    const settled = this._ops()[operationId];
    const hook = this.settledHooks.get(operationId);
    this.settledHooks.delete(operationId);
    if (settled && hook) hook(settled);
  }
}
