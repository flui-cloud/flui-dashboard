import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BASE_PATH } from '../../core/api/variables';
import { ApplicationsService } from '../../core/api/api/applications.service';
import {
  ApplicationSnapshot,
  CreateSnapshotRequest,
} from '../model/volume-management.models';

const PENDING_POLL_MS = 3_000;
const PENDING_POLL_TIMEOUT_MS = 5 * 60_000;

@Injectable({ providedIn: 'root' })
export class ApplicationSnapshotsService {
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? '';

  private readonly snapshotsData = signal<ApplicationSnapshot[]>([]);
  private readonly loadingData = signal<boolean>(false);
  private readonly creatingData = signal<boolean>(false);
  private readonly deletingIdData = signal<string | null>(null);
  private readonly errorData = signal<string | null>(null);

  private pollingHandle: ReturnType<typeof setTimeout> | null = null;
  private pollingStartedAt = 0;
  private pollContext: { kind: 'app'; id: string } | { kind: 'cluster'; id: string } | null = null;

  readonly snapshots = this.snapshotsData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly creating = this.creatingData.asReadonly();
  readonly deletingId = this.deletingIdData.asReadonly();
  readonly error = this.errorData.asReadonly();

  readonly hasPending = computed(() =>
    this.snapshotsData().some((s) => !s.ready || s.deleting),
  );

