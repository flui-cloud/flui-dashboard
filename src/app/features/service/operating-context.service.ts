import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  ContextDelivery,
  ContextEntry,
  ContextProbeOption,
  EditContextEntry,
  EntryNature,
  EntryReach,
  ContextScopeType,
  WriteContextEntry,
} from '../model/operating-context.models';

export interface ContextFocus {
  slug?: string;
  clusterId?: string;
  clusterName?: string;
  provider?: string;
  project?: string;
  kind?: string;
  owner?: string;
  tags?: string[];
}

@Injectable({ providedIn: 'root' })
export class OperatingContextService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private get base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/operating-context`;
  }

  list(focus?: ContextFocus): Observable<ContextEntry[]> {
    return this.http.get<ContextEntry[]>(this.base, {
      params: paramsOf(focus),
    });
  }

  advice(focus?: ContextFocus): Observable<ContextDelivery> {
    return this.http.get<ContextDelivery>(`${this.base}/advice`, {
      params: paramsOf(focus),
    });
  }

  retired(focus?: ContextFocus): Observable<ContextEntry[]> {
    return this.http.get<ContextEntry[]>(`${this.base}/archive`, {
      params: paramsOf(focus),
    });
  }

  probes(): Observable<ContextProbeOption[]> {
    return this.http.get<ContextProbeOption[]>(`${this.base}/probes`);
  }

  reach(
    scopeType: ContextScopeType,
    nature: EntryNature,
    scopeRef?: string | null,
  ): Observable<EntryReach> {
    let params = new HttpParams()
      .set('scopeType', scopeType)
      .set('nature', nature);
    if (scopeRef) params = params.set('scopeRef', scopeRef);
    return this.http.get<EntryReach>(`${this.base}/reach`, { params });
  }

  create(entry: WriteContextEntry): Observable<ContextEntry> {
    return this.http.post<ContextEntry>(this.base, entry);
  }

  edit(id: string, edit: EditContextEntry): Observable<ContextEntry> {
    return this.http.patch<ContextEntry>(
      `${this.base}/${encodeURIComponent(id)}`,
      edit,
    );
  }

  confirm(id: string): Observable<ContextEntry> {
    return this.http.post<ContextEntry>(
      `${this.base}/${encodeURIComponent(id)}/confirm`,
      {},
    );
  }

  archive(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${encodeURIComponent(id)}`);
  }
}

function paramsOf(focus?: ContextFocus): HttpParams {
  let params = new HttpParams();
  if (!focus) return params;
  for (const [key, value] of Object.entries(focus)) {
    if (Array.isArray(value)) {
      if (value.length) params = params.set(key, value.join(','));
    } else if (typeof value === 'string' && value.trim()) {
      params = params.set(key, value.trim());
    }
  }
  return params;
}
