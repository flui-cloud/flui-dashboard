import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export interface AppHealthChecks {
  app_id: string;
  readiness: number;
  readiness_busy?: number;
  liveness: number;
  startup: number;
  restarts_by_liveness: number;
  last_failure_at: string | null;
  read: boolean;
}

export const HEALTH_CHECKS_REFRESH_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class AppHealthChecksService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly checksData = signal<AppHealthChecks | null>(null);
  readonly checks = this.checksData.asReadonly();

  private appId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(appId: string): void {
    this.stop();
    if (this.appId !== appId) this.checksData.set(null);
    this.appId = appId;
    void this.load();
    this.timer = setInterval(() => {
      if (!globalThis.document?.hidden) void this.load();
    }, HEALTH_CHECKS_REFRESH_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async load(): Promise<void> {
    const appId = this.appId;
    if (!appId) return;
    try {
      const checks = await firstValueFrom(
        this.http.get<AppHealthChecks>(
          `${this.appConfig.apiBaseUrl}/api/v1/observability/applications/${encodeURIComponent(appId)}/health-checks`,
        ),
      );
      if (this.appId === appId) this.checksData.set(checks);
    } catch {
      if (this.appId === appId) this.checksData.set(null);
    }
  }
}
