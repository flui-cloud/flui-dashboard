import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export type FleetWindow = '1h' | '3h' | '24h';

export const FLEET_WINDOWS: FleetWindow[] = ['1h', '3h', '24h'];

export interface FleetPoint {
  timestamp: string;
  cpuPercent: number | null;
  memoryPercent: number | null;
  diskPercent: number | null;
  networkInBytesPerSecond: number | null;
  networkOutBytesPerSecond: number | null;
  nodes: number;
}

export type ClusterMetricsState = 'reporting' | 'stale' | 'no_data' | 'unavailable';

export interface FleetClusterMetrics {
  clusterId: string;
  name: string;
  provider: string;
  clusterType: string;
  status: string;
  metrics: ClusterMetricsState;
  nodesReporting: number;
  lastSampleAt: string | null;
  current: FleetPoint | null;
  series: FleetPoint[];
}

export interface FleetMetrics {
  window: FleetWindow;
  step: string;
  rangeStart: string;
  rangeEnd: string;
  queriedAt: string;
  fleet: {
    clustersTotal: number;
    clustersReporting: number;
    nodesReporting: number;
    current: FleetPoint | null;
    series: FleetPoint[];
  };
  clusters: FleetClusterMetrics[];
}

export type NeedsYouKind = 'cluster_broken' | 'cluster_operation' | 'credential' | 'apps_without_backup';
export type NeedsYouLevel = 'critical' | 'warning' | 'info';

export interface NeedsYouAction {
  label: string;
  path: string;
}

export interface NeedsYouApp {
  applicationId: string;
  name: string;
  slug?: string;
  kind: string;
  clusterId: string;
  clusterName: string | null;
  reason: string;
  /** Why protecting its cluster has not covered it yet, when it tried. */
  pendingReason?: string | null;
  lastSuccessAt: string | null;
  /** Absent when a policy made by hand would not help, e.g. a database that is not running. */
  protect: NeedsYouAction | null;
  open?: NeedsYouAction;
  /** Its Backup tab: protect it, or decide it is not backed up. */
  backups?: NeedsYouAction;
}

export interface NeedsYouItem {
  id: string;
  kind: NeedsYouKind;
  level: NeedsYouLevel;
  title: string;
  detail: string;
  action: NeedsYouAction | null;
  cluster?: { id: string; name: string; provider: string; status: string };
  credential?: { kind: string; status: string; expiresAt: string | null };
  applications?: NeedsYouApp[];
}

export interface NeedsYou {
  generatedAt: string;
  count: number;
  items: NeedsYouItem[];
}

export type AppCoverageState = 'protected' | 'pending' | 'to_verify' | 'unprotected' | 'not_backed_up_by_choice';

/** A person's decision that an application is not backed up. */
export interface AppBackupDecision {
  notBackedUp: true;
  note?: string;
  decidedBy: string;
  decidedByName?: string;
  decidedAt: string;
}

export interface AppCoverageRow {
  applicationId: string;
  name: string;
  slug: string;
  kind: string;
  category: string;
  clusterId: string;
  clusterName: string | null;
  holdsData: boolean;
  dataReasons: string[];
  coverage: AppCoverageState;
  reason: string;
  alarm: boolean;
  policy: {
    id: string;
    name: string;
    scope: string;
    engineClass: string;
    schedule: string | null;
    retentionDays: number | null;
    nextRunAt: string | null;
  } | null;
  coveringPolicies: number;
  lastSuccessAt: string | null;
  protectedUntil: string | null;
  protectPath: string | null;
  applicationPath?: string;
  pending?: {
    outcome: 'waiting' | 'failed' | 'needs_decision';
    reason: string | null;
    at: string;
    protectHelps: boolean;
  } | null;
  decision?: AppBackupDecision | null;
}

export interface FleetCoverage {
  generatedAt: string;
  summary: {
    applications: number;
    holdingData: number;
    protected: number;
    pending: number;
    toVerify: number;
    unprotected: number;
    notBackedUpByChoice?: number;
    alarms: number;
  };
  applications: AppCoverageRow[];
}

