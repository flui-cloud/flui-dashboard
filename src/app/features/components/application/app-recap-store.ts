import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DbConsoleService } from '../../service/db-console.service';
import { BackupService } from '../../service/backup.service';
import { AppAvailability, AppProtection, FleetService } from '../../service/fleet.service';
import { ApplicationMetricsService } from '../../../core/api/api/applicationMetrics.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import type { ApplicationReleaseDto } from '../../../core/api/model/applicationReleaseDto';
import { DbConnectionInfo } from '../../model/db-console.models';
import { AppGroupView, Application } from '../../model/application.models';
import { ComponentTrend, RecentEvent, recentEvents, trendOf } from './app-recap-bundle';

const TREND_WINDOW_MS = 3 * 3_600_000;
const TREND_STEP = '180s';
import { RunState } from './app-recap-view';

@Injectable()
export class AppRecapStore {
  private readonly dbConsole = inject(DbConsoleService);
  private readonly backup = inject(BackupService);
  private readonly fleet = inject(FleetService);
  private readonly metricsApi = inject(ApplicationMetricsService);
  private readonly applicationsApi = inject(ApplicationsService);

  readonly metrics = signal<Record<string, AppMetricsDto>>({});
  /** The last three hours of CPU and memory per component, for the cards' sparklines. */
  readonly trends = signal<Record<string, ComponentTrend>>({});
  readonly protection = signal<Record<string, AppProtection>>({});
  readonly protectionLoaded = signal(false);
  readonly release = signal<ApplicationReleaseDto | null>(null);
  readonly availability = signal<Record<string, AppAvailability>>({});
  readonly events = signal<RecentEvent[]>([]);
  readonly eventsLoaded = signal(false);
  readonly runState = signal<Record<string, RunState>>({});
  readonly connInfo = signal<Record<string, DbConnectionInfo>>({});
  private readonly connRequested = new Set<string>();

  async load(group: AppGroupView, primary: Application | null): Promise<void> {
    const ids = group.components.map((c) => c.id);
    const loads = [this.loadMetrics(ids), this.loadProtection(ids), this.loadAvailability(ids)];
    if (group.type === 'composed') loads.push(this.loadEvents(group.components), this.loadTrends(ids));
    else if (primary) loads.push(this.loadRelease(primary.id));
    await Promise.all(loads);
  }

  requestConnInfo(appIds: string[]): void {
    for (const id of appIds) {
      if (this.connRequested.has(id)) continue;
      this.connRequested.add(id);
      void this.loadConnInfo(id);
    }
  }

  reloadConnInfo(appIds: string[]): void {
    this.connRequested.clear();
    this.connInfo.set({});
    this.requestConnInfo(appIds);
  }

  async backUpNow(policyId: string): Promise<void> {
    this.runState.update((s) => ({ ...s, [policyId]: 'running' }));
    const result = await this.backup.runOnDemand(policyId);
    this.runState.update((s) => ({ ...s, [policyId]: result ? 'started' : 'failed' }));
  }

  private async loadAvailability(ids: string[]): Promise<void> {
    const results = await Promise.allSettled(ids.map((id) => this.fleet.appAvailability(id)));
    const next: Record<string, AppAvailability> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') next[ids[i]] = r.value;
    });
    this.availability.set(next);
  }

  private async loadTrends(ids: string[], now = Date.now()): Promise<void> {
    const start = new Date(now - TREND_WINDOW_MS).toISOString();
    const end = new Date(now).toISOString();
    const results = await Promise.allSettled(
      ids.map((id) =>
        firstValueFrom(this.metricsApi.applicationMetricsControllerGetAppMetricsHistory(id, start, end, TREND_STEP)),
      ),
    );
    const next: Record<string, ComponentTrend> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') next[ids[i]] = trendOf(r.value?.data_points ?? []);
    });
    this.trends.set(next);
  }

  private async loadMetrics(ids: string[]): Promise<void> {
    const results = await Promise.allSettled(
      ids.map((id) => firstValueFrom(this.metricsApi.applicationMetricsControllerGetAppMetrics(id))),
    );
    const next: Record<string, AppMetricsDto> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value?.metrics) next[ids[i]] = r.value.metrics;
    });
    this.metrics.set(next);
  }

  private async loadProtection(ids: string[]): Promise<void> {
    const results = await Promise.allSettled(ids.map((id) => this.fleet.appProtection(id)));
    const next: Record<string, AppProtection> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') next[ids[i]] = r.value;
    });
    this.protection.set(next);
    this.protectionLoaded.set(true);
  }

  private async loadRelease(appId: string): Promise<void> {
    try {
      this.release.set(
        (await firstValueFrom(this.applicationsApi.applicationReleasesControllerGetCurrentRelease(appId))) ?? null,
      );
    } catch {
      this.release.set(null);
    }
  }

  private async loadEvents(components: Application[]): Promise<void> {
    const results = await Promise.allSettled(
      components.map((c) => firstValueFrom(this.applicationsApi.applicationsControllerGetAuditEvents(c.id, undefined, 5))),
    );
    this.events.set(recentEvents(components, results.map((r) => (r.status === 'fulfilled' ? (r.value as unknown) : null))));
    this.eventsLoaded.set(true);
  }

  private async loadConnInfo(appId: string): Promise<void> {
    try {
      const info = await firstValueFrom(this.dbConsole.getConnectionInfo(appId));
      this.connInfo.update((m) => ({ ...m, [appId]: info }));
    } catch {
      return;
    }
  }
}
