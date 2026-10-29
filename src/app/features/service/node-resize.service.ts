import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

// Hand-written calls, not part of the generated API client.
export interface ResizeCandidate {
  name: string;
  direction: 'upgrade' | 'downgrade' | 'current';
  cores: number;
  memoryGb: number;
  diskGb: number;
  monthlyCostEur: string;
  monthlyDeltaEur: string;
  architecture?: string;
}

export interface NodeResizePreview {
  node: {
    id: string;
    name: string;
    nodeType: string;
    currentServerType: string;
  };
  affectedDedicatedApps: Array<{ id: string; slug: string }>;
  expectedDowntimeMs: number;
  warning: string;
  candidates: ResizeCandidate[];
  highAvailability: {
    refusal: string | null;
    switchovers: Array<{ namespace: string; cluster: string; target: string }>;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class NodeResizeService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private url(clusterId: string, nodeId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/clusters/${encodeURIComponent(clusterId)}/nodes/${encodeURIComponent(nodeId)}/scale`;
  }

  preview(clusterId: string, nodeId: string): Observable<NodeResizePreview> {
    return this.http.get<NodeResizePreview>(
      `${this.url(clusterId, nodeId)}/preview`,
    );
  }

  resize(
    clusterId: string,
    nodeId: string,
    body: {
      targetServerType: string;
      upgradeDisk?: boolean;
      copiesGiB?: number;
    },
  ): Observable<{ id: string; status: string }> {
    return this.http.post<{ id: string; status: string }>(
      this.url(clusterId, nodeId),
      body,
    );
  }
}
