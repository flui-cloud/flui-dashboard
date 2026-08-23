import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export interface OrphanedClaim {
  name: string;
  namespace: string;
  requested: string | null;
  requestedBytes: number;
  sizeLabel: string;
  storageClass: string | null;
  phase: string | null;
  createdAt: string | null;
  lastKnownApplication?: { id: string; name: string; deletedAt: string | null };
  reason: string;
}

export interface OrphanedClaims {
  clusterId: string;
  namespacesScanned: string[];
  claims: OrphanedClaim[];
  totalBytes: number;
  totalLabel: string;
  note?: string;
}

export const claimRef = (claim: OrphanedClaim): string =>
  `${claim.namespace}/${claim.name}`;

@Injectable({ providedIn: 'root' })
export class ClusterOrphanedClaimsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly data = signal<OrphanedClaims | null>(null);
  private readonly loadingData = signal(false);
  private readonly errorData = signal<string | null>(null);
  private readonly removingData = signal<string | null>(null);

  readonly result = this.data.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly removing = this.removingData.asReadonly();

  readonly claims = computed(() => this.data()?.claims ?? []);
  readonly totalLabel = computed(() => this.data()?.totalLabel ?? '0 B');
  readonly note = computed(() => this.data()?.note ?? null);

  private base(clusterId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/clusters/${encodeURIComponent(clusterId)}/storage/orphaned-claims`;
  }

  async load(clusterId: string): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      this.data.set(
        await firstValueFrom(this.http.get<OrphanedClaims>(this.base(clusterId))),
      );
    } catch (error: unknown) {
      this.data.set(null);
      this.errorData.set(messageOf(error, 'Could not read the volumes on this cluster'));
    } finally {
      this.loadingData.set(false);
    }
  }

  async remove(clusterId: string, claim: OrphanedClaim): Promise<boolean> {
    const ref = claimRef(claim);
    this.removingData.set(ref);
    this.errorData.set(null);
    try {
      await firstValueFrom(
        this.http.delete(
          `${this.base(clusterId)}/${encodeURIComponent(claim.namespace)}/${encodeURIComponent(claim.name)}`,
        ),
      );
      return true;
    } catch (error: unknown) {
      this.errorData.set(messageOf(error, `Could not delete ${ref}`));
      return false;
    } finally {
      this.removingData.set(null);
      await this.load(clusterId);
    }
  }

  reset(): void {
    this.data.set(null);
    this.errorData.set(null);
    this.removingData.set(null);
  }
}

function messageOf(error: unknown, fallback: string): string {
  const body = (error as { error?: { message?: string } })?.error?.message;
  return body || (error as { message?: string })?.message || fallback;
}
