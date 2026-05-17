import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApplicationsService } from '../../core/api/api/applications.service';
import { PodDebugInfo } from '../model/pod-debug.models';

@Injectable({ providedIn: 'root' })
export class PodDebugService {
  private readonly api = inject(ApplicationsService);

  private readonly podsData = signal<PodDebugInfo[]>([]);
  private readonly loadingData = signal(false);
  private readonly errorData = signal<string | null>(null);
  private readonly rateLimitedUntilData = signal<number | null>(null);
  private readonly lastFetchedAtData = signal<number | null>(null);
  private readonly currentAppIdData = signal<string | null>(null);

  readonly pods = this.podsData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly lastFetchedAt = this.lastFetchedAtData.asReadonly();

  readonly isRateLimited = computed(() => {
    const until = this.rateLimitedUntilData();
    return until !== null && Date.now() < until;
  });

  readonly rateLimitedSecondsLeft = computed(() => {
    const until = this.rateLimitedUntilData();
    if (until === null) return 0;
    const secs = Math.ceil((until - Date.now()) / 1000);
    return secs > 0 ? secs : 0;
  });

  async loadAll(appId: string): Promise<void> {
    if (this.isRateLimited()) return;
    this.currentAppIdData.set(appId);
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.podDebugControllerListPods(appId),
      );
      const list = Array.isArray(result) ? (result as PodDebugInfo[]) : [];
      this.podsData.set(list);
      this.lastFetchedAtData.set(Date.now());
    } catch (err: unknown) {
      this.handleError(err, 'Failed to load pod debug info');
    } finally {
      this.loadingData.set(false);
    }
  }

  async loadOne(appId: string, podName: string): Promise<PodDebugInfo | null> {
    if (this.isRateLimited()) return null;
    try {
      const result = await firstValueFrom(
        this.api.podDebugControllerGetPod(appId, podName),
      );
      const pod = result as PodDebugInfo;
      this.upsert(pod);
      return pod;
    } catch (err: unknown) {
      this.handleError(err, 'Failed to load pod');
      return null;
    }
  }

  clear(): void {
    this.podsData.set([]);
    this.errorData.set(null);
    this.rateLimitedUntilData.set(null);
    this.lastFetchedAtData.set(null);
    this.currentAppIdData.set(null);
  }

  private upsert(pod: PodDebugInfo): void {
    this.podsData.update(list => {
      const idx = list.findIndex(p => p.name === pod.name);
      if (idx === -1) return [...list, pod];
      const copy = list.slice();
      copy[idx] = pod;
      return copy;
    });
  }

  private handleError(err: unknown, fallback: string): void {
    if (err instanceof HttpErrorResponse && err.status === 429) {
      // Rate limit: 10 req/min → assumiamo finestra di 60s se non specificato.
      const retryAfter = this.parseRetryAfter(err) ?? 60;
      this.rateLimitedUntilData.set(Date.now() + retryAfter * 1000);
      this.errorData.set(`Rate limit raggiunto. Riprova fra ${retryAfter}s.`);
      return;
    }
    const e = err as { error?: { message?: string }; message?: string };
    this.errorData.set(e?.error?.message ?? e?.message ?? fallback);
  }

  private parseRetryAfter(err: HttpErrorResponse): number | null {
    const header = err.headers?.get('Retry-After') ?? err.headers?.get('retry-after');
    if (!header) return null;
    const n = Number(header);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
}
