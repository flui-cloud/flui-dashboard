import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  SecretListEntry,
  SecretReadResult,
  SecretsConnectionInfo,
  SecretsServerInfo,
} from '../model/secrets-console.models';

@Injectable({ providedIn: 'root' })
export class SecretsConsoleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/secrets`;
  }

  getConnectionInfo(appId: string): Observable<SecretsConnectionInfo> {
    return this.http.get<SecretsConnectionInfo>(
      `${this.base(appId)}/connection-info`,
    );
  }

  getServerInfo(appId: string): Observable<SecretsServerInfo> {
    return this.http.get<SecretsServerInfo>(`${this.base(appId)}/server-info`);
  }

  list(appId: string, prefix: string): Observable<SecretListEntry[]> {
    return this.http.post<SecretListEntry[]>(`${this.base(appId)}/list`, {
      prefix,
    });
  }

  read(
    appId: string,
    path: string,
    version?: number,
  ): Observable<SecretReadResult> {
    return this.http.post<SecretReadResult>(`${this.base(appId)}/read`, {
      path,
      version,
    });
  }

  write(
    appId: string,
    req: { path: string; data: Record<string, string>; readOnly?: boolean },
  ): Observable<{ version: number }> {
    return this.http.post<{ version: number }>(
      `${this.base(appId)}/write`,
      req,
    );
  }

  delete(
    appId: string,
    req: { path: string; destroy?: boolean; readOnly?: boolean },
  ): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${this.base(appId)}/delete`, req);
  }

  undelete(
    appId: string,
    req: { path: string; version: number; readOnly?: boolean },
  ): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${this.base(appId)}/undelete`, req);
  }
}
