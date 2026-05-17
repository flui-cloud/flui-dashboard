import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { InfrastructureClustersService } from '../../core/api/api/infrastructureClusters.service';
import { InfrastructureOperationsService } from '../../core/api/api/infrastructureOperations.service';
import { OperationStatus } from '../model/cluster.models';
import {
  OperationWarning,
  WorkerError,
  WorkerOperationEnvelope,
  WorkerOperationType,
  fromAddResponse,
  fromRemoveResponse,
} from '../model/worker-operation.models';
import {
  InfrastructureWebSocketService,
  InfrastructureOperationCompletedDto,
  InfrastructureOperationFailedDto,
  InfrastructureOperationProgressDto,
} from './infrastructure-websocket.service';
import { ClusterService } from './cluster.service';
import { ClusterAutoscaleService } from './cluster-autoscale.service';
import { NotificationService } from '../../core/services/notification.service';

export interface TrackingState {
  operationId: string | null;
  clusterId: string | null;
  type: WorkerOperationType | null;
  progress: number;
  currentStepIndex: number;
  totalSteps: number;
  stepDescription: string;
  warnings: OperationWarning[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error: string | null;
}

const INITIAL_STATE: TrackingState = {
  operationId: null,
  clusterId: null,
  type: null,
  progress: 0,
  currentStepIndex: 0,
  totalSteps: 0,
  stepDescription: '',
  warnings: [],
  status: 'pending',
  error: null,
};

@Injectable({ providedIn: 'root' })
export class ClusterWorkersService {
  private readonly clustersApi = inject(InfrastructureClustersService);
  private readonly operationsApi = inject(InfrastructureOperationsService);
  private readonly ws = inject(InfrastructureWebSocketService);
  private readonly clusterService = inject(ClusterService);
  private readonly autoscaleService = inject(ClusterAutoscaleService);
  private readonly notifications = inject(NotificationService);

  // Per-operationId tracking states. We support concurrent tracking
  // (e.g. user removes a worker while an add operation is still running).
  private readonly states = signal<Record<string, TrackingState>>({});
  readonly trackedStates = this.states.asReadonly();

  // Per-operation friendly context used to build notification copy.
  private readonly contexts = new Map<
    string,
    { count?: number; nodeName?: string; clusterName: string }
  >();

  /** Read tracking state for a given operationId (null returns initial state). */
  getTracking(operationId: string | null): TrackingState {
    if (!operationId) return INITIAL_STATE;
    return this.states()[operationId] ?? INITIAL_STATE;
  }

  // ---------------------------------------------------------------------------
  // Public API: kick off operations
  // ---------------------------------------------------------------------------

  async addWorkers(clusterId: string, count: number): Promise<WorkerOperationEnvelope> {
    try {
      const res = await firstValueFrom(
        this.clustersApi.clustersControllerAddWorkers(clusterId, { count }),
      );
      const env = fromAddResponse(res, clusterId);
      const clusterName = this.resolveClusterName(clusterId);
      this.contexts.set(env.operationId, { count, clusterName });
      this.beginTracking(env);
      this.notifyRequested(env, clusterName, count, undefined);
      return env;
    } catch (err) {
      console.error('[ClusterWorkersService.addWorkers] failed', { clusterId, count, err });
      const wErr = this.parseError(err, 'add');
      this.notifyRejected(clusterId, 'add_worker', wErr.message);
      throw wErr;
    }
  }

  async removeWorker(
    clusterId: string,
    nodeId: string,
    nodeName?: string,
  ): Promise<WorkerOperationEnvelope> {
    if (!clusterId || !nodeId) {
      const msg = `Cannot remove worker: missing ${clusterId ? 'nodeId' : 'clusterId'}.`;
      console.error('[ClusterWorkersService.removeWorker]', msg, { clusterId, nodeId, nodeName });
      const wErr: WorkerError = { kind: 'generic', message: msg };
      this.notifyRejected(clusterId || '?', 'remove_worker', msg);
      throw wErr;
    }
    try {
      const res = await firstValueFrom(
        this.clustersApi.clustersControllerRemoveWorker(clusterId, nodeId),
      );
      const env = fromRemoveResponse(res, clusterId);
      const clusterName = this.resolveClusterName(clusterId);
      this.contexts.set(env.operationId, { nodeName, clusterName });
      this.beginTracking(env);
      this.notifyRequested(env, clusterName, undefined, nodeName);
      return env;
    } catch (err) {
      console.error('[ClusterWorkersService.removeWorker] failed', { clusterId, nodeId, err });
      const wErr = this.parseError(err, 'remove');
      this.notifyRejected(clusterId, 'remove_worker', wErr.message);
      throw wErr;
    }
  }

  /** Discard state for an operation (e.g. when its dialog closes). */
  clearTracking(operationId: string): void {
    this.ws.unsubscribeFromOperation(operationId);
    this.contexts.delete(operationId);
    this.states.update(curr => {
      const { [operationId]: _, ...rest } = curr;
      return rest;
    });
  }

  // ---------------------------------------------------------------------------
  // Tracking internals
  // ---------------------------------------------------------------------------

