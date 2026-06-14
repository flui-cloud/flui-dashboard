import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  CommandResult,
  KeyValueRead,
  KeyspaceSummary,
  KvAssistRequest,
  KvAssistResult,
  KvCommandRequest,
  KvScanRequest,
  ScanResult,
} from '../model/kv-console.models';

@Injectable({ providedIn: 'root' })
export class KvConsoleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/kv`;
  }

  getSummary(appId: string): Observable<KeyspaceSummary> {
    return this.http.get<KeyspaceSummary>(`${this.base(appId)}/summary`);
  }

  scanKeys(appId: string, req: KvScanRequest): Observable<ScanResult> {
    return this.http.post<ScanResult>(`${this.base(appId)}/keys`, req);
  }

  readValue(appId: string, key: string): Observable<KeyValueRead> {
    return this.http.post<KeyValueRead>(`${this.base(appId)}/value`, { key });
  }

  runCommand(appId: string, req: KvCommandRequest): Observable<CommandResult> {
    return this.http.post<CommandResult>(`${this.base(appId)}/command`, req);
  }

  assist(appId: string, req: KvAssistRequest): Observable<KvAssistResult> {
    return this.http.post<KvAssistResult>(`${this.base(appId)}/assist`, req);
  }
}
