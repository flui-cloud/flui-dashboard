import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from './app-config.service';

export interface InstallUrlResponse {
  alreadyConnected: boolean;
  login?: string;
  installUrl?: string;
  state?: string;
}

export type CredentialStatus =
  | 'MISSING'
  | 'VALID'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'INVALID'
  | 'UNKNOWN_EXPIRY';

export interface PackagesPatStatus {
  configured: boolean;
  status?: CredentialStatus;
  expiresAt?: string | null;
  daysUntilExpiry?: number | null;
  lastRotatedAt?: string | null;
  lastVerifiedAt?: string | null;
  githubLogin?: string;
  scopes?: string[];
}

export type CredentialKind = 'GITHUB_APP' | 'GHCR_PAT' | 'PROVIDER';

export interface CredentialItem {
  kind: CredentialKind;
  label: string;
  status: CredentialStatus;
  expiresAt?: string | null;
  daysUntilExpiry?: number | null;
  actionUrl?: string;
  providerId?: string;
}

export interface CredentialsStatusResponse {
  overallStatus: CredentialStatus;
  items: CredentialItem[];
}

@Injectable({ providedIn: 'root' })
export class GithubAppOAuthService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/repositories/github-app`;
  }

  async getInstallUrl(): Promise<InstallUrlResponse> {
    return firstValueFrom(
      this.http.get<InstallUrlResponse>(`${this.base()}/install-url`),
    );
  }

  async getPackagesPatStatus(): Promise<PackagesPatStatus> {
    return firstValueFrom(
      this.http.get<PackagesPatStatus>(`${this.base()}/packages-pat/status`),
    );
  }

  async savePackagesPat(
    token: string,
    expiresAt: string,
  ): Promise<PackagesPatStatus> {
    return firstValueFrom(
      this.http.post<PackagesPatStatus>(`${this.base()}/packages-pat`, {
        token,
        expiresAt,
      }),
    );
  }

  async rotatePackagesPat(
    token: string,
    expiresAt: string,
  ): Promise<PackagesPatStatus> {
    return firstValueFrom(
      this.http.put<PackagesPatStatus>(
        `${this.base()}/packages-pat/rotate`,
        { token, expiresAt },
      ),
    );
  }

  async updatePackagesPatExpiry(expiresAt: string): Promise<PackagesPatStatus> {
    return firstValueFrom(
      this.http.patch<PackagesPatStatus>(
        `${this.base()}/packages-pat/expiry`,
        { expiresAt },
      ),
    );
  }

  async deletePackagesPat(): Promise<void> {
    await firstValueFrom(
      this.http.delete<{ ok: true }>(`${this.base()}/packages-pat`),
    );
  }

  async getCredentialsStatus(): Promise<CredentialsStatusResponse> {
    return firstValueFrom(
      this.http.get<CredentialsStatusResponse>(
        `${this.appConfig.apiBaseUrl}/api/v1/credentials/status`,
      ),
    );
  }
}
