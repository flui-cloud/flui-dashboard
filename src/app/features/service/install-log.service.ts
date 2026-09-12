import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

/** Downloads the captured install log for an infrastructure operation — see InstallLogService on the API side. */
@Injectable({ providedIn: 'root' })
export class InstallLogService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  download(operationId: string): Observable<Blob> {
    return this.http.get(
      `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/operations/${operationId}/log`,
      { responseType: 'blob' },
    );
  }
}
