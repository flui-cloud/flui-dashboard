import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import { AlertEvent, AlertsResponse } from '../model/alert.models';

@Injectable({ providedIn: 'root' })
export class ApplicationAlertsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  // Read per call: correct only once config.json has loaded.
  private get basePath(): string {
    return this.appConfig.apiBaseUrl;
  }

  private readonly alertsData = signal<AlertEvent[]>([]);
  private readonly firingData = signal<number>(0);
  private readonly loadingData = signal<boolean>(false);
  private readonly errorData = signal<string | null>(null);

  readonly alerts = this.alertsData.asReadonly();
  readonly firing = this.firingData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();

  private base(appId: string): string {
    return `${this.basePath}/api/v1/observability/applications/${encodeURIComponent(appId)}/alerts`;
  }

  async load(appId: string, limit = 25): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<AlertsResponse>(this.base(appId), {
          params: new HttpParams().set('limit', String(limit)),
        }),
      );
      this.alertsData.set(res?.alerts ?? []);
      this.firingData.set(res?.firing ?? 0);
    } catch (error: unknown) {
      console.error('Error loading application alerts:', error);
      this.errorData.set(this.message(error, 'Failed to load alerts'));
      this.alertsData.set([]);
      this.firingData.set(0);
    } finally {
      this.loadingData.set(false);
    }
  }

  clear(): void {
    this.alertsData.set([]);
    this.firingData.set(0);
    this.errorData.set(null);
  }

  private message(error: unknown, fallback: string): string {
    const candidate = error as { error?: { message?: string }; message?: string };
    return candidate?.error?.message ?? candidate?.message ?? fallback;
  }
}
