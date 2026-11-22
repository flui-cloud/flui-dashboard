import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export type DbImportStatus =
  | 'checking'
  | 'copying'
  | 'streaming'
  | 'cutting-over'
  | 'completed'
  | 'failed'
  | 'aborted';

export interface DbImportSource {
  host: string;
  port: number;
  database: string;
  user: string;
  sslmode: 'disable' | 'prefer' | 'require' | 'verify-full';
}

export interface DbImportView {
  id: string;
  engine: 'postgres' | 'mariadb';
  status: DbImportStatus;
  source: DbImportSource;
  tablesTotal: number | null;
  tablesCopied: number | null;
  lagBytes: number | null;
  lagSeconds: number | null;
  tablesWithoutKey: string[];
  detail: string | null;
  createdAt: string;
  endedAt: string | null;
}

export const ACTIVE_IMPORT: DbImportStatus[] = [
  'checking',
  'copying',
  'streaming',
  'cutting-over',
];

export const IMPORT_STATE_TEXT: Record<DbImportStatus, string> = {
  checking: 'Checking the source and copying the schema',
  copying: 'Copying the tables',
  streaming: 'Copied; new changes on the source follow here',
  'cutting-over': 'Switching: waiting for the last changes',
  completed: 'Imported; detached from the source',
  failed: 'Failed',
  aborted: 'Cancelled',
};

export function bytesText(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

/** Copying an external database into a Flui one of the same engine. */
@Injectable({ providedIn: 'root' })
export class DbImportService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private url(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${encodeURIComponent(appId)}/import`;
  }

  get(appId: string): Observable<DbImportView | null> {
    return this.http.get<DbImportView | null>(this.url(appId));
  }

  start(
    appId: string,
    source: DbImportSource,
    password: string,
  ): Observable<DbImportView> {
    return this.http.post<DbImportView>(this.url(appId), { source, password });
  }

  switch(appId: string): Observable<DbImportView> {
    return this.http.post<DbImportView>(`${this.url(appId)}/cutover`, {});
  }

  cancel(appId: string): Observable<DbImportView> {
    return this.http.delete<DbImportView>(this.url(appId));
  }
}
