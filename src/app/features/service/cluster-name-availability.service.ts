import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export interface NameAvailability {
  available: boolean;
  reason?: string;
}

/**
 * Hand-written HttpClient call rather than the generated API client — same
 * reasoning as ClusterAutoscaleService: a small backend-only endpoint doesn't
 * need a full OpenAPI regen to become reachable from the dashboard.
 */
@Injectable({ providedIn: 'root' })
export class ClusterNameAvailabilityService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private get base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/clusters`;
  }

  async check(name: string, provider: string): Promise<NameAvailability> {
    return firstValueFrom(
      this.http.get<NameAvailability>(`${this.base}/name-availability`, {
        params: { name, provider },
      })
    );
  }
}
