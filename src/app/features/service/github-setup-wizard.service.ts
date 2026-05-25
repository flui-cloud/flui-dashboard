import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GitHubSetupService } from '../../core/api/api/gitHubSetup.service';
import { GitHubOAuthService } from '../../core/api/api/gitHubOAuth.service';
import { GitHubSetupStatusResponseDto } from '../../core/api/model/gitHubSetupStatusResponseDto';
import { GitHubAppManifestStartResponseDto } from '../../core/api/model/gitHubAppManifestStartResponseDto';
import { PatValidationResultDto } from '../../core/api/model/patValidationResultDto';

export type SetupMethod = 'pat' | 'github_app' | null;

export interface GitHubAppFormData {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  appSlug: string;
}

export interface ManifestFormData {
  name: string;
  webhooksEnabled: boolean;
  publicApp: boolean;
  publicApiUrl: string;
}

export interface PatFormData {
  token: string;
}

@Injectable({ providedIn: 'root' })
export class GithubSetupWizardService {
  private readonly gitHubSetupApi = inject(GitHubSetupService);
  private readonly gitHubOAuthApi = inject(GitHubOAuthService);

  readonly selectedMethod = signal<SetupMethod>(null);
  readonly githubAppForm = signal<GitHubAppFormData>({
    appId: '',
    privateKey: '',
    webhookSecret: '',
    appSlug: '',
  });
  readonly manifestForm = signal<ManifestFormData>({
    name: '',
    webhooksEnabled: false,
    publicApp: false,
    publicApiUrl: '',
  });
  readonly patForm = signal<PatFormData>({ token: '' });
  readonly patValidation = signal<PatValidationResultDto | null>(null);
  readonly isConfiguring = signal(false);
  readonly error = signal<string | null>(null);
  readonly configuredStatus = signal<GitHubSetupStatusResponseDto | null>(null);

  selectMethod(method: SetupMethod): void {
    this.selectedMethod.set(method);
    this.error.set(null);
  }

  setError(message: string | null): void {
    this.error.set(message);
  }

  updateGitHubAppForm(data: Partial<GitHubAppFormData>): void {
    this.githubAppForm.update((current) => ({ ...current, ...data }));
  }

  updateManifestForm(data: Partial<ManifestFormData>): void {
    this.manifestForm.update((current) => ({ ...current, ...data }));
  }

  updatePatForm(data: Partial<PatFormData>): void {
    this.patForm.update((current) => ({ ...current, ...data }));
    this.patValidation.set(null);
  }

  async startManifest(): Promise<GitHubAppManifestStartResponseDto | null> {
    const form = this.manifestForm();
    if (!form.name.trim()) {
      this.error.set('App name is required.');
      return null;
    }
    if (!form.publicApiUrl.trim()) {
      this.error.set('Flui public URL is required.');
      return null;
    }

    this.isConfiguring.set(true);
    this.error.set(null);
    try {
      return await firstValueFrom(
        this.gitHubSetupApi.gitHubSetupControllerManifestStart({
          name: form.name.trim(),
          webhooksEnabled: form.webhooksEnabled,
          publicApp: form.publicApp,
          publicApiUrl: form.publicApiUrl.trim(),
        }),
      );
    } catch (err: any) {
      this.error.set(
        err?.error?.message ?? 'Failed to start manifest flow.',
      );
      return null;
    } finally {
      this.isConfiguring.set(false);
    }
  }

  async validatePat(): Promise<PatValidationResultDto | null> {
    const token = this.patForm().token.trim();
    if (!token) {
      this.error.set('Paste a token to validate.');
      return null;
    }
    this.isConfiguring.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.gitHubOAuthApi.gitHubOAuthControllerValidatePat({ token }),
      );
      this.patValidation.set(result);
      return result;
    } catch (err: any) {
      this.error.set(
        err?.error?.message ?? 'Failed to validate token against GitHub.',
      );
      return null;
    } finally {
      this.isConfiguring.set(false);
    }
  }

  async configurePat(): Promise<boolean> {
    const token = this.patForm().token.trim();
    if (!token) return false;

    this.isConfiguring.set(true);
    this.error.set(null);
    try {
      const status = await firstValueFrom(
        this.gitHubSetupApi.gitHubSetupControllerConfigurePat(),
      );
      await firstValueFrom(
        this.gitHubOAuthApi.gitHubOAuthControllerConnectPat({
          personalAccessToken: token,
        }),
      );
      this.configuredStatus.set(status);
      return true;
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Failed to save token.');
      return false;
    } finally {
      this.isConfiguring.set(false);
    }
  }

  async configureGitHubApp(): Promise<boolean> {
    const form = this.githubAppForm();
    if (
      !form.appId ||
      !form.privateKey ||
      !form.webhookSecret ||
      !form.appSlug
    ) {
      return false;
    }

    this.isConfiguring.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.gitHubSetupApi.gitHubSetupControllerConfigureGitHubApp({
          appId: form.appId,
          privateKey: form.privateKey,
          webhookSecret: form.webhookSecret,
          appSlug: form.appSlug,
        }),
      );
      this.configuredStatus.set(result);
      return true;
    } catch (err: any) {
      this.error.set(
        err?.error?.message ??
          'Failed to configure GitHub App. Verify your credentials.',
      );
      return false;
    } finally {
      this.isConfiguring.set(false);
    }
  }

  async loadStatus(): Promise<GitHubSetupStatusResponseDto | null> {
    try {
      const status = await firstValueFrom(
        this.gitHubSetupApi.gitHubSetupControllerGetStatus(),
      );
      this.configuredStatus.set(status);
      return status;
    } catch {
      this.configuredStatus.set(null);
      return null;
    }
  }

  async resetIntegration(): Promise<boolean> {
    this.isConfiguring.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.gitHubSetupApi.gitHubSetupControllerResetConfig(),
      );
      this.configuredStatus.set({ configured: false, authMethod: null });
      this.patValidation.set(null);
      return true;
    } catch (err: any) {
      this.error.set(
        err?.error?.message ?? 'Failed to reset GitHub integration.',
      );
      return false;
    } finally {
      this.isConfiguring.set(false);
    }
  }

  reset(): void {
    this.selectedMethod.set(null);
    this.githubAppForm.set({
      appId: '',
      privateKey: '',
      webhookSecret: '',
      appSlug: '',
    });
    this.manifestForm.set({ name: '', webhooksEnabled: false, publicApp: false, publicApiUrl: '' });
    this.patForm.set({ token: '' });
    this.patValidation.set(null);
    this.isConfiguring.set(false);
    this.error.set(null);
    this.configuredStatus.set(null);
  }
}
