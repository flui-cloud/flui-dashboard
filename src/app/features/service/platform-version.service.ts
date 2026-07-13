import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BASE_PATH } from '../../core/api/variables';

export interface PlatformVersion {
  version: string;
  bootstrapRef: string;
  components: {
    fluiApi: string;
    fluiWeb: string;
    fluiAuthz: string;
  };
}

/**
 * Fetches the running platform version from the core `GET /version` endpoint.
 * Loaded once and cached; consumed by the sidebar version badge.
 */
@Injectable({ providedIn: 'root' })
export class PlatformVersionService {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? '';

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
