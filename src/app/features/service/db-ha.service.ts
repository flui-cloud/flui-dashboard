import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

// Hand-written calls, not part of the generated API client.
export interface DatabaseHaState {
  cluster: string;
  durability: 'required' | 'preferred';
  instances: number;
  state: 'copying' | 'active' | 'failed';
  since: string;
  detail?: string;
}

export interface DatabaseHaInstance {
  instance: string;
  node: string | null;
  zone: string | null;
  ready: boolean;
}

export interface DatabaseHaCopy extends DatabaseHaInstance {
  confirms: boolean;
  flushLagMs: number | null;
  replayLagMs: number | null;
}

export interface DatabaseHaPlacement {
  readAt: string;
  primary: DatabaseHaInstance | null;
  copies: DatabaseHaCopy[];
}

export interface DatabaseHaView {
  appId: string;
  highlyAvailable: boolean;
  state: DatabaseHaState | null;
  placement?: DatabaseHaPlacement | null;
}

@Injectable({ providedIn: 'root' })
export class DbHaService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private url(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${encodeURIComponent(appId)}/db/high-availability`;
  }

  get(appId: string): Observable<DatabaseHaView> {
    return this.http.get<DatabaseHaView>(this.url(appId));
  }

  enable(appId: string): Observable<{ operationId: string }> {
    return this.http.post<{ operationId: string }>(this.url(appId), {
      durability: 'required',
    });
  }
}
