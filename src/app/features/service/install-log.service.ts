import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

/** A piece of a node's install log from a cursor onwards — see `GET /infrastructure/operations/:id/log/chunk`. */
export interface InstallLogChunk {
  operationId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  text: string;
  since: number;
  next: number;
  more: boolean;
  captured: boolean;
  truncated: boolean;
  done: boolean;
  note: string | null;
}

/** The captured install log for an infrastructure operation — see InstallLogService on the API side. */
@Injectable({ providedIn: 'root' })
export class InstallLogService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(operationId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/operations/${encodeURIComponent(operationId)}/log`;
  }

  download(operationId: string): Observable<Blob> {
    return this.http.get(this.base(operationId), { responseType: 'blob' });
  }

  readChunk(operationId: string, since: number): Observable<InstallLogChunk> {
    return this.http.get<InstallLogChunk>(`${this.base(operationId)}/chunk`, {
      params: { since },
    });
  }
}
