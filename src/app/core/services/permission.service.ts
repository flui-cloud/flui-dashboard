import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { AppConfigService } from './app-config.service';

interface MePermissionsResponse {
  permissions: string[];
  isAdmin: boolean;
}

interface MeSectionsResponse {
  sections: string[];
  isAdmin: boolean;
}

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly _permissions = signal<Set<string>>(new Set());
  private readonly _sections = signal<Set<string>>(new Set());
  private readonly _isAdmin = signal(false);
  private readonly _loaded = signal(false);
  private readonly _sectionsLoaded = signal(false);

  readonly permissions = computed(() =>
    Array.from(this._permissions()).sort((a, b) => a.localeCompare(b)),
  );
  readonly sections = computed(() =>
    Array.from(this._sections()).sort((a, b) => a.localeCompare(b)),
  );
  readonly isAdmin = computed(() => this._isAdmin());
  readonly loaded = this._loaded.asReadonly();
  readonly sectionsLoaded = this._sectionsLoaded.asReadonly();

  can(key: string): boolean {
    return this._permissions().has(key);
  }

  hasSection(key: string): boolean {
    return this._isAdmin() || this._sections().has(key);
  }

  load(): void {
    this.http
      .get<MePermissionsResponse>(
        `${this.appConfig.apiBaseUrl}/api/v1/me/permissions`,
      )
      .subscribe({
        next: (res) => {
          this._permissions.set(new Set(res.permissions));
          this._isAdmin.set(res.isAdmin);
          this._loaded.set(true);
        },
        error: () => {
          this._permissions.set(new Set());
          this._loaded.set(true);
        },
      });
    this.loadSections();
  }

  loadSections(): void {
    this.http
      .get<MeSectionsResponse>(
        `${this.appConfig.apiBaseUrl}/api/v1/me/sections`,
      )
      .subscribe({
        next: (res) => {
          this._sections.set(new Set(res.sections));
          this._isAdmin.set(res.isAdmin);
          this._sectionsLoaded.set(true);
        },
        error: () => {
          this._sections.set(new Set());
          this._sectionsLoaded.set(true);
        },
      });
  }
}
