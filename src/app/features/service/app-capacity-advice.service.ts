import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export type CapacityAdvice =
  | 'none'
  | 'add_replicas'
  | 'add_node'
  | 'wait_for_node'
  | 'raise_autoscale_max'
  | 'autoscaler_adding'
  | 'one_copy_only'
  | 'watch_memory'
  | 'unknown';

export interface AppCapacityAdvice {
  app_id: string;
  advice: CapacityAdvice;
  sentence: string;
  reasons: string[];
  desired: number;
  ready: number;
  next_copy: { verdict: string; sentence: string } | null;
  thresholds: { window_minutes: number };
}

export interface AdviceView {
  title: string;
  tone: 'ok' | 'act' | 'wait';
}

export const CAPACITY_ADVICE_REFRESH_MS = 60_000;

export function adviceView(advice: CapacityAdvice): AdviceView | null {
  switch (advice) {
    case 'none':
      return { title: 'Copies keep up', tone: 'ok' };
    case 'add_replicas':
      return { title: 'Add a replica', tone: 'act' };
    case 'add_node':
      return { title: 'Add a node first', tone: 'act' };
    case 'wait_for_node':
      return { title: 'Waiting for a node', tone: 'wait' };
    case 'raise_autoscale_max':
      return { title: 'Raise the autoscaling maximum', tone: 'act' };
    case 'autoscaler_adding':
      return { title: 'The autoscaler is adding copies', tone: 'wait' };
    case 'one_copy_only':
      return { title: 'Give it more CPU or memory', tone: 'act' };
    case 'watch_memory':
      return { title: 'Memory near its limit', tone: 'wait' };
    default:
      return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AppCapacityAdviceService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly adviceData = signal<AppCapacityAdvice | null>(null);
  readonly advice = this.adviceData.asReadonly();

  private appId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(appId: string): void {
    this.stop();
    if (this.appId !== appId) this.adviceData.set(null);
    this.appId = appId;
    void this.load();
    this.timer = setInterval(() => {
      if (!globalThis.document?.hidden) void this.load();
    }, CAPACITY_ADVICE_REFRESH_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async load(): Promise<void> {
    const appId = this.appId;
    if (!appId) return;
    try {
      const advice = await firstValueFrom(
        this.http.get<AppCapacityAdvice>(
          `${this.appConfig.apiBaseUrl}/api/v1/observability/applications/${encodeURIComponent(appId)}/capacity-advice`,
        ),
      );
      if (this.appId === appId) this.adviceData.set(advice);
    } catch {
      if (this.appId === appId) this.adviceData.set(null);
    }
  }
}
