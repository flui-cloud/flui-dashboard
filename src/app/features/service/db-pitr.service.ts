import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export interface DbPitrStatus {
  applicationId: string;
  continuousBackupEnabled: boolean;
  policyId: string | null;
  cronSchedule: string | null;
  backupCount: number;
  /** [oldest, newest] recoverable window; newest understates it (WAL ≈ now). */
  window: { oldest: string | null; newest: string | null } | null;
  lastBackup: { engineRef: string | null; at: string } | null;
  latestArtifactId: string | null;
  sourceDestinationId: string | null;
}

export interface DbPitrRestoreInput {
  name: string;
  clusterId?: string;
  recoveryTargetTime?: string;
}

export interface DbPitrRestoreResult {
  id: string;
  status: string;
  infrastructureOperationId?: string;
}

@Injectable({ providedIn: 'root' })
export class DbPitrService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/db-pitr`;
  }

  status(appId: string): Observable<DbPitrStatus> {
    return this.http.get<DbPitrStatus>(`${this.base(appId)}/status`);
  }

  /** Restore as-of a point in time into a NEW install (non-destructive). */
  restore(
    appId: string,
    input: DbPitrRestoreInput,
  ): Observable<DbPitrRestoreResult> {
    return this.http.post<DbPitrRestoreResult>(
      `${this.base(appId)}/restore`,
      input,
    );
  }
}
