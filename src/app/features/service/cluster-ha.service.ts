import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

// Hand-written calls, not part of the generated API client.
export interface ClusterHaMissingRole {
  role: 'server' | 'data-host';
  zone: string;
  why: string;
}

export interface ClusterHaZone {
  zone: string;
  role: 'data' | 'vote';
  servers: string[];
  dataHosts: string[];
}

export interface ClusterHaRoundTrip {
  from: string;
  to: string;
  ms: number | null;
}

export interface ClusterHaObserved {
  at: string | null;
  etcdLeader: { node: string | null; zone: string | null } | null;
  roundTrips: ClusterHaRoundTrip[];
  reachedThrough: string | null;
  reachableServers: string[];
}

export interface ClusterHaView {
  clusterId: string;
  level: 'standard' | 'three-locations';
  region: string | null;
  topology: { validated: boolean; zones: ClusterHaZone[] } | null;
  unsupported: string | null;
  servers: { count: number; ready: number; zones: string[] };
  survives: string[];
  doesNotSurvive: string[];
  warnings: string[];
  missing: ClusterHaMissingRole[];
  observed?: ClusterHaObserved;
}

@Injectable({ providedIn: 'root' })
export class ClusterHaService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private url(clusterId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/clusters/${encodeURIComponent(clusterId)}/high-availability`;
  }

  get(clusterId: string): Observable<ClusterHaView> {
    return this.http.get<ClusterHaView>(this.url(clusterId));
  }

  /** Buys the missing server or node for data in a location. */
  addNode(
    clusterId: string,
    role: ClusterHaMissingRole['role'],
    zone: string,
  ): Observable<{ operationId: string }> {
    return this.http.post<{ operationId: string }>(
      `${this.url(clusterId)}/nodes`,
      { role, zone },
    );
  }
}
