import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

// Hand-written calls, not part of the generated API client.
export interface DiskSpace {
  totalGiB: number;
  freeGiB: number;
}

export interface NodeDisk {
  node: string;
  zone: string | null;
  disk: DiskSpace | null;
  copies: DiskSpace | null;
}

export interface NodeDisksView {
  measuredAt: string;
  nodes: NodeDisk[];
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class NodeDisksService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  get(clusterId: string): Observable<NodeDisksView> {
    return this.http.get<NodeDisksView>(
      `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/clusters/${encodeURIComponent(clusterId)}/storage/disks`,
    );
  }
}
