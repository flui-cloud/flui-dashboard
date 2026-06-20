import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  MeiliConnectionInfo,
  MeiliIndex,
  MeiliRawSuggestion,
  MeiliSearchResult,
  MeiliSearchSuggestion,
  MeiliServerInfo,
} from '../model/meilisearch-console.models';

export interface MeiliAssistRequest {
  prompt: string;
  index?: string;
  conversation?: { role: 'user' | 'assistant'; content: string }[];
  model?: string;
  provider?: string;
  connectionId?: string;
}

export interface RawRestResponse {
  status: number;
  durationMs: number;
  body: unknown;
}

@Injectable({ providedIn: 'root' })
export class MeilisearchConsoleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/fulltext`;
  }

  getConnectionInfo(appId: string): Observable<MeiliConnectionInfo> {
    return this.http.get<MeiliConnectionInfo>(
      `${this.base(appId)}/connection-info`,
    );
  }

  getServerInfo(appId: string): Observable<MeiliServerInfo> {
    return this.http.get<MeiliServerInfo>(`${this.base(appId)}/server-info`);
  }

  indexes(appId: string): Observable<MeiliIndex[]> {
    return this.http.get<MeiliIndex[]>(`${this.base(appId)}/indexes`);
  }

  search(
    appId: string,
    req: { index: string; q?: string; filter?: string; limit?: number; offset?: number },
  ): Observable<MeiliSearchResult> {
    return this.http.post<MeiliSearchResult>(`${this.base(appId)}/search`, req);
  }

  runRaw(
    appId: string,
    req: { method: string; path: string; body?: unknown; readOnly: boolean },
  ): Observable<RawRestResponse> {
    return this.http.post<RawRestResponse>(`${this.base(appId)}/raw`, req);
  }

  assist(
    appId: string,
    req: MeiliAssistRequest,
  ): Observable<MeiliSearchSuggestion> {
    return this.http.post<MeiliSearchSuggestion>(
      `${this.base(appId)}/assist`,
      req,
    );
  }

  assistRaw(
    appId: string,
    req: MeiliAssistRequest,
  ): Observable<MeiliRawSuggestion> {
    return this.http.post<MeiliRawSuggestion>(
      `${this.base(appId)}/assist-raw`,
      req,
    );
  }
}