  private beginTracking(env: WorkerOperationEnvelope): void {
    this.upsert(env.operationId, {
      ...INITIAL_STATE,
      operationId: env.operationId,
      clusterId: env.clusterId,
      type: env.type,
      status: 'in_progress',
      stepDescription: env.type === 'add_worker' ? 'Validating cluster + VNet…' : 'Preparing the node for removal…',
    });

    this.ws.subscribeToOperation(env.operationId, {
      onProgress: dto => this.onProgress(env, dto),
      onCompleted: dto => void this.onCompleted(env, dto),
      onFailed: dto => this.onFailed(env, dto),
    });

    // HTTP polling fallback in case the WebSocket is unavailable or drops
    // events. Stops as soon as a terminal state is reached.
    void this.pollFallback(env);
  }

  private onProgress(env: WorkerOperationEnvelope, dto: InfrastructureOperationProgressDto): void {
    this.upsert(env.operationId, prev => ({
      ...prev,
      progress: dto.percentage,
      currentStepIndex: dto.currentStepIndex,
      totalSteps: dto.totalSteps,
      stepDescription: dto.message,
      status: 'in_progress',
    }));
  }

  private async onCompleted(
    env: WorkerOperationEnvelope,
    _dto: InfrastructureOperationCompletedDto,
  ): Promise<void> {
    let warnings: OperationWarning[] = [];
    try {
      const status = await firstValueFrom(
        this.operationsApi.infrastructureOperationsControllerGetOperationStatus(env.operationId),
      ) as OperationStatus;
      const raw = status.metadata?.['warnings'];
      if (Array.isArray(raw)) {
        warnings = raw as OperationWarning[];
      }
    } catch (err) {
      console.warn('Failed to fetch terminal operation status for warnings:', err);
    }

    this.upsert(env.operationId, prev => ({
      ...prev,
      progress: 100,
      currentStepIndex: prev.totalSteps > 0 ? prev.totalSteps - 1 : prev.currentStepIndex,
      stepDescription: '',
      status: 'completed',
      warnings,
    }));

    this.ws.unsubscribeFromOperation(env.operationId);
    this.notifyCompleted(env, warnings);
    void this.refreshClusterContext(env.clusterId);
  }

  private onFailed(env: WorkerOperationEnvelope, dto: InfrastructureOperationFailedDto): void {
    this.upsert(env.operationId, prev => ({
      ...prev,
      status: 'failed',
      error: dto.error,
    }));
    this.ws.unsubscribeFromOperation(env.operationId);
    this.notifyFailed(env, dto.error);
    void this.refreshClusterContext(env.clusterId);
  }

