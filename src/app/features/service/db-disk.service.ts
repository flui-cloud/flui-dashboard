import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export interface DbDiskInfo {
  available: boolean;
  reason: string | null;
  engine: string | null;
  mountPath: string | null;
  used_bytes: number | null;
  size_bytes: number | null;
  available_bytes: number | null;
  utilization_percent: number | null;
  alert_level: 'none' | 'warning' | 'critical';
}

@Injectable({ providedIn: 'root' })
export class DbDiskService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  disk(appId: string): Observable<DbDiskInfo> {
    return this.http.get<DbDiskInfo>(
      `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/db-disk`,
    );
  }
}
