import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  VolumeBackup,
  VolumeBackupListing,
  VolumeBackupRestoreRequest,
  VolumeBackupRestoreResult,
  VolumeFilesRestoreRequest,
  VolumeFilesRestoreResult,
} from '../model/volume-backup.models';

/** Volume backups kept in backup storage: list, look inside, restore, delete. */
@Injectable({ providedIn: 'root' })
export class VolumeBackupsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${encodeURIComponent(appId)}/volume-backups`;
  }

  private one(appId: string, backupId: string): string {
    return `${this.base(appId)}/${encodeURIComponent(backupId)}`;
  }

  list(appId: string): Promise<VolumeBackup[]> {
    return firstValueFrom(this.http.get<VolumeBackup[]>(this.base(appId)));
  }

  browse(
    appId: string,
    backupId: string,
    path = '',
  ): Promise<VolumeBackupListing> {
    const params = path ? new HttpParams().set('path', path) : undefined;
    return firstValueFrom(
      this.http.get<VolumeBackupListing>(
        `${this.one(appId, backupId)}/files`,
        { params },
      ),
    );
  }

  restore(
    appId: string,
    backupId: string,
    body: VolumeBackupRestoreRequest = {},
  ): Promise<VolumeBackupRestoreResult> {
    return firstValueFrom(
      this.http.post<VolumeBackupRestoreResult>(
        `${this.one(appId, backupId)}/restore`,
        body,
      ),
    );
  }

  restoreFiles(
    appId: string,
    backupId: string,
    body: VolumeFilesRestoreRequest,
  ): Promise<VolumeFilesRestoreResult> {
    return firstValueFrom(
      this.http.post<VolumeFilesRestoreResult>(
        `${this.one(appId, backupId)}/restore-files`,
        body,
      ),
    );
  }

  remove(appId: string, backupId: string): Promise<{ operationId: string }> {
    return firstValueFrom(
      this.http.delete<{ operationId: string }>(this.one(appId, backupId)),
    );
  }

  errorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string | string[] }; message?: string };
    const m = e?.error?.message;
    if (Array.isArray(m)) return m.join(', ');
    return m || fallback;
  }
}
