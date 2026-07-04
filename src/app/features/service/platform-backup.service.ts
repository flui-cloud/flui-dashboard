import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

/** Off-provider DR for the Flui control plane itself ("platform" backup class). */
export const PLATFORM_ENGINE_CLASS = 'platform';

export interface PlatformHeartbeat {
  url?: string | null;
}

export interface PlatformPolicyMetadata {
  /** age recipient (age1…) held by the operator; the master can never decrypt its own backup. */
  recipient?: string | null;
  heartbeat?: PlatformHeartbeat | null;
}

export interface PlatformBackupPolicy {
  id: string;
  name: string;
  clusterId?: string | null;
  engineClass: string;
  cronSchedule?: string | null;
  enabled: boolean;
  status: string;
  metadata?: { platform?: PlatformPolicyMetadata | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformJobMetadata {
  databases?: string[];
  zitadelCovered?: boolean;
  insecureDefaults?: string[];
  encryptionKeyFingerprint?: string;
}

export interface PlatformBackupJob {
  id: string;
  policyId?: string | null;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
  metadata?: PlatformJobMetadata | null;
  createdAt: string;
}

export interface SetPlatformConfigInput {
  recipient: string;
  heartbeatUrl?: string;
}

/**
 * Client for the "platform" backup class — the Flui master's own DR surface.
 *
 * A platform policy dumps the Flui DB + key material to an off-provider bucket;
 * the key bundle is age-encrypted to an OPERATOR-held recipient (the private
 * identity lives offline, so this browser-reachable surface never generates it).
 * `POST /backup-policies/:id/platform-config` is not in the generated client, so
 * this calls the REST API directly — auth + base URL come from the interceptor /
 * AppConfigService (mirrors MigrationService / DnsReplicaService).
 */
@Injectable({ providedIn: 'root' })
export class PlatformBackupService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private url(path: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/${path}`;
  }

  /** Set / update the operator recipient + dead-man's-switch heartbeat URL. */
  setPlatformConfig(
    policyId: string,
    input: SetPlatformConfigInput,
  ): Promise<PlatformBackupPolicy> {
    return firstValueFrom(
      this.http.post<PlatformBackupPolicy>(
        this.url(`backup-policies/${policyId}/platform-config`),
        input,
      ),
    );
  }

  /** All backup policies of the platform class (engineClass === 'platform'). */
  async listPlatformPolicies(): Promise<PlatformBackupPolicy[]> {
    const policies = await firstValueFrom(
      this.http.get<PlatformBackupPolicy[]>(this.url('backup-policies')),
    );
    return (policies ?? []).filter((p) => p.engineClass === PLATFORM_ENGINE_CLASS);
  }

  /** Most recent job (by finish, else create time) belonging to any of the given policies. */
  async lastPlatformJob(policyIds: string[]): Promise<PlatformBackupJob | null> {
    if (policyIds.length === 0) return null;
    const ids = new Set(policyIds);
    const jobs = await firstValueFrom(
      this.http.get<PlatformBackupJob[]>(this.url('backup-jobs')),
    );
    const mine = (jobs ?? []).filter((j) => j.policyId != null && ids.has(j.policyId));
    if (mine.length === 0) return null;
    return mine.reduce(
      (latest, job) => (this.jobTime(job) > this.jobTime(latest) ? job : latest),
      mine[0],
    );
  }

  private jobTime(job: PlatformBackupJob): number {
    const t = new Date(job.finishedAt ?? job.createdAt).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
}
