import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import { isSandboxRefusal } from '../../core/services/sandbox.service';
import { InstallationNow } from '../model/installation-now.models';

export const NOW_REFUSED_MESSAGE = 'Seeing this page needs the permission to read clusters.';

const READ_TIMEOUT_MS = 25_000;

interface ApiErrorShape {
  status?: number;
  name?: string;
  error?: { message?: string | string[] } | string | null;
}

@Injectable({ providedIn: 'root' })
export class InstallationNowService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly nowData = signal<InstallationNow | null>(null);
  private readonly loadingData = signal(false);
  private readonly refusedData = signal(false);
  private readonly refusalMessageData = signal<string | null>(null);
  private readonly errorData = signal<string | null>(null);

  readonly now = this.nowData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly refused = this.refusedData.asReadonly();
  readonly refusalMessage = this.refusalMessageData.asReadonly();
  readonly error = this.errorData.asReadonly();

  async load(): Promise<void> {
    if (this.loadingData()) return;
    this.loadingData.set(true);
    try {
      const now = await firstValueFrom(
        this.http
          .get<InstallationNow>(`${this.appConfig.apiBaseUrl}/api/v1/observability/now`)
          .pipe(timeout(READ_TIMEOUT_MS)),
      );
      this.nowData.set(now);
      this.errorData.set(null);
      this.refusedData.set(false);
      this.refusalMessageData.set(null);
    } catch (err) {
      const shape = err as ApiErrorShape | null;
      if (shape?.status === 403 || isSandboxRefusal(err)) {
        this.refusedData.set(true);
        this.refusalMessageData.set(
          isSandboxRefusal(err) ? (bodyMessage(err) ?? NOW_REFUSED_MESSAGE) : NOW_REFUSED_MESSAGE,
        );
        this.errorData.set(null);
      } else if (shape?.name === 'TimeoutError' || shape?.status === 0) {
        this.errorData.set('The API did not answer in time. The figures below may be out of date.');
      } else {
        this.errorData.set(bodyMessage(err) ?? 'Could not read the installation right now.');
      }
    } finally {
      this.loadingData.set(false);
    }
  }
}

function bodyMessage(err: unknown): string | null {
  const body = (err as ApiErrorShape | null)?.error;
  if (!body) return null;
  if (typeof body === 'string') return body || null;
  const message = body.message;
  if (Array.isArray(message)) return message.join('. ');
  return message || null;
}
