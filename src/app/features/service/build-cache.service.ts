import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BuildNamespaceService } from '../../core/api/api/buildNamespace.service';
import { BuildCacheInfoResponseDto } from '../../core/api/model/buildCacheInfoResponseDto';
import { BuildCacheBreakdownResponseDto } from '../../core/api/model/buildCacheBreakdownResponseDto';
import { InfrastructureWebSocketService } from './infrastructure-websocket.service';
import { isSandboxRefusal } from '../../core/services/sandbox.service';

@Injectable({
  providedIn: 'root',
})
export class BuildCacheService implements OnDestroy {
  private readonly buildNamespaceApi = inject(BuildNamespaceService);
  private readonly infrastructureWs = inject(InfrastructureWebSocketService);

  // PVC status state
  private readonly cacheStatusData = signal<BuildCacheInfoResponseDto | null>(null);
  private readonly isLoadingStatusData = signal(false);
  private readonly statusErrorData = signal<string | null>(null);
  /**
   * The build cache belongs to the instance, not to a tenancy, so a guest of
   * the demo is refused here by design. Kept apart from the failures because a
   * red banner over a deliberate limit reads as a broken product.
   */
  private readonly refusalData = signal<string | null>(null);

  // Cache clear state (WebSocket-driven)
  private readonly isClearingCacheData = signal(false);
  private readonly clearProgressData = signal(0);
  private readonly clearMessageData = signal('');
  private readonly clearStepIndexData = signal(0);
  private readonly clearTotalStepsData = signal(3);
  private readonly clearResultData = signal<'success' | 'failed' | null>(null);
  private readonly clearErrorData = signal<string | null>(null);
  private readonly activeOperationId = signal<string | null>(null);

  // Breakdown state (polling-driven)
  private readonly breakdownData = signal<BuildCacheBreakdownResponseDto | null>(null);
  private readonly isLoadingBreakdownData = signal(false);
  private readonly isRefreshingBreakdownData = signal(false);
  private readonly breakdownErrorData = signal<string | null>(null);
  private readonly refreshSkippedData = signal(false);
  private readonly refreshSkippedReasonData = signal<string | null>(null);

  private breakdownPollInterval: ReturnType<typeof setInterval> | null = null;

  // Public readonly signals
  readonly cacheStatus = this.cacheStatusData.asReadonly();
  readonly isLoadingStatus = this.isLoadingStatusData.asReadonly();
  readonly statusError = this.statusErrorData.asReadonly();
  readonly refusal = this.refusalData.asReadonly();

  readonly isClearingCache = this.isClearingCacheData.asReadonly();
  readonly clearProgress = this.clearProgressData.asReadonly();
  readonly clearMessage = this.clearMessageData.asReadonly();
  readonly clearStepIndex = this.clearStepIndexData.asReadonly();
  readonly clearTotalSteps = this.clearTotalStepsData.asReadonly();
  readonly clearResult = this.clearResultData.asReadonly();
  readonly clearError = this.clearErrorData.asReadonly();

  readonly breakdown = this.breakdownData.asReadonly();
  readonly isLoadingBreakdown = this.isLoadingBreakdownData.asReadonly();
  readonly isRefreshingBreakdown = this.isRefreshingBreakdownData.asReadonly();
  readonly breakdownError = this.breakdownErrorData.asReadonly();
  readonly refreshSkipped = this.refreshSkippedData.asReadonly();
  readonly refreshSkippedReason = this.refreshSkippedReasonData.asReadonly();

  /**
   * One place decides whether what just happened was a no or a fault. Returns
   * the failure text for the red banner, or null when it was a refusal — which
   * is recorded once, on its own signal, for the screen to say plainly.
   */
  private note(e: unknown, fallback: string): string | null {
    const server = (e as { error?: { message?: string } })?.error?.message;
    if (isSandboxRefusal(e)) {
      this.refusalData.set(server ?? 'This is not part of the trial.');
      return null;
    }
    return server ?? fallback;
  }

  async loadCacheStatus(clusterId: string): Promise<void> {
    this.isLoadingStatusData.set(true);
    this.statusErrorData.set(null);
    try {
      const data = await firstValueFrom(
        this.buildNamespaceApi.buildNamespaceControllerGetCacheInfo(clusterId)
      );
      this.cacheStatusData.set(data);
    } catch (e: any) {
      this.statusErrorData.set(this.note(e, 'Failed to load cache status'));
      this.cacheStatusData.set(null);
    } finally {
      this.isLoadingStatusData.set(false);
    }
  }

