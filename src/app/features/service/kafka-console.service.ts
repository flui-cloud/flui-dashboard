import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  KafkaAssistResult,
  KafkaClusterInfo,
  KafkaCommandResult,
  KafkaConnectionInfo,
  KafkaGroupSummary,
  KafkaTopicSummary,
} from '../model/kafka-console.models';

export interface KafkaAssistRequest {
  prompt: string;
  conversation?: { role: 'user' | 'assistant'; content: string }[];
  model?: string;
  provider?: string;
  connectionId?: string;
}

@Injectable({ providedIn: 'root' })
export class KafkaConsoleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/kafka`;
  }

  getConnectionInfo(appId: string): Observable<KafkaConnectionInfo> {
    return this.http.get<KafkaConnectionInfo>(
      `${this.base(appId)}/connection-info`,
    );
  }

  getClusterInfo(appId: string): Observable<KafkaClusterInfo> {
    return this.http.get<KafkaClusterInfo>(`${this.base(appId)}/cluster-info`);
  }

  topics(appId: string): Observable<KafkaTopicSummary[]> {
    return this.http.get<KafkaTopicSummary[]>(`${this.base(appId)}/topics`);
  }

  groups(appId: string): Observable<KafkaGroupSummary[]> {
    return this.http.get<KafkaGroupSummary[]>(`${this.base(appId)}/groups`);
  }

  run(
    appId: string,
    req: { command: string; readOnly?: boolean },
  ): Observable<KafkaCommandResult> {
    return this.http.post<KafkaCommandResult>(`${this.base(appId)}/run`, req);
  }

  assist(
    appId: string,
    req: KafkaAssistRequest,
  ): Observable<KafkaAssistResult> {
    return this.http.post<KafkaAssistResult>(`${this.base(appId)}/assist`, req);
  }
}
