import { Component, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideExternalLink, lucideGithub } from '@ng-icons/lucide';
import { GitHubOAuthService } from '../../../core/api/api/gitHubOAuth.service';
import { GitHubSetupStatusResponseDto } from '../../../core/api/model/gitHubSetupStatusResponseDto';
import { GithubAppOAuthService } from '../../../core/services/github-app-oauth.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { InstallPromptService } from '../../../core/services/install-prompt.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { firstValueFrom } from 'rxjs';

const REQUIRED_SCOPES = ['repo', 'write:packages', 'user:email', 'admin:repo_hook', 'workflow'];
const PAT_CREATE_URL = `https://github.com/settings/tokens/new?scopes=${REQUIRED_SCOPES.join(',')}&description=Flui+Deploy`;

interface ScopeCheckResult {
  grantedScopes: string[];
  missingScopes: string[];
}

@Component({
  selector: 'app-github-connect',
  imports: [FormsModule, FlAlert, FlField, FlButton, FlIcon, FlSpinner, FlStatus, FlTag],
  providers: [provideIcons({ lucideArrowRight, lucideExternalLink, lucideGithub })],
  host: { class: 'flex max-w-lg flex-col gap-4' },
  template: `
    @if (authMethod() === 'github_app') {
      <p class="text-fl-ink-secondary">
        Install the Flui GitHub App to build and deploy straight from your repositories. You install
        and authorize it in one step; your repositories and packages are available when you come
        back.
      </p>
      <div>
        <button
          flButton="primary"
          type="button"
          [disabled]="isLoading()"
          (click)="installGithubApp()"
        >
          @if (isLoading()) {
            <fl-spinner label="Redirecting" />
            Redirecting to GitHub…
          } @else {
            <fl-icon name="lucideGithub" />
            Install and authorize Flui
          }
        </button>
      </div>
      @if (error()) {
        <fl-alert tone="error" title="Could not start the installation">{{ error() }}</fl-alert>
      }
    } @else {
      <p class="text-fl-ink-secondary">
        Paste a personal access token to give Flui access to your GitHub repositories.
      </p>

      @if (scopeCheck(); as check) {
        @if (check.missingScopes.length === 0) {
          <fl-status tone="success" label="All required scopes are present" />
        } @else {
          <fl-alert tone="warning" title="Missing scopes">
            Some features may not work with this token.
            <span class="fl-row mt-2">
              @for (scope of requiredScopes; track scope) {
                <fl-status
                  [tone]="check.grantedScopes.includes(scope) ? 'success' : 'error'"
                  [label]="scope"
                />
              }
            </span>
            @if (check.missingScopes.includes('workflow')) {
              <span class="mt-2 block">
                The <span class="fl-mono">workflow</span> scope is needed to commit GitHub Actions
                workflows to your repository.
              </span>
            }
            <ng-container alertActions>
              <a flButton size="sm" [href]="patCreateUrl" target="_blank" rel="noopener noreferrer">
                Regenerate token with all scopes
                <fl-icon name="lucideExternalLink" [size]="14" />
              </a>
              <button flButton size="sm" type="button" (click)="confirmConnected()">
                Continue anyway
                <fl-icon name="lucideArrowRight" [size]="14" />
              </button>
            </ng-container>
          </fl-alert>
        }
      }

      <fl-field label="Personal access token" for="github-connect-pat">
        <div class="fl-input fl-input--lg">
          <input
            id="github-connect-pat"
            type="password"
            autocomplete="off"
            placeholder="ghp_…"
            [ngModel]="patToken()"
            (ngModelChange)="patToken.set($event)"
          />
        </div>
      </fl-field>

      <div class="flex flex-col gap-2">
        <span class="text-fl-caption text-fl-ink-muted">Required scopes (classic token)</span>
        <div class="fl-row">
          @for (scope of requiredScopes; track scope) {
            <fl-tag class="fl-mono">{{ scope }}</fl-tag>
          }
        </div>
        <p class="text-fl-caption text-fl-ink-muted">
          The <span class="fl-mono">workflow</span> scope is needed to commit GitHub Actions
          workflow files to your repository.
        </p>
        <a
          class="fl-link inline-flex items-center gap-1"
          [href]="patCreateUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          Create a classic token with all scopes
          <fl-icon name="lucideExternalLink" [size]="14" />
        </a>
        @if (sandbox.inSandbox() && sandbox.whyFor('repositories'); as trialNote) {
          <p class="text-fl-caption text-fl-ink-muted">{{ trialNote }}</p>
        }
      </div>

      @if (error()) {
        <fl-alert tone="error" title="Could not connect">{{ error() }}</fl-alert>
      }

      <div>
        <button
          flButton="primary"
          type="button"
          [disabled]="isLoading() || !patToken().trim()"
          (click)="connectPat()"
        >
          @if (isLoading()) {
            <fl-spinner label="Connecting" />
            Connecting…
          } @else {
            Connect with token
          }
        </button>
      </div>
    }
  `,
})
export class GithubConnectComponent {
  readonly authMethod = input.required<GitHubSetupStatusResponseDto.AuthMethodEnum>();
  readonly appSlug = input<string>();
  readonly connected = output<{ username: string }>();

