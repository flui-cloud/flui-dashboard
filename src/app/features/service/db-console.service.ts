import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  AssistRequest,
  AssistResult,
  DbConnectionInfo,
  RunQueryRequest,
  SchemaTree,
  SqlQueryResult,
} from '../model/db-console.models';

@Injectable({ providedIn: 'root' })
export class DbConsoleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/db`;
  }

  runQuery(appId: string, req: RunQueryRequest): Observable<SqlQueryResult> {
    return this.http.post<SqlQueryResult>(`${this.base(appId)}/query`, req);
  }

  getSchema(appId: string): Observable<SchemaTree> {
    return this.http.get<SchemaTree>(`${this.base(appId)}/schema`);
  }

  assist(appId: string, req: AssistRequest): Observable<AssistResult> {
    return this.http.post<AssistResult>(`${this.base(appId)}/assist`, req);
  }

  getConnectionInfo(appId: string): Observable<DbConnectionInfo> {
    return this.http.get<DbConnectionInfo>(`${this.base(appId)}/connection-info`);
  }
}
