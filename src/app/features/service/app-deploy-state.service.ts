import { Injectable, computed, inject, signal } from '@angular/core';
import { AvailableVersionDto } from '../../core/api/model/availableVersionDto';
import { AppOperationResponseDto } from '../../core/api/model/appOperationResponseDto';
import {
  AppRuntimeWebSocketService,
  OperationCompletedEvent,
  OperationFailedEvent,
  OperationProgressEvent,
} from './app-runtime-websocket.service';
import { AppVersioningService } from './app-versioning.service';

export interface DeployInFlight {
  appId: string;
  operationId: string;
  targetImageRef: string;
  targetDigest: string | null;
  progress: number;
  message: string;
  startedAt: Date;
}

const TRACKED_OP_TYPES = new Set([
  'deploy_application',
  'rollback_application',
]);

@Injectable({ providedIn: 'root' })
export class AppDeployStateService {
  private readonly ws = inject(AppRuntimeWebSocketService);
  private readonly versioning = inject(AppVersioningService);

  private readonly deployInFlightSig = signal<DeployInFlight | null>(null);
  private readonly errorSig = signal<string | null>(null);

  readonly deployInFlight = this.deployInFlightSig.asReadonly();
  readonly error = this.errorSig.asReadonly();
  readonly progress = computed(() => this.deployInFlightSig()?.progress ?? null);

  readonly currentlyDeployed = computed(() =>
    this.versioning.versions().find((v) => v.isCurrentlyDeployed) ?? null,
  );

  constructor() {
    this.ws.onGlobalOperationProgress((e) => this.handleProgress(e));
    this.ws.onGlobalOperationCompleted((e) => void this.handleCompleted(e));
    this.ws.onGlobalOperationFailed((e) => void this.handleFailed(e));
  }

  startDeploy(input: {
    appId: string;
    operationId: string;
    targetImageRef: string;
    targetDigest?: string | null;
  }): void {
    this.errorSig.set(null);
    this.ws.ensureAppSubscription(input.appId);
    this.deployInFlightSig.set({
      appId: input.appId,
      operationId: input.operationId,
      targetImageRef: input.targetImageRef,
      targetDigest: input.targetDigest ?? null,
      progress: 0,
      message: 'Deploy started…',
      startedAt: new Date(),
    });
  }

  resumeFromLastOperation(
    appId: string,
    lastOperation: AppOperationResponseDto | null | undefined,
  ): void {
    if (!lastOperation) return;
    const status = (lastOperation.status ?? '').toUpperCase();
    if (status !== 'IN_PROGRESS' && status !== 'PENDING') return;
    const type = (lastOperation.operationType ?? '').toLowerCase();
    if (!TRACKED_OP_TYPES.has(type)) return;
    if (!lastOperation.imageRef) return;
    this.ws.ensureAppSubscription(appId);
    this.deployInFlightSig.set({
      appId,
      operationId: lastOperation.id,
      targetImageRef: lastOperation.imageRef,
      targetDigest: lastOperation.digest ?? null,
      progress: lastOperation.progress ?? 0,
      message: lastOperation.currentStep || 'Rollout in progress…',
      startedAt: lastOperation.startedAt ? new Date(lastOperation.startedAt) : new Date(),
    });
  }

  isReleasing(v: AvailableVersionDto): boolean {
    const df = this.deployInFlightSig();
    if (!df) return false;
    if (df.targetDigest && v.digest) return df.targetDigest === v.digest;
    return df.targetImageRef === v.imageRef;
  }

  isCurrentRow(v: AvailableVersionDto): boolean {
    return v.isCurrentlyDeployed;
  }

  clearError(): void {
    this.errorSig.set(null);
  }

  private handleProgress(e: OperationProgressEvent): void {
    const df = this.deployInFlightSig();
    if (!df || !this.matches(df, e)) return;
    this.deployInFlightSig.set({
      ...df,
      progress: e.percentage,
      message: e.message,
    });
  }

  private async handleCompleted(e: OperationCompletedEvent): Promise<void> {
    const df = this.deployInFlightSig();
    if (!df || !this.matches(df, e)) return;
    try {
      await this.versioning.loadAvailableVersions(df.appId);
    } catch {
      // versions service already surfaced the error
    }
    this.deployInFlightSig.set(null);
  }

  private async handleFailed(e: OperationFailedEvent): Promise<void> {
    const df = this.deployInFlightSig();
    if (!df || !this.matches(df, e)) return;
    this.errorSig.set(e.error || 'Deploy failed');
    try {
      await this.versioning.loadAvailableVersions(df.appId);
    } catch {
      // versions service already surfaced the error
    }
    this.deployInFlightSig.set(null);
  }

  private matches(
    df: DeployInFlight,
    e: { appId: string; operationId: string; operationType: string },
  ): boolean {
    if (e.appId !== df.appId) return false;
    if (e.operationId !== df.operationId) return false;
    return TRACKED_OP_TYPES.has((e.operationType ?? '').toLowerCase());
  }
}
