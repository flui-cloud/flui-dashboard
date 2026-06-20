import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  SearchAssistRequest,
  SearchAssistResult,
  SearchClusterInfo,
  SearchConnectionInfo,
  SearchIndex,
  SearchQueryRequest,
  SearchRawAssistResult,
  SearchRawRequest,
  SearchRawResponse,
  SearchResponse,
} from '../model/search-console.models';

@Injectable({ providedIn: 'root' })
export class SearchConsoleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/search`;
  }

  getConnectionInfo(appId: string): Observable<SearchConnectionInfo> {
    return this.http.get<SearchConnectionInfo>(
      `${this.base(appId)}/connection-info`,
    );
  }

  getClusterInfo(appId: string): Observable<SearchClusterInfo> {
    return this.http.get<SearchClusterInfo>(`${this.base(appId)}/cluster-info`);
  }

  listIndices(appId: string): Observable<SearchIndex[]> {
    return this.http.get<SearchIndex[]>(`${this.base(appId)}/indices`);
  }

  getMapping(
    appId: string,
    index: string,
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base(appId)}/mapping`,
      { index },
    );
  }

  query(appId: string, req: SearchQueryRequest): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${this.base(appId)}/query`, req);
  }

  count(
    appId: string,
    index: string,
    body?: Record<string, unknown>,
  ): Observable<{ count: number }> {
    return this.http.post<{ count: number }>(`${this.base(appId)}/count`, {
      index,
      body,
    });
  }

  assist(
    appId: string,
    req: SearchAssistRequest,
  ): Observable<SearchAssistResult> {
    return this.http.post<SearchAssistResult>(
      `${this.base(appId)}/assist`,
      req,
    );
  }

  /** Dev Tools console: run one raw REST call (read-only gate enforced server-side). */
  runRaw(
    appId: string,
    req: SearchRawRequest,
  ): Observable<SearchRawResponse> {
    return this.http.post<SearchRawResponse>(`${this.base(appId)}/raw`, req);
  }

  /** Dev Tools copilot: NL → one raw REST request for the console editor. */
  assistRaw(
    appId: string,
    req: SearchAssistRequest,
  ): Observable<SearchRawAssistResult> {
    return this.http.post<SearchRawAssistResult>(
      `${this.base(appId)}/assist-raw`,
      req,
    );
  }
}
