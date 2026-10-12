import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export type MigrationType = 'app' | 'db' | 'full';
export type CutoverMode = 'auto' | 'manual';
export type DbMigrationMode = 'live' | 'restore';
export type StagingMode = 'scaled-down' | 'live-fenced';

/** The API's bridge block: rendered as is, never recomputed here. */
export interface MigrationBridge {
  mode: 'bridge' | 'dns-only';
  skipReason: string | null;
  state: 'preparing' | 'active' | 'closed' | null;
  hosts: { fqdn: string; certificate: string | null; certificateReady: boolean }[];
  activatedAt?: string | null;
  dnsFlippedAt?: string | null;
  closableAt: string | null;
  readyToClose: boolean;
  blockedBy?: 'ttl' | 'dns' | null;
  summary: string;
}

export interface MigrationNextStep {
  key: string;
  text: string;
}

/** Extra fields the API reports for db and full migrations. */
export interface MigrationMeasures {
  kind?: 'logical' | 'physical' | null;
  link?: {
    state: 'open' | 'closing' | 'closed';
    listenerNode: string | null;
    dialerNode: string | null;
    handshakeSeen: boolean;
  } | null;
  fence?: {
    appliedAt: string | null;
    fenceLsn: string | null;
    promoteIssuedAt: string | null;
    released: boolean;
  } | null;
  baseBackup?: { phase: string; lagBytes: number | null } | null;
  pooler?: {
    paused: boolean;
    pausedAt: string | null;
    resumedAt: string | null;
    deadlineMs: number;
    cut: Array<{ clientApp: string | null; heldMs: number | null }>;
  } | null;
  sourceWalCap?: { value: string; note: string | null } | null;
  writePauseMs?: number | null;
  writePauseEndedBy?: 'bridge' | 'dns' | 'promote' | 'resume' | null;
  interruptionMs?: number | null;
  nextSteps?: MigrationNextStep[];
}

export interface AppMigration {
  id: string;
  srcAppId: string;
  srcClusterId: string;
  targetClusterId: string;
  cutoverMode: CutoverMode;
  status: string;
  fullMigrationId?: string | null;
  bridge?: MigrationBridge | null;
  canResumeCutover?: boolean;
  interruptionMs?: number | null;
  sourceDestroyedAt?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string;
}

export interface DbMigration extends MigrationMeasures {
  id: string;
  srcAppId: string;
  dstAppId?: string | null;
  targetClusterId: string;
  displayName?: string | null;
  mode?: DbMigrationMode;
  cutoverMode: CutoverMode;
  status: string;
  fullMigrationId?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string;
}

export interface FullMigration extends MigrationMeasures {
  id: string;
  appId: string;
  dbAppId: string;
  targetClusterId: string;
  cutoverMode: CutoverMode;
  stagingMode: StagingMode;
  status: string;
  dbMigrationId?: string | null;
  appMigrationId?: string | null;
  bridge?: MigrationBridge | null;
  canResumeCutover?: boolean;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string;
}

/** A type-tagged row for a unified migrations table. */
export type MigrationRow =
  | ({ type: 'app' } & AppMigration)
  | ({ type: 'db' } & DbMigration)
  | ({ type: 'full' } & FullMigration);

export interface CreateAppMigrationInput {
  srcAppId: string;
  targetClusterId: string;
  cutover?: CutoverMode;
  backupDestinationId?: string;
}
export interface CreateDbMigrationInput {
  srcAppId: string;
  targetClusterId: string;
  displayName?: string;
  mode?: DbMigrationMode;
  cutover?: CutoverMode;
  recoveryTargetTime?: string;
  verifyRowCounts?: boolean;
}
export interface CreateFullMigrationInput {
  appId: string;
  dbAppId: string;
  targetClusterId: string;
  cutover?: CutoverMode;
  stagingMode?: StagingMode;
}

/**
 * Cross-cluster migration client (app-workload / managed-DB / full-app), one
 * REST resource each. Endpoints are not in the generated client, so this calls
 * them directly — auth + base URL come from the interceptor / AppConfigService.
 */
@Injectable({ providedIn: 'root' })
export class MigrationService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private url(path: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/${path}`;
  }

  private readonly resource: Record<MigrationType, string> = {
    app: 'app-migrations',
    db: 'db-migrations',
    full: 'full-migrations',
  };

  // ── App ──────────────────────────────────────────────────────────────────
  listApp(): Promise<AppMigration[]> {
    return firstValueFrom(this.http.get<AppMigration[]>(this.url('app-migrations')));
  }
  createApp(input: CreateAppMigrationInput): Promise<AppMigration> {
    return firstValueFrom(this.http.post<AppMigration>(this.url('app-migrations'), input));
  }

  // ── DB ───────────────────────────────────────────────────────────────────
  listDb(): Promise<DbMigration[]> {
    return firstValueFrom(this.http.get<DbMigration[]>(this.url('db-migrations')));
  }
  createDb(input: CreateDbMigrationInput): Promise<DbMigration> {
    return firstValueFrom(this.http.post<DbMigration>(this.url('db-migrations'), input));
  }

  // ── Full ─────────────────────────────────────────────────────────────────
  listFull(): Promise<FullMigration[]> {
    return firstValueFrom(this.http.get<FullMigration[]>(this.url('full-migrations')));
  }
  createFull(input: CreateFullMigrationInput): Promise<FullMigration> {
    return firstValueFrom(this.http.post<FullMigration>(this.url('full-migrations'), input));
  }

  // ── Lifecycle (type-dispatched) ──────────────────────────────────────────
  get(type: MigrationType, id: string): Promise<unknown> {
    return firstValueFrom(this.http.get(this.url(`${this.resource[type]}/${id}`)));
  }
  cutover(type: MigrationType, id: string): Promise<unknown> {
    return firstValueFrom(this.http.post(this.url(`${this.resource[type]}/${id}/cutover`), {}));
  }
  destroySource(type: 'app' | 'full', id: string, opts: { closeBridge?: boolean } = {}): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        this.url(`${this.resource[type]}/${id}/destroy-source`),
        opts.closeBridge ? { closeBridge: true } : {},
      ),
    );
  }
  abort(type: MigrationType, id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(this.url(`${this.resource[type]}/${id}`)));
  }

  /** All migrations across the three planes, type-tagged, newest first. */
  async listAll(): Promise<MigrationRow[]> {
    const [app, db, full] = await Promise.all([
      this.listApp(),
      this.listDb(),
      this.listFull(),
    ]);
    const rows: MigrationRow[] = [
      ...app.map((m) => ({ type: 'app' as const, ...m })),
      ...db.map((m) => ({ type: 'db' as const, ...m })),
      ...full.map((m) => ({ type: 'full' as const, ...m })),
    ];
    return rows.sort((a, b) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
    );
  }
}
