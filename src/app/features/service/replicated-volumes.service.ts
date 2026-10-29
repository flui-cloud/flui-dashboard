import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

// Hand-written calls, not part of the generated API client.
export type ReplicatedVolumesPlan =
  | {
      feasible: true;
      zones: string[];
      storageNodes: string[];
      tieBreakers: string[];
    }
  | { feasible: false; reason: string };

export interface ReplicatedVolumesView {
  clusterId: string;
  enabled: boolean;
  storageClass: string;
  storageNodes: string[];
  warnings: string[];
  plan: ReplicatedVolumesPlan;
  operation: { id: string; status: string } | null;
}

export interface ReplicatedVolumesStarted {
  operationId: string;
  storageNodes: string[];
  sizeGiB: number;
}

@Injectable({ providedIn: 'root' })
export class ReplicatedVolumesService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private url(clusterId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/clusters/${encodeURIComponent(clusterId)}/replicated-volumes`;
  }

  get(clusterId: string): Observable<ReplicatedVolumesView> {
    return this.http.get<ReplicatedVolumesView>(this.url(clusterId));
  }

  enable(clusterId: string): Observable<ReplicatedVolumesStarted> {
    return this.http.post<ReplicatedVolumesStarted>(this.url(clusterId), {});
  }
}
