import { Injectable, inject, signal } from '@angular/core';
import {
  GithubAppOAuthService,
  PackagesPatStatus,
} from '../../../core/services/github-app-oauth.service';
import { GhcrPatModalMode } from './ghcr-pat-modal.component';
import { RepoToasts } from './repositories-toasts';
import { errorText } from './repositories-format';

@Injectable()
export class RepositoriesPatStore {
  private readonly oauthApi = inject(GithubAppOAuthService);
  private readonly toasts = inject(RepoToasts);

  readonly status = signal<PackagesPatStatus | null>(null);
  readonly modalMode = signal<GhcrPatModalMode | null>(null);
  readonly confirmingRemove = signal(false);
  readonly removing = signal(false);

  async load(): Promise<void> {
    try {
      this.status.set(await this.oauthApi.getPackagesPatStatus());
    } catch {
      this.status.set({ configured: false, status: 'MISSING' });
    }
  }

  async onSaved(): Promise<void> {
    this.modalMode.set(null);
    await this.load();
    this.toasts.show(
      'success',
      'GHCR token updated',
      'Your container registry token has been saved.',
      4000,
    );
  }

  async remove(): Promise<void> {
    this.removing.set(true);
    try {
      await this.oauthApi.deletePackagesPat();
      await this.load();
      this.confirmingRemove.set(false);
      this.toasts.show('success', 'GHCR token removed', '', 4000);
    } catch (err: unknown) {
      this.toasts.show('error', 'Could not remove token', errorText(err, ''), 5000);
    } finally {
      this.removing.set(false);
    }
  }
}
