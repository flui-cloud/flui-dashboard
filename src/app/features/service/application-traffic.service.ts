import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  AppTrafficHistoryResponse,
  AppTrafficResponse,
  TrafficHistoryPoint,
} from '../model/traffic.models';

@Injectable({ providedIn: 'root' })
export class ApplicationTrafficService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  // Read per call: correct only once config.json has loaded.
  private get basePath(): string {
    return this.appConfig.apiBaseUrl;
  }

  private readonly currentData = signal<AppTrafficResponse | null>(null);
  private readonly historyData = signal<TrafficHistoryPoint[]>([]);
  private readonly loadingData = signal<boolean>(false);
  private readonly errorData = signal<string | null>(null);

  readonly current = this.currentData.asReadonly();
  readonly history = this.historyData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();

  private base(appId: string): string {
    return `${this.basePath}/api/v1/observability/applications/${encodeURIComponent(appId)}/traffic`;
  }

  async load(
    appId: string,
    range: { start: Date; end: Date; step: string },
    window = '5m',
  ): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const [current, history] = await Promise.all([
        firstValueFrom(
          this.http.get<AppTrafficResponse>(this.base(appId), {
            params: new HttpParams().set('window', window),
          }),
        ),
        firstValueFrom(
          this.http.get<AppTrafficHistoryResponse>(`${this.base(appId)}/history`, {
            params: new HttpParams()
              .set('start', range.start.toISOString())
              .set('end', range.end.toISOString())
              .set('step', range.step)
              .set('window', window),
          }),
        ),
      ]);
      this.currentData.set(current);
      this.historyData.set(history?.data_points ?? []);
    } catch (error: unknown) {
      console.error('Error loading application traffic:', error);
      this.errorData.set(this.message(error, 'Failed to load traffic'));
      this.currentData.set(null);
      this.historyData.set([]);
    } finally {
      this.loadingData.set(false);
    }
  }

  clear(): void {
    this.currentData.set(null);
    this.historyData.set([]);
    this.errorData.set(null);
  }

  private message(error: unknown, fallback: string): string {
    const candidate = error as { error?: { message?: string }; message?: string };
    return candidate?.error?.message ?? candidate?.message ?? fallback;
  }
}
