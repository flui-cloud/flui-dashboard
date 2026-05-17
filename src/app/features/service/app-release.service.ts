import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicationsService } from '../../core/api/api/applications.service';
import { ApplicationReleaseDto } from '../../core/api/model/applicationReleaseDto';
import {
  AppRuntimeWebSocketService,
  OperationCompletedEvent,
  ReleaseStatusChangedEvent,
} from './app-runtime-websocket.service';

@Injectable({ providedIn: 'root' })
export class AppReleaseService {
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly wsService = inject(AppRuntimeWebSocketService);

  private readonly currentReleaseSignal = signal<ApplicationReleaseDto | null>(null);
  private readonly historySignal = signal<ApplicationReleaseDto[]>([]);
  private readonly loadingSignal = signal(false);
  private subscribedAppId: string | null = null;

  readonly currentRelease = this.currentReleaseSignal.asReadonly();
  readonly history = this.historySignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  readonly hasFailedRelease = computed(() => {
    const r = this.currentReleaseSignal();
    return !!r && r.status === ApplicationReleaseDto.StatusEnum.Failed;
  });

  async loadCurrent(appId: string): Promise<void> {
    try {
      const release = await firstValueFrom(
        this.applicationsApi.applicationsControllerGetCurrentRelease(appId),
      );
      this.currentReleaseSignal.set(release ?? null);
    } catch {
      this.currentReleaseSignal.set(null);
    }
  }

  async loadHistory(appId: string): Promise<void> {
    this.loadingSignal.set(true);
    try {
      const res = await firstValueFrom(
        this.applicationsApi.applicationsControllerListReleases(appId),
      );
      this.historySignal.set(res?.releases ?? []);
    } catch {
      this.historySignal.set([]);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /**
   * Subscribe to live release events for an app. Updates `currentRelease` and
   * prepends to `history` on `application:release:status`. Also reacts to
   * `application:operation:completed` for `deploy_application`/`rollback_application`
   * since the backend doesn't emit a dedicated `release:status` for the
   * IN_PROGRESS → SUCCEEDED transition (see RELEASES_FRONTEND.md).
   */
  subscribe(appId: string): void {
    if (this.subscribedAppId === appId) return;
    this.subscribedAppId = appId;
    this.wsService.ensureAppSubscription(appId);

    this.wsService.onReleaseStatus(appId, (e) => this.applyReleaseEvent(e));

    this.wsService.onGlobalOperationCompleted((e) => {
      if (e.appId !== this.subscribedAppId) return;
      const type = (e.operationType || '').toLowerCase();
      if (type !== 'deploy_application' && type !== 'rollback_application') return;
      this.loadCurrent(e.appId);
      this.loadHistory(e.appId);
    });
  }

  reset(): void {
    this.subscribedAppId = null;
    this.currentReleaseSignal.set(null);
    this.historySignal.set([]);
  }

  private applyReleaseEvent(e: ReleaseStatusChangedEvent): void {
    const next: ApplicationReleaseDto = {
      applicationId: e.appId,
      operationId: e.operationId,
      status: e.status as ApplicationReleaseDto.StatusEnum,
      imageRef: e.imageRef ?? undefined,
      previousImageRef: e.previousImageRef ?? undefined,
      buildId: e.buildId ?? undefined,
      failureReason: e.failureReason ?? undefined,
      startedAt: this.currentReleaseSignal()?.operationId === e.operationId
        ? this.currentReleaseSignal()!.startedAt
        : e.timestamp,
      completedAt: e.status === 'IN_PROGRESS' ? null : e.timestamp,
    };
    this.currentReleaseSignal.set(next);
    this.historySignal.update((list) => {
      const idx = list.findIndex((r) => r.operationId === e.operationId);
      if (idx >= 0) {
        const copy = list.slice();
        copy[idx] = next;
        return copy;
      }
      return [next, ...list].slice(0, 20);
    });
  }
}

// Avoid unused import warning when consumers re-import the type
export type { OperationCompletedEvent };