  private async pollFallback(env: WorkerOperationEnvelope): Promise<void> {
    const POLL_INTERVAL = 5000;
    const MAX_POLLS = 360; // ~30 min
    let polls = 0;

    const tick = async (): Promise<void> => {
      const state = this.states()[env.operationId];
      if (!state || state.status === 'completed' || state.status === 'failed') return;
      if (polls >= MAX_POLLS) return;
      polls++;

      try {
        const status = await firstValueFrom(
          this.operationsApi.infrastructureOperationsControllerGetOperationStatus(env.operationId),
        ) as OperationStatus;

        if (status.status === 'COMPLETED') {
          await this.onCompleted(env, {
            operationId: env.operationId,
            resourceId: env.clusterId,
            operationType: env.type,
            resourceType: 'cluster',
            duration: 0,
            timestamp: new Date().toISOString(),
          });
          return;
        }
        if (status.status === 'FAILED') {
          this.onFailed(env, {
            operationId: env.operationId,
            resourceId: env.clusterId,
            operationType: env.type,
            resourceType: 'cluster',
            error: status.errorMessage ?? 'Operation failed',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // Mid-flight: only update if WS hasn't already reported a higher progress.
        this.upsert(env.operationId, prev => {
          if (prev.progress >= status.progress) return prev;
          return {
            ...prev,
            progress: status.progress,
            currentStepIndex: status.currentStepIndex,
            totalSteps: status.totalSteps,
            stepDescription: status.metadata?.stepDescription || prev.stepDescription,
          };
        });
      } catch (err) {
        // Transient: ignore and try again on the next tick.
      }

      setTimeout(() => void tick(), POLL_INTERVAL);
    };

    setTimeout(() => void tick(), POLL_INTERVAL);
  }

  private async refreshClusterContext(clusterId: string): Promise<void> {
    try {
      await this.clusterService.loadClusterNodes(clusterId);
    } catch (err) {
      console.warn('Failed to reload cluster nodes after worker op:', err);
    }
    try {
      await this.autoscaleService.getStatus(clusterId);
    } catch {
      // autoscale status is non-critical here
    }
  }

  private upsert(
    operationId: string,
    update: TrackingState | ((prev: TrackingState) => TrackingState),
  ): void {
    this.states.update(curr => {
      const prev = curr[operationId] ?? { ...INITIAL_STATE, operationId };
      const next = typeof update === 'function' ? update(prev) : update;
      return { ...curr, [operationId]: next };
    });
  }

  private parseError(err: unknown, op: 'add' | 'remove'): WorkerError {
    if (err instanceof HttpErrorResponse) {
      const message =
        (err.error && typeof err.error === 'object' && 'message' in err.error
          ? String((err.error as { message: unknown }).message)
          : err.message) || (op === 'add' ? 'Failed to add worker' : 'Failed to remove worker');

      if (err.status === 404) return { kind: 'not-found', message };
      if (err.status === 400) {
        if (/no\s+VNet/i.test(message)) return { kind: 'no-vnet', message };
        if (/must be READY/i.test(message)) return { kind: 'not-ready', message };
        if (/exceed\s+maxNodes/i.test(message)) return { kind: 'max-nodes', message };
        if (/violate\s+minNodes/i.test(message)) return { kind: 'min-nodes', message };
        if (/count must be between/i.test(message)) return { kind: 'count-range', message };
        if (/master node/i.test(message)) return { kind: 'master-protected', message };
        return { kind: 'generic', message };
      }
      return { kind: 'generic', message };
    }
    return {
      kind: 'generic',
      message: op === 'add' ? 'Unexpected error adding worker' : 'Unexpected error removing worker',
    };
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------

  private resolveClusterName(clusterId: string): string {
    const current = this.clusterService.cluster();
    if (current?.id === clusterId && current.name) return current.name;
    const fromList = this.clusterService.clusters().find(c => c.id === clusterId);
    return fromList?.name ?? clusterId;
  }

  private nodesLink(clusterId: string) {
    return { label: 'View nodes', route: `/cluster/${clusterId}/nodes` };
  }

  private notifyRequested(
    env: WorkerOperationEnvelope,
    clusterName: string,
    count: number | undefined,
    nodeName: string | undefined,
  ): void {
    if (env.type === 'add_worker') {
      const c = count ?? 1;
      this.notifications.add({
        title: `${clusterName}: adding ${c} worker${c === 1 ? '' : 's'}`,
        body: `Provisioning started. Estimated time: ${env.estimatedDuration}.`,
        link: this.nodesLink(env.clusterId),
        type: 'info',
        source: 'manual',
        category: 'cluster-scaling',
      });
    } else {
      this.notifications.add({
        title: `${clusterName}: removing worker${nodeName ? ` ${nodeName}` : ''}`,
        body: `Moving apps off the node and removing it. Estimated time: ${env.estimatedDuration}.`,
        link: this.nodesLink(env.clusterId),
        type: 'info',
        source: 'manual',
        category: 'cluster-scaling',
      });
    }
  }

  private notifyRejected(
    clusterId: string,
    type: WorkerOperationType,
    message: string,
  ): void {
    const clusterName = this.resolveClusterName(clusterId);
    const verb = type === 'add_worker' ? 'add worker' : 'remove worker';
    this.notifications.add({
      title: `${clusterName}: failed to ${verb}`,
      body: message,
      link: this.nodesLink(clusterId),
      type: 'error',
      source: 'manual',
      category: 'cluster-scaling',
    });
  }

  private notifyCompleted(env: WorkerOperationEnvelope, warnings: OperationWarning[]): void {
    const ctx = this.contexts.get(env.operationId);
    const clusterName = ctx?.clusterName ?? this.resolveClusterName(env.clusterId);
    if (env.type === 'add_worker') {
      const c = ctx?.count ?? 1;
      this.notifications.add({
        title: `${clusterName}: ${c} worker${c === 1 ? '' : 's'} added`,
        body: 'New pods and HPA scale-ups will use the new node(s). Restart apps to redistribute existing pods.',
        link: this.nodesLink(env.clusterId),
        type: 'success',
        source: 'websocket',
        category: 'cluster-scaling',
      });
    } else {
      const hasBlockingWarn = warnings.some(w => w.code === 'DRAIN_FAILED' || w.code === 'CORDON_FAILED');
      const nodeNameSuffix = ctx?.nodeName ? ` ${ctx.nodeName}` : '';
      this.notifications.add({
        title: hasBlockingWarn
          ? `${clusterName}: worker removed with warnings`
          : `${clusterName}: worker${nodeNameSuffix} removed`,
        body: hasBlockingWarn
          ? warnings.map(w => `${w.code}: ${w.reason}`).join(' • ')
          : 'Apps were moved off the node and the worker was removed from the provider.',
        link: this.nodesLink(env.clusterId),
        type: hasBlockingWarn ? 'warning' : 'success',
        source: 'websocket',
        category: 'cluster-scaling',
      });
    }
  }

  private notifyFailed(env: WorkerOperationEnvelope, error: string): void {
    const ctx = this.contexts.get(env.operationId);
    const clusterName = ctx?.clusterName ?? this.resolveClusterName(env.clusterId);
    const verb = env.type === 'add_worker' ? 'add worker' : 'remove worker';
    this.notifications.add({
      title: `${clusterName}: ${verb} failed`,
      body: error,
      link: this.nodesLink(env.clusterId),
      type: 'error',
      source: 'websocket',
      category: 'cluster-scaling',
    });
  }
}
