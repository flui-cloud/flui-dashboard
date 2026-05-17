import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GitHubSetupService } from '../../core/api/api/gitHubSetup.service';
import { GitHubSetupStatusResponseDto } from '../../core/api/model/gitHubSetupStatusResponseDto';

export type SetupMethod = 'oauth_app' | 'pat' | 'github_app' | null;

export interface OAuthFormData {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export interface GitHubAppFormData {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  appSlug: string;
}

@Injectable({ providedIn: 'root' })
export class GithubSetupWizardService {
  private readonly gitHubSetupApi = inject(GitHubSetupService);

  // State signals
  readonly selectedMethod = signal<SetupMethod>(null);
  readonly oauthForm = signal<OAuthFormData>({ clientId: '', clientSecret: '', callbackUrl: '' });
  readonly githubAppForm = signal<GitHubAppFormData>({ appId: '', privateKey: '', webhookSecret: '', appSlug: '' });
  readonly isConfiguring = signal(false);
  readonly error = signal<string | null>(null);
  readonly configuredStatus = signal<GitHubSetupStatusResponseDto | null>(null);

  selectMethod(method: SetupMethod): void {
    this.selectedMethod.set(method);
    this.error.set(null);
  }

  updateOAuthForm(data: Partial<OAuthFormData>): void {
    this.oauthForm.update(current => ({ ...current, ...data }));
  }

  updateGitHubAppForm(data: Partial<GitHubAppFormData>): void {
    this.githubAppForm.update(current => ({ ...current, ...data }));
  }

  async configureOAuth(): Promise<boolean> {
    const form = this.oauthForm();
    if (!form.clientId || !form.clientSecret || !form.callbackUrl) return false;

    this.isConfiguring.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.gitHubSetupApi.gitHubSetupControllerConfigureOAuth({
          clientId: form.clientId,
          clientSecret: form.clientSecret,
          callbackUrl: form.callbackUrl,
        })
      );
      this.configuredStatus.set(result);
      return true;
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Failed to configure OAuth App. Check your credentials.');
      return false;
    } finally {
      this.isConfiguring.set(false);
    }
  }

  async configurePat(): Promise<boolean> {
    this.isConfiguring.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.gitHubSetupApi.gitHubSetupControllerConfigurePat()
      );
      this.configuredStatus.set(result);
      return true;
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Failed to enable PAT mode.');
      return false;
    } finally {
      this.isConfiguring.set(false);
    }
  }

  async configureGitHubApp(): Promise<boolean> {
    const form = this.githubAppForm();
    if (!form.appId || !form.privateKey || !form.webhookSecret || !form.appSlug) return false;

    this.isConfiguring.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(
        this.gitHubSetupApi.gitHubSetupControllerConfigureGitHubApp({
          appId: form.appId,
          privateKey: form.privateKey,
          webhookSecret: form.webhookSecret,
          appSlug: form.appSlug,
        })
      );
      this.configuredStatus.set(result);
      return true;
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Failed to configure GitHub App. Verify your credentials.');
      return false;
    } finally {
      this.isConfiguring.set(false);
    }
  }

  reset(): void {
    this.selectedMethod.set(null);
    this.oauthForm.set({ clientId: '', clientSecret: '', callbackUrl: '' });
    this.githubAppForm.set({ appId: '', privateKey: '', webhookSecret: '', appSlug: '' });
    this.isConfiguring.set(false);
    this.error.set(null);
    this.configuredStatus.set(null);
  }
}