export interface AppProtectionPolicy {
  policyId: string;
  name: string;
  engineClass: string;
  engine: string | null;
  schedule: string | null;
  enabled: boolean;
  status: string;
  destination: { id: string; name: string; provider: string } | null;
  lastRun: { status: string; at: string | null; error: string | null } | null;
  nextRunAt: string | null;
}

/** `GET /applications/:id/backup-protection`: the policies naming the app, and the fleet rule for it. */
export interface AppProtection {
  applicationId: string;
  protectedOffCluster: boolean;
  policies: AppProtectionPolicy[];
  coverage: AppCoverageRow | null;
  lastBackupSizeBytes: number | null;
}

/** `forbidden` is a refusal the page hides quietly (a sandbox guest), not an error to show. */
export type FleetReadState = 'idle' | 'loading' | 'ready' | 'forbidden' | 'error';

const isForbidden = (err: unknown) =>
  err instanceof HttpErrorResponse ? err.status === 403 : (err as { status?: number })?.status === 403;

@Injectable({ providedIn: 'root' })
export class FleetService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly windowData = signal<FleetWindow>('3h');
  private readonly metricsData = signal<FleetMetrics | null>(null);
  private readonly metricsStateData = signal<FleetReadState>('idle');
  private readonly needsYouData = signal<NeedsYou | null>(null);
  private readonly needsYouStateData = signal<FleetReadState>('idle');
  private readonly coverageData = signal<FleetCoverage | null>(null);
  private readonly coverageStateData = signal<FleetReadState>('idle');

  readonly window = this.windowData.asReadonly();
  readonly metrics = this.metricsData.asReadonly();
  readonly metricsState = this.metricsStateData.asReadonly();
  readonly needsYou = this.needsYouData.asReadonly();
  readonly needsYouState = this.needsYouStateData.asReadonly();
  readonly coverage = this.coverageData.asReadonly();
  readonly coverageState = this.coverageStateData.asReadonly();

  private url(path: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/fleet/${path}`;
  }

  async setWindow(window: FleetWindow): Promise<void> {
    if (window === this.windowData()) return;
    this.windowData.set(window);
    await this.loadMetrics();
  }

  async loadMetrics(): Promise<void> {
    if (this.metricsStateData() === 'forbidden') return;
    const window = this.windowData();
    this.metricsStateData.set('loading');
    try {
      const res = await firstValueFrom(
        this.http.get<FleetMetrics>(this.url('metrics'), { params: { window } }),
      );
      if (window !== this.windowData()) return;
      this.metricsData.set(res);
      this.metricsStateData.set('ready');
    } catch (err) {
      this.metricsStateData.set(isForbidden(err) ? 'forbidden' : 'error');
    }
  }

  async loadNeedsYou(): Promise<void> {
    if (this.needsYouData() === null) this.needsYouStateData.set('loading');
    try {
      this.needsYouData.set(await firstValueFrom(this.http.get<NeedsYou>(this.url('needs-you'))));
      this.needsYouStateData.set('ready');
    } catch (err) {
      this.needsYouStateData.set(isForbidden(err) ? 'forbidden' : 'error');
    }
  }

  async loadCoverage(): Promise<void> {
    if (this.coverageStateData() === 'forbidden') return;
    try {
      this.coverageData.set(
        await firstValueFrom(this.http.get<FleetCoverage>(this.url('backup-protection'))),
      );
      this.coverageStateData.set('ready');
    } catch (err) {
      this.coverageStateData.set(isForbidden(err) ? 'forbidden' : 'error');
    }
  }

  appProtection(applicationId: string): Promise<AppProtection> {
    return firstValueFrom(
      this.http.get<AppProtection>(
        `${this.appConfig.apiBaseUrl}/api/v1/applications/${encodeURIComponent(applicationId)}/backup-protection`,
      ),
    );
  }

  async loadAll(): Promise<void> {
    await Promise.all([this.loadMetrics(), this.loadNeedsYou(), this.loadCoverage()]);
  }
}