  async loadForApp(appId: string): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const data = (await firstValueFrom(
        this.applicationsApi.applicationsControllerListSnapshotsForApp(appId),
      )) as ApplicationSnapshot[] | { snapshots: ApplicationSnapshot[] };
      this.snapshotsData.set(this.normalizeList(data));
      this.pollContext = { kind: 'app', id: appId };
      this.maybeStartPolling();
    } catch (error: any) {
      console.error('Error loading application snapshots:', error);
      this.errorData.set(error?.message || 'Failed to load snapshots');
    } finally {
      this.loadingData.set(false);
    }
  }

  async loadForCluster(clusterId: string): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const data = (await firstValueFrom(
        this.applicationsApi.applicationsControllerListSnapshotsForCluster(clusterId),
      )) as ApplicationSnapshot[] | { snapshots: ApplicationSnapshot[] };
      this.snapshotsData.set(this.normalizeList(data));
      this.pollContext = { kind: 'cluster', id: clusterId };
      this.maybeStartPolling();
    } catch (error: any) {
      console.error('Error loading cluster snapshots:', error);
      this.errorData.set(error?.message || 'Failed to load snapshots');
    } finally {
      this.loadingData.set(false);
    }
  }

  /**
   * Create a snapshot. Sends the body via raw HttpClient because the
   * generated client currently lacks a body parameter for this endpoint
   * (the OpenAPI spec doesn't declare one yet — see guide §3.1 / §4.2).
   * Once the spec is regenerated this can be replaced by the typed call.
   */
  async create(appId: string, body: CreateSnapshotRequest = {}): Promise<ApplicationSnapshot | null> {
    this.creatingData.set(true);
    this.errorData.set(null);
    try {
      const url = `${this.basePath}/api/v1/applications/${encodeURIComponent(appId)}/snapshots`;
      const created = await firstValueFrom(
        this.http.post<ApplicationSnapshot>(url, body),
      );
      if (created) {
        this.snapshotsData.update((list) => [created, ...list]);
        this.maybeStartPolling();
      }
      return created;
    } catch (error: any) {
      console.error('Error creating snapshot:', error);
      this.errorData.set(error?.error?.message || error?.message || 'Failed to create snapshot');
      return null;
    } finally {
      this.creatingData.set(false);
    }
  }

  async delete(appId: string, snapshotId: string): Promise<boolean> {
    this.deletingIdData.set(snapshotId);
    this.errorData.set(null);
    try {
      await firstValueFrom(
        this.applicationsApi.applicationsControllerDeleteSnapshot(appId, snapshotId),
      );
      this.snapshotsData.update((list) =>
        list.map((s) => (s.exportId === snapshotId ? { ...s, deleting: true } : s)),
      );
      this.maybeStartPolling();
      return true;
    } catch (error: any) {
      console.error('Error deleting snapshot:', error);
      this.errorData.set(error?.message || 'Failed to delete snapshot');
      return false;
    } finally {
      this.deletingIdData.set(null);
    }
  }

  /**
   * Restore a snapshot into a new side-by-side PVC. The live application is not
   * touched. Returns the new PVC name + operationId for tracking.
   */
  async restore(
    appId: string,
    snapshotId: string,
  ): Promise<{ newPvcName: string; operationId: string } | null> {
    try {
      const url = `${this.basePath}/api/v1/applications/${encodeURIComponent(appId)}/snapshots/${encodeURIComponent(snapshotId)}/restore`;
      const res = await firstValueFrom(
        this.http.post<{
          newPvcName: string;
          sourceSnapshotId: string;
          operationId: string;
        }>(url, {}),
      );
      return res
        ? { newPvcName: res.newPvcName, operationId: res.operationId }
        : null;
    } catch (error: any) {
      console.error('Error restoring snapshot:', error);
      this.errorData.set(
        error?.error?.message || error?.message || 'Failed to restore snapshot',
      );
      return null;
    }
  }

  /**
   * Swap the live application volume to a different PVC (typically the one
   * created by restore()). Triggers a rolling restart. Old PVC is preserved.
   */
  async swap(
    appId: string,
    volumeName: string,
    newClaimName: string,
  ): Promise<{ operationId: string } | null> {
    try {
      const url = `${this.basePath}/api/v1/applications/${encodeURIComponent(appId)}/volumes/${encodeURIComponent(volumeName)}/swap`;
      const res = await firstValueFrom(
        this.http.post<{ operationId: string }>(url, { newClaimName }),
      );
      return res ?? null;
    } catch (error: any) {
      console.error('Error swapping volume:', error);
      this.errorData.set(
        error?.error?.message || error?.message || 'Failed to swap volume',
      );
      return null;
    }
  }

  /**
   * Polling fallback: when the socket is unavailable, the caller can fetch the
   * current state of a running operation via the infrastructure operations API.
   * Returns a terminal status (COMPLETED/FAILED) once the operation settles, or
   * null on timeout.
   */
  async pollOperation(
    operationId: string,
    timeoutMs = 60_000,
  ): Promise<{ status: string; errorMessage?: string } | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const op = await firstValueFrom(
          this.http.get<{ status: string; errorMessage?: string }>(
            `${this.basePath}/api/v1/infrastructure/operations/${encodeURIComponent(operationId)}`,
          ),
        );
        if (op?.status === 'COMPLETED' || op?.status === 'FAILED') {
          return { status: op.status, errorMessage: op.errorMessage };
        }
      } catch (err) {
        console.warn('pollOperation transient error', err);
      }
      await new Promise((r) => setTimeout(r, 3_000));
    }
    return null;
  }

  reset(): void {
    this.stopPolling();
    this.snapshotsData.set([]);
    this.errorData.set(null);
    this.pollContext = null;
  }

  private normalizeList(
    raw: ApplicationSnapshot[] | { snapshots: ApplicationSnapshot[] } | null | undefined,
  ): ApplicationSnapshot[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return raw.snapshots ?? [];
  }

  private maybeStartPolling(): void {
    if (!this.hasPending() || !this.pollContext) {
      this.stopPolling();
      return;
    }
    if (this.pollingHandle) return;
    this.pollingStartedAt = Date.now();
    this.scheduleNextPoll();
  }

  private scheduleNextPoll(): void {
    this.pollingHandle = setTimeout(() => this.pollOnce(), PENDING_POLL_MS);
  }

  private async pollOnce(): Promise<void> {
    this.pollingHandle = null;
    const ctx = this.pollContext;
    if (!ctx) return;

    if (Date.now() - this.pollingStartedAt > PENDING_POLL_TIMEOUT_MS) {
      this.stopPolling();
      return;
    }

    try {
      const obs = ctx.kind === 'app'
        ? this.applicationsApi.applicationsControllerListSnapshotsForApp(ctx.id)
        : this.applicationsApi.applicationsControllerListSnapshotsForCluster(ctx.id);
      const data = (await firstValueFrom(obs)) as
        | ApplicationSnapshot[]
        | { snapshots: ApplicationSnapshot[] };
      this.snapshotsData.set(this.normalizeList(data));
    } catch (error) {
      console.error('Error polling snapshots:', error);
    }

    if (this.hasPending()) {
      this.scheduleNextPoll();
    } else {
      this.stopPolling();
    }
  }

  private stopPolling(): void {
    if (this.pollingHandle) {
      clearTimeout(this.pollingHandle);
      this.pollingHandle = null;
    }
  }
}
