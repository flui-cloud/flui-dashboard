import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export interface IdentityInstall {
  identityInstallId: string;
  applicationId: string;
  name: string;
  issuer: string | null;
  managed: boolean;
}

export interface IdentityUser {
  id: string;
  username: string;
  email: string | null;
  state: 'active' | 'invited' | 'blocked' | 'locked';
}

export interface AppIdentityLink {
  applicationId: string;
  identityInstallId: string;
  issuer: string;
  clientId: string;
  redirectUris: string[];
  envNames: { issuer: string; clientId: string; clientSecret: string };
}

/** Sign-in for the users of a customer's own apps, on an identity install of theirs. */
@Injectable({ providedIn: 'root' })
export class AppIdentityService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private api(path: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1${path}`;
  }

  installs(): Observable<IdentityInstall[]> {
    return this.http.get<IdentityInstall[]>(this.api('/identity/installs'));
  }

  users(installId: string): Observable<IdentityUser[]> {
    return this.http.get<IdentityUser[]>(
      this.api(`/identity/installs/${encodeURIComponent(installId)}/users`),
    );
  }

  invite(
    installId: string,
    person: { email: string; givenName: string; familyName: string },
  ): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(
      this.api(`/identity/installs/${encodeURIComponent(installId)}/users`),
      person,
    );
  }

  setBlocked(installId: string, userId: string, blocked: boolean): Observable<void> {
    return this.http.post<void>(
      this.api(
        `/identity/installs/${encodeURIComponent(installId)}/users/${encodeURIComponent(userId)}/${blocked ? 'block' : 'unblock'}`,
      ),
      {},
    );
  }

  link(appId: string): Observable<AppIdentityLink | null> {
    return this.http.get<AppIdentityLink | null>(
      this.api(`/applications/${encodeURIComponent(appId)}/identity`),
    );
  }

  connect(
    appId: string,
    body: { identityInstallId: string; redirectPaths: string[] },
  ): Observable<AppIdentityLink> {
    return this.http.put<AppIdentityLink>(
      this.api(`/applications/${encodeURIComponent(appId)}/identity`),
      body,
    );
  }

  disconnect(appId: string): Observable<void> {
    return this.http.delete<void>(this.api(`/applications/${encodeURIComponent(appId)}/identity`));
  }
}
