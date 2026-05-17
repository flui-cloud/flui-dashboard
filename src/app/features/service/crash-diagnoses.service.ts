import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicationsService } from '../../core/api/api/applications.service';
import {
  CrashDiagnosis,
  AutoRemediationPayload,
  isRecent,
  isUnresolved,
} from '../model/crash-diagnosis.models';

@Injectable({ providedIn: 'root' })
export class CrashDiagnosesService {
  private readonly api = inject(ApplicationsService);

  private readonly diagnosesData = signal<CrashDiagnosis[]>([]);
  private readonly loadingData = signal(false);
  private readonly errorData = signal<string | null>(null);
  private readonly selectedData = signal<CrashDiagnosis | null>(null);
  private readonly totalLoadedData = signal(0);
  private readonly dismissingIdData = signal<string | null>(null);
  private readonly currentAppIdData = signal<string | null>(null);

  readonly diagnoses = this.diagnosesData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly selected = this.selectedData.asReadonly();
  readonly totalLoaded = this.totalLoadedData.asReadonly();
  readonly dismissingId = this.dismissingIdData.asReadonly();

  readonly unresolved = computed(() => this.diagnosesData().filter(isUnresolved));

  readonly unresolvedRecent = computed(() =>
    this.diagnosesData().filter(d => isUnresolved(d) && isRecent(d, 30)),
  );

  async loadList(appId: string, opts: { limit?: number; offset?: number } = {}): Promise<void> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    this.currentAppIdData.set(appId);
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.crashDiagnosesControllerList(appId, limit, offset),
      );
      const list = this.normalizeList(result);
      // Se offset === 0 sovrascrive, altrimenti concatena (paginazione "load more")
      if (offset === 0) {
        this.diagnosesData.set(list);
      } else {
        this.diagnosesData.update(prev => [...prev, ...list]);
      }
      this.totalLoadedData.set(this.diagnosesData().length);
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to load crash diagnoses'));
    } finally {
      this.loadingData.set(false);
    }
  }

  async loadOne(appId: string, id: string): Promise<CrashDiagnosis | null> {
    try {
      const result = await firstValueFrom(
        this.api.crashDiagnosesControllerGetOne(appId, id),
      );
      const d = result as CrashDiagnosis;
      this.selectedData.set(d);
      this.upsert(d);
      return d;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to load diagnosis'));
      return null;
    }
  }

  async dismiss(appId: string, id: string): Promise<boolean> {
    this.dismissingIdData.set(id);
    try {
      const result = await firstValueFrom(
        this.api.crashDiagnosesControllerDismiss(appId, id),
      );
      const updated = result as CrashDiagnosis;
      if (updated?.id) {
        this.upsert(updated);
        if (this.selectedData()?.id === id) {
          this.selectedData.set(updated);
        }
      } else {
        this.patchResolvedNow(id);
      }
      return true;
    } catch (err: unknown) {
      this.errorData.set(this.extractErrorMessage(err, 'Failed to dismiss diagnosis'));
      return false;
    } finally {
      this.dismissingIdData.set(null);
    }
  }

  pushRealtime(diagnosis: CrashDiagnosis): void {
    this.upsert(diagnosis);
  }

  /**
   * Handle a realtime `application:auto-remediation` event (phase 3).
   * Optimistically upgrades the matching diagnosis to `type: 'auto'` so the
   * UI flips to the auto-remediated rendering without waiting on the refetch,
   * then refetches the diagnosis to pick up the authoritative `suggestedAction`.
   */
  applyAutoRemediation(event: AutoRemediationPayload): void {
    this.diagnosesData.update(list =>
      list.map(d => {
        if (d.id !== event.diagnosisId) return d;
        return {
          ...d,
          suggestedAction: {
            type: 'auto',
            message: `Memory limit automatically increased from ${event.previousMemoryLimit} to ${event.newMemoryLimit}. The app is being redeployed.`,
            payload: {
              autoFix: true,
              previousMemoryLimit: event.previousMemoryLimit,
              newMemoryLimit: event.newMemoryLimit,
            },
          },
        };
      }),
    );
    if (this.selectedData()?.id === event.diagnosisId) {
      const current = this.selectedData();
      if (current) {
        this.selectedData.set({
          ...current,
          suggestedAction: {
            type: 'auto',
            message: `Memory limit automatically increased from ${event.previousMemoryLimit} to ${event.newMemoryLimit}. The app is being redeployed.`,
            payload: {
              autoFix: true,
              previousMemoryLimit: event.previousMemoryLimit,
              newMemoryLimit: event.newMemoryLimit,
            },
          },
        });
      }
    }
    // Refetch in background so we pick up any other authoritative changes.
    void this.loadOne(event.appId, event.diagnosisId);
  }

  select(d: CrashDiagnosis | null): void {
    this.selectedData.set(d);
  }

  clear(): void {
    this.diagnosesData.set([]);
    this.selectedData.set(null);
    this.errorData.set(null);
    this.totalLoadedData.set(0);
    this.currentAppIdData.set(null);
  }

  private normalizeList(raw: unknown): CrashDiagnosis[] {
    if (Array.isArray(raw)) return raw as CrashDiagnosis[];
    const maybe = (raw as { items?: CrashDiagnosis[]; data?: CrashDiagnosis[] }) ?? {};
    return maybe.items ?? maybe.data ?? [];
  }

  private upsert(d: CrashDiagnosis): void {
    this.diagnosesData.update(list => {
      const idx = list.findIndex(x => x.id === d.id);
      if (idx === -1) return [d, ...list];
      const copy = list.slice();
      copy[idx] = d;
      return copy;
    });
  }

  private patchResolvedNow(id: string): void {
    const nowIso = new Date().toISOString();
    this.diagnosesData.update(list =>
      list.map(d => (d.id === id ? { ...d, resolvedAt: nowIso } : d)),
    );
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
