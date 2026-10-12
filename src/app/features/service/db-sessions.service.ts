import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

// Hand-written calls, not part of the generated API client.
export type DbSessionKind =
  'client' | 'pooler' | 'local' | 'replication' | 'background';
export type DbSessionAction = 'cancel' | 'terminate';

export interface DbSession {
  pid: number;
  backendStart: string;
  kind: DbSessionKind;
  via: 'pooler' | 'direct' | 'socket';
  user: string;
  database: string;
  applicationName: string;
  clientAddr: string | null;
  clientApp: { id: string; name: string } | null;
  state: string;
  waitEventType: string | null;
  waitEvent: string | null;
  xactAgeMs: number | null;
  queryAgeMs: number | null;
  stateAgeMs: number | null;
  writing: boolean;
  query: string;
  blockedBy: number[];
  blocks: number;
  actions: { cancel: boolean; terminate: boolean; reason: string | null };
}

export interface DbPoolerView {
  mode: 'transaction' | 'session';
  paused: boolean;
  upstream: 'local' | 'forward';
  reason: string | null;
  pools: Array<{
    pod: string;
    database: string;
    user: string;
    clientsActive: number;
    clientsWaiting: number;
    serversActive: number;
    serversIdle: number;
    maxWaitMs: number;
  }>;
  clients: DbPooledClient[];
}

export interface DbPooledClient {
  pod: string;
  id: number;
  addr: string;
  clientApp: { id: string; name: string } | null;
  user: string;
  database: string;
  state: string;
  waitMs: number;
  serverPid: number | null;
  applicationName: string;
  connectTime: string;
  canClose: boolean;
}

export interface DbSessionsInfo {
  engine: 'postgres';
  capturedAt: string;
  truncated: boolean;
  maxConnections: number;
  total: number;
  counts: {
    active: number;
    idle: number;
    idleInTransaction: number;
    waiting: number;
    blocked: number;
  };
  sessions: DbSession[];
  pooler: DbPoolerView | null;
}

export interface DbPooledClientCloseResult {
  clientId: number;
  pod: string;
  message: string;
}

export interface DbSessionActionResult {
  pid: number;
  action: DbSessionAction;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class DbSessionsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${encodeURIComponent(appId)}/db/sessions`;
  }

  list(appId: string, all = false): Observable<DbSessionsInfo> {
    return this.http.get<DbSessionsInfo>(this.base(appId), {
      params: all ? { all: 'true' } : {},
    });
  }

  act(
    appId: string,
    session: Pick<DbSession, 'pid' | 'backendStart'>,
    action: DbSessionAction,
  ): Observable<DbSessionActionResult> {
    return this.http.post<DbSessionActionResult>(
      `${this.base(appId)}/${session.pid}/${action}`,
      { backendStart: session.backendStart },
    );
  }

  closeClient(
    appId: string,
    client: Pick<DbPooledClient, 'id' | 'pod' | 'connectTime'>,
  ): Observable<DbPooledClientCloseResult> {
    return this.http.post<DbPooledClientCloseResult>(
      `${this.appConfig.apiBaseUrl}/api/v1/applications/${encodeURIComponent(appId)}/db/pooler/clients/${client.id}/close`,
      { pod: client.pod, connectTime: client.connectTime },
    );
  }
}
