import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, map, catchError, switchMap, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AppConfig, CertificateMode } from '../model/app-config.model';

interface RawConfig {
  apiBaseUrl?: string;
  wsUrl?: string;
  authMode?: 'local' | 'oidc';
  oidcIssuer?: string;
  oidcClientId?: string;
  certificateMode?: string;
}

interface ApiAuthConfig {
  authMode?: string;
  issuer?: string;
  clientId?: string;
  cliClientId?: string;
}

const VALID_CERT_MODES: ReadonlySet<CertificateMode> = new Set(['staging', 'preflight', 'production']);

@Injectable({
  providedIn: 'root',
})
export class AppConfigService {
  private readonly http = inject(HttpClient);

  private readonly config: AppConfig = {
    apiBaseUrl: environment.apiBaseUrl,
    wsUrl: environment.wsUrl,
    authMode: 'local',
    oidcIssuer: '',
    oidcClientId: '',
    certificateMode: 'production',
  };

  load(): Observable<void> {
    return this.http.get<RawConfig>('/assets/config.json').pipe(
      catchError(() => of({} as RawConfig)),
      tap((raw) => {
        if (raw.apiBaseUrl) {
          this.config.apiBaseUrl = raw.apiBaseUrl;
          // If wsUrl is not explicitly provided, derive it from apiBaseUrl
          if (!raw.wsUrl) {
            this.config.wsUrl = raw.apiBaseUrl;
          }
        }
        if (raw.wsUrl) {
          this.config.wsUrl = raw.wsUrl;
        }
        if (raw.authMode) {
          this.config.authMode = raw.authMode;
        }
        if (raw.oidcIssuer !== undefined) {
          this.config.oidcIssuer = raw.oidcIssuer;
        }
        if (raw.oidcClientId !== undefined) {
          this.config.oidcClientId = raw.oidcClientId;
        }
        if (raw.certificateMode && VALID_CERT_MODES.has(raw.certificateMode as CertificateMode)) {
          this.config.certificateMode = raw.certificateMode as CertificateMode;
        }
      }),
      switchMap(() => this.ensureOidcClientId()),
      map(() => void 0),
    );
  }

  /** flui-web's config.json (frozen subPath) can serve an empty client id —
   *  fall back to the API's public auth config so OIDC sign-in still works. */
  private ensureOidcClientId(): Observable<void> {
    if (this.config.authMode !== 'oidc' || this.config.oidcClientId) {
      return of(void 0);
    }
    return this.http
      .get<ApiAuthConfig>(`${this.config.apiBaseUrl}/api/v1/auth/config`)
      .pipe(
        timeout(5000),
        tap((api) => {
          if (api?.clientId) {
            this.config.oidcClientId = api.clientId;
          }
          if (!this.config.oidcIssuer && api?.issuer) {
            this.config.oidcIssuer = api.issuer;
          }
        }),
        map(() => void 0),
        catchError(() => of(void 0)),
      );
  }

  get(): AppConfig {
    return this.config;
  }

  get apiBaseUrl(): string {
    return this.config.apiBaseUrl;
  }

  get wsUrl(): string {
    return this.config.wsUrl;
  }

  get authMode(): 'local' | 'oidc' {
    return this.config.authMode;
  }

  get oidcIssuer(): string {
    return this.config.oidcIssuer;
  }

  get oidcClientId(): string {
    return this.config.oidcClientId;
  }

  get certificateMode(): CertificateMode {
    return this.config.certificateMode;
  }
}
