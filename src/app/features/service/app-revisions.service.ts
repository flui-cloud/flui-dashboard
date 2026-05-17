import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicationsService } from '../../core/api/api/applications.service';
import { AppRevisionResponseDto } from '../../core/api/model/appRevisionResponseDto';
import { AppAuditEventSummaryDto } from '../../core/api/model/appAuditEventSummaryDto';
import { RollbackApplicationDto } from '../../core/api/model/rollbackApplicationDto';

export type AuditEventType = 'deploy' | 'rollback' | 'scale' | 'resource_update' | 'restart' | 'start' | 'stop' | 'config_update' | 'reconciled' | 'created';

@Injectable({ providedIn: 'root' })
export class AppRevisionsService {
  private readonly api = inject(ApplicationsService);

  // Revisions state
  private readonly revisionsData = signal<AppRevisionResponseDto[]>([]);
  private readonly revisionsLoadingData = signal(false);
  private readonly revisionsErrorData = signal<string | null>(null);

  // Audit events state
  private readonly eventsData = signal<AppAuditEventSummaryDto[]>([]);
  private readonly eventsLoadingData = signal(false);
  private readonly eventsErrorData = signal<string | null>(null);
  private readonly eventsTotalData = signal(0);

  // Rollback state
  private readonly rollingBackData = signal(false);
  private readonly rollbackErrorData = signal<string | null>(null);

  // Public readonly signals
  readonly revisions = this.revisionsData.asReadonly();
  readonly revisionsLoading = this.revisionsLoadingData.asReadonly();
  readonly revisionsError = this.revisionsErrorData.asReadonly();

  readonly events = this.eventsData.asReadonly();
  readonly eventsLoading = this.eventsLoadingData.asReadonly();
  readonly eventsError = this.eventsErrorData.asReadonly();
  readonly eventsTotal = this.eventsTotalData.asReadonly();

  readonly rollingBack = this.rollingBackData.asReadonly();
  readonly rollbackError = this.rollbackErrorData.asReadonly();

  async loadRevisions(appId: string): Promise<void> {
    this.revisionsLoadingData.set(true);
    this.revisionsErrorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.applicationsControllerGetRevisions(appId)
      );
      this.revisionsData.set(result ?? []);
    } catch (err: unknown) {
      this.revisionsErrorData.set(this.extractErrorMessage(err, 'Failed to load revisions'));
    } finally {
      this.revisionsLoadingData.set(false);
    }
  }

  async loadEvents(appId: string, type?: AuditEventType, limit = 50, offset = 0): Promise<void> {
    this.eventsLoadingData.set(true);
    this.eventsErrorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.applicationsControllerGetAuditEvents(appId, type, limit, offset)
      );
      const events = Array.isArray(result) ? result : (result as any)?.events ?? [];
      const total = Array.isArray(result) ? events.length : (result as any)?.total ?? events.length;
      this.eventsData.set(events);
      this.eventsTotalData.set(total);
    } catch (err: unknown) {
      this.eventsErrorData.set(this.extractErrorMessage(err, 'Failed to load audit events'));
    } finally {
      this.eventsLoadingData.set(false);
    }
  }

  async rollback(appId: string, revisionNumber: number): Promise<boolean> {
    this.rollingBackData.set(true);
    this.rollbackErrorData.set(null);
    try {
      const dto: RollbackApplicationDto = { revisionNumber };
      await firstValueFrom(
        this.api.applicationsControllerRollback(appId, dto)
      );
      return true;
    } catch (err: unknown) {
      this.rollbackErrorData.set(this.extractErrorMessage(err, 'Rollback failed'));
      return false;
    } finally {
      this.rollingBackData.set(false);
    }
  }

  clearAll(): void {
    this.revisionsData.set([]);
    this.eventsData.set([]);
    this.revisionsErrorData.set(null);
    this.eventsErrorData.set(null);
    this.rollbackErrorData.set(null);
    this.eventsTotalData.set(0);
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
