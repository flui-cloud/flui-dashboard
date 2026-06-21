import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export interface DbBackupInfo {
  engine: string;
  database: string | null;
  format: 'sql' | 'rdb' | null;
  supported: boolean;
  restoreSupported: boolean;
  reason: string | null;
  suggestedFilename: string;
}

@Injectable({ providedIn: 'root' })
export class DbBackupService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/db-backup`;
  }

  info(appId: string): Observable<DbBackupInfo> {
    return this.http.get<DbBackupInfo>(`${this.base(appId)}/info`);
  }

  /** Download a logical dump as a Blob (auth header added by the interceptor). */
  dump(appId: string): Observable<Blob> {
    return this.http.get(`${this.base(appId)}/dump`, { responseType: 'blob' });
  }

  /** Restore a dump file (raw body). Destructive — backend requires confirm=true. */
  restore(appId: string, file: File): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${this.base(appId)}/restore?confirm=true`,
      file,
      { headers: { 'Content-Type': 'application/octet-stream' } },
    );
  }
}
