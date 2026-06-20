import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  CacheConnectionInfo,
  CacheGetResult,
  CacheServerInfo,
} from '../model/cache-console.models';

@Injectable({ providedIn: 'root' })
export class CacheConsoleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/cache`;
  }

  getConnectionInfo(appId: string): Observable<CacheConnectionInfo> {
    return this.http.get<CacheConnectionInfo>(
      `${this.base(appId)}/connection-info`,
    );
  }

  getServerInfo(appId: string): Observable<CacheServerInfo> {
    return this.http.get<CacheServerInfo>(`${this.base(appId)}/server-info`);
  }

  get(appId: string, key: string): Observable<CacheGetResult> {
    return this.http.post<CacheGetResult>(`${this.base(appId)}/get`, { key });
  }

  set(
    appId: string,
    req: { key: string; value: string; ttlSeconds?: number; readOnly?: boolean },
  ): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${this.base(appId)}/set`, req);
  }

  delete(
    appId: string,
    req: { key: string; readOnly?: boolean },
  ): Observable<{ deleted: boolean }> {
    return this.http.post<{ deleted: boolean }>(
      `${this.base(appId)}/delete`,
      req,
    );
  }

  flush(appId: string, readOnly: boolean): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${this.base(appId)}/flush`, {
      readOnly,
    });
  }
}
