import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export interface PlatformVersion {
  version: string;
  bootstrapRef: string;
  components: {
    fluiApi: string;
    fluiWeb: string;
    fluiAuthz: string;
  };
  /** Absent on an installation older than the field. */
  manifestSpec?: {
    package: string;
    version: string;
    applicationSchemaUrl: string;
  };
}

/**
 * Fetches the running platform version from the core `GET /version` endpoint.
 * Loaded once and cached; consumed by the sidebar version badge and by the
 * deploy wizard, which needs the manifest contract THIS installation enforces
 * rather than the newest one published.
 */
@Injectable({ providedIn: 'root' })
export class PlatformVersionService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  // Read per call: correct only once config.json has loaded.
  private get basePath(): string {
    return this.appConfig.apiBaseUrl;
  }

  private readonly versionData = signal<PlatformVersion | null>(null);
  readonly version = this.versionData.asReadonly();

  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const data = await firstValueFrom(
        this.http.get<PlatformVersion>(`${this.basePath}/api/v1/version`),
      );
      this.versionData.set(data ?? null);
    } catch (error) {
      console.warn('Failed to load platform version', error);
      this.loaded = false; // allow a later retry
    }
  }
}