  async clearCache(clusterId: string): Promise<void> {
    this.isClearingCacheData.set(true);
    this.clearProgressData.set(0);
    this.clearMessageData.set('Starting cache clear...');
    this.clearResultData.set(null);
    this.clearErrorData.set(null);
    this.clearStepIndexData.set(0);
    this.clearTotalStepsData.set(3);

    try {
      const response = await firstValueFrom(
        this.buildNamespaceApi.buildNamespaceControllerClearCache(clusterId)
      );

      this.activeOperationId.set(response.operationId);

      this.infrastructureWs.subscribeToOperation(response.operationId, {
        onProgress: (dto) => {
          this.clearProgressData.set(dto.percentage);
          this.clearMessageData.set(dto.message);
          this.clearStepIndexData.set(dto.currentStepIndex);
          this.clearTotalStepsData.set(dto.totalSteps);
        },
        onCompleted: (dto) => {
          this.clearProgressData.set(100);
          this.clearMessageData.set('Cache cleared successfully');
          this.clearResultData.set('success');
          this.isClearingCacheData.set(false);
          this.infrastructureWs.unsubscribeFromOperation(dto.operationId);
          this.activeOperationId.set(null);
          this.loadCacheStatus(clusterId);
        },
        onFailed: (dto) => {
          this.clearErrorData.set(dto.error ?? 'Cache clear failed');
          this.clearResultData.set('failed');
          this.isClearingCacheData.set(false);
          this.infrastructureWs.unsubscribeFromOperation(dto.operationId);
          this.activeOperationId.set(null);
        },
      });
    } catch (e: any) {
      this.clearErrorData.set(this.note(e, 'Failed to initiate cache clear'));
      this.clearResultData.set('failed');
      this.isClearingCacheData.set(false);
    }
  }

  async loadCacheBreakdown(clusterId: string): Promise<void> {
    this.isLoadingBreakdownData.set(true);
    this.breakdownErrorData.set(null);
    try {
      const data = await firstValueFrom(
        this.buildNamespaceApi.buildNamespaceControllerGetCacheBreakdown(clusterId)
      );
      this.breakdownData.set(data);
      if (data.scanStatus === 'in_progress') {
        this.isRefreshingBreakdownData.set(true);
        this.startBreakdownPolling(clusterId);
      }
    } catch (e: any) {
      this.breakdownErrorData.set(this.note(e, 'Failed to load cache breakdown'));
    } finally {
      this.isLoadingBreakdownData.set(false);
    }
  }

  async refreshCacheBreakdown(clusterId: string): Promise<void> {
    this.isRefreshingBreakdownData.set(true);
    this.refreshSkippedData.set(false);
    this.refreshSkippedReasonData.set(null);
    this.breakdownErrorData.set(null);
    try {
      const res = await firstValueFrom(
        this.buildNamespaceApi.buildNamespaceControllerRefreshCacheBreakdown(clusterId)
      );
      if (res.status === 'skipped') {
        this.refreshSkippedData.set(true);
        this.refreshSkippedReasonData.set(res.reason ?? null);
        this.isRefreshingBreakdownData.set(false);
        return;
      }
      this.startBreakdownPolling(clusterId);
    } catch (e: any) {
      this.breakdownErrorData.set(this.note(e, 'Failed to start cache scan'));
      this.isRefreshingBreakdownData.set(false);
    }
  }

  resetClearState(): void {
    this.clearProgressData.set(0);
    this.clearMessageData.set('');
    this.clearResultData.set(null);
    this.clearErrorData.set(null);
    this.isClearingCacheData.set(false);
    const opId = this.activeOperationId();
    if (opId) {
      this.infrastructureWs.unsubscribeFromOperation(opId);
      this.activeOperationId.set(null);
    }
    this.stopBreakdownPolling();
  }

  private startBreakdownPolling(clusterId: string): void {
    this.stopBreakdownPolling();
    this.breakdownPollInterval = setInterval(async () => {
      try {
        const data = await firstValueFrom(
          this.buildNamespaceApi.buildNamespaceControllerGetCacheBreakdown(clusterId)
        );
        this.breakdownData.set(data);
        if (data.scanStatus !== 'in_progress') {
          this.stopBreakdownPolling();
          this.isRefreshingBreakdownData.set(false);
        }
      } catch (e: any) {
        this.stopBreakdownPolling();
        this.isRefreshingBreakdownData.set(false);
        this.breakdownErrorData.set(this.note(e, 'Failed to poll breakdown'));
      }
    }, 3000);
  }

  private stopBreakdownPolling(): void {
    if (this.breakdownPollInterval !== null) {
      clearInterval(this.breakdownPollInterval);
      this.breakdownPollInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.stopBreakdownPolling();
  }
}
