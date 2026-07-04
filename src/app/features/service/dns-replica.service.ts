import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export type ReplicaProvider = 'hetzner' | 'scaleway';
export type ReplicaProviderOrNone = ReplicaProvider | 'none';

export type ReplicaStatus =
  | 'pending'
  | 'populating'
  | 'active'
  | 'degraded'
  | 'disabled';

export interface DnsReplica {
  id: string;
  dnsZoneId: string;
  dnsProvider: ReplicaProviderOrNone;
  providerZoneId: string;
  status: ReplicaStatus;
  lastReconciledAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DnsZone {
  id: string;
  providerZoneId: string;
  zoneName: string;
  dnsProvider: ReplicaProviderOrNone;
  description?: string;
  recordTtlSeconds: number;
  replicas: DnsReplica[];
  createdAt: string;
  updatedAt: string;
}

export interface ReplicaDiffMismatch {
  name: string;
  type: string;
  expected: string;
  actual: string;
}

export interface ReplicaDiffReport {
  provider: string;
  providerZoneId: string;
  created: number;
  updated: number;
  orphansDeleted: number;
  mismatches: ReplicaDiffMismatch[];
  errors: string[];
}

export interface RegisterReplicaInput {
  dnsProvider: ReplicaProvider;
  providerZoneId?: string;
}

/**
 * Dual-provider DNS redundancy client. A logical zone (one primary provider)
 * can be published on a SECOND provider as a "replica"; every record Flui writes
 * fans out to each active replica and a cron reconciles them. These endpoints
 * are not in the generated client, so this calls them directly — auth + base URL
 * come from the interceptor / AppConfigService (mirrors MigrationService).
 */
@Injectable({ providedIn: 'root' })
export class DnsReplicaService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private url(path: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/dns/${path}`;
  }

  /** Zones enriched with `recordTtlSeconds` + `replicas` (superset of the generated DTO). */
  listZones(): Promise<DnsZone[]> {
    return firstValueFrom(this.http.get<DnsZone[]>(this.url('zones')));
  }

  listReplicas(zoneId: string): Promise<DnsReplica[]> {
    return firstValueFrom(this.http.get<DnsReplica[]>(this.url(`zones/${zoneId}/replicas`)));
  }

  registerReplica(zoneId: string, input: RegisterReplicaInput): Promise<DnsReplica> {
    return firstValueFrom(
      this.http.post<DnsReplica>(this.url(`zones/${zoneId}/replicas`), input),
    );
  }

  populateReplica(zoneId: string, replicaId: string): Promise<ReplicaDiffReport> {
    return firstValueFrom(
      this.http.post<ReplicaDiffReport>(
        this.url(`zones/${zoneId}/replicas/${replicaId}/populate`),
        {},
      ),
    );
  }

  verifyReplica(zoneId: string, replicaId: string): Promise<ReplicaDiffReport> {
    return firstValueFrom(
      this.http.post<ReplicaDiffReport>(
        this.url(`zones/${zoneId}/replicas/${replicaId}/verify`),
        {},
      ),
    );
  }

  disableReplica(zoneId: string, replicaId: string): Promise<DnsReplica> {
    return firstValueFrom(
      this.http.post<DnsReplica>(
        this.url(`zones/${zoneId}/replicas/${replicaId}/disable`),
        {},
      ),
    );
  }

  enableReplica(zoneId: string, replicaId: string): Promise<DnsReplica> {
    return firstValueFrom(
      this.http.post<DnsReplica>(
        this.url(`zones/${zoneId}/replicas/${replicaId}/enable`),
        {},
      ),
    );
  }

  removeReplica(zoneId: string, replicaId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.url(`zones/${zoneId}/replicas/${replicaId}`)),
    );
  }
}
