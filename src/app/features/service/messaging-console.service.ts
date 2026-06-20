import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  JsStream,
  MessagingConnectionInfo,
  MessagingCreateStreamRequest,
  MessagingPeekRequest,
  MessagingPublishRequest,
  MessagingPublishResult,
  MessagingServerInfo,
  QueueMessage,
  QueueStream,
} from '../model/messaging-console.models';

@Injectable({ providedIn: 'root' })
export class MessagingConsoleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/messaging`;
  }

  getConnectionInfo(appId: string): Observable<MessagingConnectionInfo> {
    return this.http.get<MessagingConnectionInfo>(
      `${this.base(appId)}/connection-info`,
    );
  }

  getServerInfo(appId: string): Observable<MessagingServerInfo> {
    return this.http.get<MessagingServerInfo>(
      `${this.base(appId)}/server-info`,
    );
  }

  getStreams(appId: string): Observable<JsStream[]> {
    return this.http.get<JsStream[]>(`${this.base(appId)}/streams`);
  }

  publish(
    appId: string,
    req: MessagingPublishRequest,
  ): Observable<MessagingPublishResult> {
    // Explicit user action behind a button; the messaging console has no
    // read-only toggle, so it opts into the write. The backend gate (default
    // read-only) is honored for API/agent callers that omit or set the flag.
    return this.http.post<MessagingPublishResult>(
      `${this.base(appId)}/publish`,
      { ...req, readOnly: false },
    );
  }

  peek(appId: string, req: MessagingPeekRequest): Observable<QueueMessage[]> {
    return this.http.post<QueueMessage[]>(`${this.base(appId)}/peek`, req);
  }

  createStream(
    appId: string,
    req: MessagingCreateStreamRequest,
  ): Observable<QueueStream> {
    return this.http.post<QueueStream>(`${this.base(appId)}/streams`, {
      ...req,
      readOnly: false,
    });
  }

  deleteStream(appId: string, name: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(
      `${this.base(appId)}/streams/${encodeURIComponent(name)}?readOnly=false`,
    );
  }
}