  private readonly gitHubOAuthApi = inject(GitHubOAuthService);
  private readonly githubAppOAuth = inject(GithubAppOAuthService);
  protected readonly sandbox = inject(SandboxService);
  private readonly installPrompt = inject(InstallPromptService);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly scopeCheck = signal<ScopeCheckResult | null>(null);
  readonly patToken = signal('');
  private pendingUsername = '';

  readonly requiredScopes = REQUIRED_SCOPES;
  readonly patCreateUrl = PAT_CREATE_URL;

  async installGithubApp(): Promise<void> {
    if (this.installPrompt.requireInstall()) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const response = await this.githubAppOAuth.getInstallUrl();
      if (response.alreadyConnected) {
        this.connected.emit({ username: response.login ?? '' });
        this.isLoading.set(false);
        return;
      }
      if (!response.installUrl) {
        this.error.set('API did not return an install URL. Please retry or contact support.');
        this.isLoading.set(false);
        return;
      }
      globalThis.window.location.href = response.installUrl;
    } catch (err: unknown) {
      this.error.set(
        apiMessage(err) || 'Could not generate the GitHub install link. Please try again.',
      );
      this.isLoading.set(false);
    }
  }

  async connectPat(): Promise<void> {
    if (!this.patToken().trim()) return;
    if (this.installPrompt.requireInstall()) return;

    this.isLoading.set(true);
    this.error.set(null);
    this.scopeCheck.set(null);

    try {
      const response = await firstValueFrom(
        this.gitHubOAuthApi.gitHubOAuthControllerConnectPat({
          personalAccessToken: this.patToken().trim(),
        }),
      );
      this.pendingUsername = response.githubUsername || '';

      await this.checkScopes();

      const check = this.scopeCheck();
      if (!check || check.missingScopes.length === 0) {
        setTimeout(() => this.confirmConnected(), 1500);
      }
    } catch (err: unknown) {
      this.error.set(apiMessage(err) || 'Invalid token. Make sure it has the required scopes.');
    } finally {
      this.isLoading.set(false);
    }
  }

  confirmConnected(): void {
    this.connected.emit({ username: this.pendingUsername });
  }

  private async checkScopes(): Promise<void> {
    try {
      const status = await firstValueFrom(this.gitHubOAuthApi.gitHubOAuthControllerGetStatus());
      const rawScopes = status.scopes ?? '';
      const separator = rawScopes.includes(',') ? ',' : ' ';
      const grantedScopes = rawScopes
        .split(separator)
        .map((s) => s.trim())
        .filter(Boolean);

      const missingScopes = REQUIRED_SCOPES.filter((s) => !grantedScopes.includes(s));
      this.scopeCheck.set({ grantedScopes, missingScopes });
    } catch {
      this.connected.emit({ username: this.pendingUsername });
    }
  }
}

function apiMessage(err: unknown): string | undefined {
  return (err as { error?: { message?: string } } | null)?.error?.message;
}
