import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import { ToastService } from '../../shared/services/toast.service';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface MaintenanceSlot {
  days: Weekday[];
  start: string;
  durationMinutes: number;
}

export interface MaintenanceWindow {
  timezone: string;
  slots: MaintenanceSlot[];
}

export interface ClusterMaintenance {
  window: MaintenanceWindow | null;
  nextOpening: string | null;
  says: string;
}

export type AppMaintenanceMode = 'follow' | 'own' | 'anytime';

export interface AppMaintenance {
  mode: AppMaintenanceMode;
  window: MaintenanceWindow | null;
  nextOpening: string | null;
  says: string;
}

export interface DeferredAction {
  id: string;
  kind: string;
  applicationId: string | null;
  applicationName: string | null;
  requestedBy: string;
  requestedAt: string;
  runAt: string;
  status: string;
  outcome: string | null;
  says: string;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly toast = inject(ToastService);

  private get base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1`;
  }

  cluster(clusterId: string): Promise<ClusterMaintenance> {
    return firstValueFrom(this.http.get<ClusterMaintenance>(`${this.base}/infrastructure/clusters/${clusterId}/maintenance-window`));
  }

  setCluster(clusterId: string, window: MaintenanceWindow): Promise<ClusterMaintenance | null> {
    return this.guard(this.http.put<ClusterMaintenance>(`${this.base}/infrastructure/clusters/${clusterId}/maintenance-window`, window), 'The window was not saved');
  }

  clearCluster(clusterId: string): Promise<ClusterMaintenance | null> {
    return this.guard(this.http.delete<ClusterMaintenance>(`${this.base}/infrastructure/clusters/${clusterId}/maintenance-window`), 'The window was not removed');
  }

  clusterDeferred(clusterId: string): Promise<DeferredAction[]> {
    return firstValueFrom(this.http.get<DeferredAction[]>(`${this.base}/infrastructure/clusters/${clusterId}/deferred-actions`));
  }

  app(appId: string): Promise<AppMaintenance> {
    return firstValueFrom(this.http.get<AppMaintenance>(`${this.base}/applications/${appId}/maintenance`));
  }

  setApp(appId: string, body: { mode: AppMaintenanceMode; window?: MaintenanceWindow }): Promise<AppMaintenance | null> {
    return this.guard(this.http.put<AppMaintenance>(`${this.base}/applications/${appId}/maintenance`, body), 'The setting was not saved');
  }

  appDeferred(appId: string): Promise<DeferredAction[]> {
    return firstValueFrom(this.http.get<DeferredAction[]>(`${this.base}/applications/${appId}/deferred-actions`));
  }

  cancel(appId: string, actionId: string): Promise<DeferredAction | null> {
    return this.guard(this.http.delete<DeferredAction>(`${this.base}/applications/${appId}/deferred-actions/${actionId}`), 'It was not cancelled');
  }

  deferProposal(appId: string): Promise<DeferredAction | null> {
    return this.guard(this.http.post<DeferredAction>(`${this.base}/applications/${appId}/resources/proposal/defer`, {}), 'The change was not held');
  }

  private async guard<T>(call: import('rxjs').Observable<T>, title: string): Promise<T | null> {
    try {
      return await firstValueFrom(call);
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string | string[] } })?.error?.message;
      this.toast.showError({ title, message: Array.isArray(message) ? message.join(' ') : (message ?? 'Please try again.') });
      return null;
    }
  }
}

export function openingLabel(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Math.abs(at.getTime() - Date.now()) < 60_000) return 'open now';
  return at.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
