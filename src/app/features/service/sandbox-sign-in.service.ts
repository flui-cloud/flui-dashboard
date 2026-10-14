import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export type SignInProvider = 'github' | 'google';

export interface SignInProviderStatus {
  provider: SignInProvider;
  name: string;
  connected: boolean;
  source: 'flui' | 'environment' | 'identity-provider' | null;
  clientId: string | null;
  connectedAt: string | null;
  connectedBy: string | null;
  disconnectedAt: string | null;
  onSignInPage: boolean;
}

export interface SignInProviders {
  demo: boolean;
  callbackUrl: string | null;
  intentCallbackUrl?: string | null;
  providers: SignInProviderStatus[];
}

export interface VisitorStats {
  entranceOpen: boolean;
  visitorsNow: number;
  poolReady: number;
  poolMin: number;
  upgraded: number;
  merged: number;
  last24h: {
    created: number;
    refused: number;
    refusedByReason: Array<{ reason: string; count: number }>;
  };
}

/**
 * GitHub and Google sign-in for the demo's guests. The client secret is sent
 * once, in the body of `connect`, to the identity provider; nothing here keeps
 * it, and no response carries it back.
 */
@Injectable({ providedIn: 'root' })
export class SandboxSignInService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private get base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/sandbox/sign-in/providers`;
  }

  list(): Observable<SignInProviders> {
    return this.http.get<SignInProviders>(this.base);
  }

  connect(
    provider: SignInProvider,
    credentials: { clientId: string; clientSecret: string },
  ): Observable<SignInProviderStatus> {
    return this.http.put<SignInProviderStatus>(
      `${this.base}/${encodeURIComponent(provider)}`,
      credentials,
    );
  }

  disconnect(provider: SignInProvider): Observable<SignInProviderStatus> {
    return this.http.delete<SignInProviderStatus>(
      `${this.base}/${encodeURIComponent(provider)}`,
    );
  }

  visitorStats(): Observable<VisitorStats> {
    return this.http.get<VisitorStats>(`${this.appConfig.apiBaseUrl}/api/v1/sandbox/visitors/stats`);
  }
}
