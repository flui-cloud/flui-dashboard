import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppConfigService } from '../../core/services/app-config.service';
import { AuditEvent, AuditFilter } from '../model/audit.model';
import { ApiAuditEvent, toAuditEvent, toAuditParams } from './audit.mappers';

/**
 * Stateless on purpose: `email` is masked by the API in mask mode, so whoever
 * holds the rows refetches when mask mode changes.
 */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  list(filter: AuditFilter): Observable<AuditEvent[]> {
    return this.http
      .get<ApiAuditEvent[]>(`${this.appConfig.apiBaseUrl}/api/v1/audit/events`, {
        params: toAuditParams(filter),
      })
      .pipe(map((rows) => rows.map((r) => toAuditEvent(r))));
  }
}
