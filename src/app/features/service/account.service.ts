import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export interface AccountFactor {
  id: string;
  name: string;
  ready: boolean;
}

export interface AccountLink {
  idpId: string;
  provider: string;
  externalUserId: string;
  externalUserName: string;
}

export interface AccountProfile {
  userName: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

export interface AccountOverview {
  profile: AccountProfile;
  security: {
    password: boolean;
    totp: boolean;
    passkeys: AccountFactor[];
    securityKeys: AccountFactor[];
    links: AccountLink[];
  };
  limits: { guest: boolean; canUnlink: boolean };
}

export interface PasswordPolicy {
  minLength: number;
  requirements: Array<{ rule: string; label: string }>;
}

export interface TotpRegistration {
  uri: string;
  secret: string;
}

/** The signed-in person's own account at the identity provider. No call names a user. */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private get base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/account`;
  }

  overview(): Observable<AccountOverview> {
    return this.http.get<AccountOverview>(this.base);
  }

  updateProfile(change: {
    firstName: string;
    lastName: string;
    displayName?: string;
  }): Observable<AccountProfile> {
    return this.http.put<AccountProfile>(`${this.base}/profile`, change);
  }

  passwordPolicy(): Observable<PasswordPolicy> {
    return this.http.get<PasswordPolicy>(`${this.base}/password-policy`);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<unknown> {
    return this.http.post(`${this.base}/password`, { currentPassword, newPassword });
  }

  startTotp(currentPassword?: string): Observable<TotpRegistration> {
    return this.http.post<TotpRegistration>(`${this.base}/totp`, currentPassword ? { currentPassword } : {});
  }

  verifyTotp(code: string): Observable<unknown> {
    return this.http.post(`${this.base}/totp/verify`, { code });
  }

  removeTotp(currentPassword: string): Observable<unknown> {
    return this.http.delete(`${this.base}/totp`, { body: { currentPassword } });
  }

  removePasskey(id: string, currentPassword: string): Observable<unknown> {
    return this.http.delete(`${this.base}/passkeys/${encodeURIComponent(id)}`, {
      body: { currentPassword },
    });
  }

  removeSecurityKey(id: string, currentPassword: string): Observable<unknown> {
    return this.http.delete(`${this.base}/security-keys/${encodeURIComponent(id)}`, {
      body: { currentPassword },
    });
  }

  unlink(link: AccountLink, currentPassword: string): Observable<unknown> {
    return this.http.delete(
      `${this.base}/links/${encodeURIComponent(link.idpId)}/${encodeURIComponent(link.externalUserId)}`,
      { body: { currentPassword } },
    );
  }
}

/** The API's own sentence when it sent one, otherwise the fallback. */
export function accountErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { error?: { message?: unknown } })?.error?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return fallback;
}
