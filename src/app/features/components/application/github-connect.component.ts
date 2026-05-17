import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideGithub,
  lucideKey,
  lucideLoader,
  lucideAlertCircle,
  lucideExternalLink,
  lucideArrowRight,
  lucideCheck,
  lucideX,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { GitHubOAuthService } from '../../../core/api/api/gitHubOAuth.service';
import { GitHubSetupStatusResponseDto } from '../../../core/api/model/gitHubSetupStatusResponseDto';
import { GithubAppOAuthService } from '../../../core/services/github-app-oauth.service';
import { firstValueFrom } from 'rxjs';

const REQUIRED_SCOPES = ['repo', 'write:packages', 'user:email', 'admin:repo_hook', 'workflow'];
const PAT_CREATE_URL = `https://github.com/settings/tokens/new?scopes=${REQUIRED_SCOPES.join(',')}&description=Flui+Deploy`;

interface ScopeCheckResult {
  grantedScopes: string[];
  missingScopes: string[];
}

@Component({
  selector: 'app-github-connect',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideGithub,
      lucideKey,
      lucideLoader,
      lucideAlertCircle,
      lucideExternalLink,
      lucideArrowRight,
      lucideCheck,
      lucideX,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="flex flex-col items-center py-10 px-4 text-center">
      <!-- GitHub logo -->
      <div class="w-16 h-16 rounded-full bg-slate-900 dark:bg-slate-700 flex items-center justify-center mb-6">
        <ng-icon name="lucideGithub" size="32" class="text-white" />
      </div>

      @if (authMethod() === 'github_app') {
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-1">Install Flui on GitHub</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-8">
          Install the Flui GitHub App to automate builds and deployments directly from your repositories.
        </p>
      } @else {
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-1">Connect your GitHub account</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-8">
          @if (authMethod() === 'oauth_app') {
            Authorize Flui to access your GitHub repositories. You'll be redirected to GitHub.
          } @else {
            Paste a Personal Access Token to give Flui access to your GitHub repositories.
          }
        </p>
      }

      @if (authMethod() === 'github_app') {
        <!-- GitHub App install + authorize button -->
        <button
          (click)="installGithubApp()"
          [disabled]="isLoading()"
          class="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          @if (isLoading()) {
            <ng-icon name="lucideLoader" size="16" class="animate-spin" />
            <span>Redirecting to GitHub…</span>
          } @else {
            <ng-icon name="lucideGithub" size="16" />
            <span>Install & Authorize Flui App</span>
          }
        </button>
        <p class="text-xs text-slate-400 dark:text-slate-500 mt-4 max-w-sm">
          You'll install the app and authorize access in one step. After you return,
          your repositories and packages will be available automatically.
        </p>
        @if (error()) {
          <div class="mt-4 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 max-w-sm w-full text-left">
            <ng-icon name="lucideAlertCircle" size="16" class="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p class="text-xs text-red-700 dark:text-red-400">{{ error() }}</p>
          </div>
        }
      } @else if (authMethod() === 'oauth_app') {
        <!-- OAuth connect button -->
        <button
          (click)="connectOAuth()"
          [disabled]="isLoading()"
          class="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          @if (isLoading()) {
            <ng-icon name="lucideLoader" size="16" class="animate-spin" />
            <span>Redirecting...</span>
          } @else {
            <ng-icon name="lucideGithub" size="16" />
            <span>Connect with GitHub</span>
          }
        </button>
      } @else {
        <!-- PAT form -->
        <div class="w-full max-w-sm space-y-4 text-left">

          <!-- Scope check result (shown after connect) -->
          @if (scopeCheck()) {
            @let check = scopeCheck()!;
            @if (check.missingScopes.length === 0) {
              <div class="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <ng-icon name="lucideCheck" size="16" class="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <p class="text-xs text-green-700 dark:text-green-400 font-medium">All required scopes are present. You're good to go!</p>
              </div>
            } @else {
              <div class="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 space-y-2">
                <div class="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                  <ng-icon name="lucideTriangleAlert" size="14" class="flex-shrink-0" />
                  Missing scopes — some features may not work
                </div>
                <div class="flex flex-wrap gap-1.5">
                  @for (scope of requiredScopes; track scope) {
                    <span [class]="getScopeBadgeClass(scope, check.grantedScopes)">
                      <ng-icon [name]="check.grantedScopes.includes(scope) ? 'lucideCheck' : 'lucideX'" size="10" class="flex-shrink-0" />
                      {{ scope }}
                    </span>
                  }
                </div>
                @if (check.missingScopes.includes('workflow')) {
                  <p class="text-xs text-amber-700 dark:text-amber-400">
                    The <span class="font-mono">workflow</span> scope is required to commit GitHub Actions workflows to your repository.
                  </p>
                }
                <a
                  [href]="patCreateUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Regenerate token with all scopes
                  <ng-icon name="lucideExternalLink" size="11" />
                </a>
                <button
                  type="button"
                  (click)="confirmConnected()"
                  class="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  Continue anyway
                  <ng-icon name="lucideArrowRight" size="14" />
                </button>
              </div>
            }
          }

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Personal Access Token
            </label>
            <input
              type="password"
              [(ngModel)]="patToken"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg space-y-2">
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Required scopes (classic token):</p>
            <div class="flex flex-wrap gap-1">
              @for (scope of requiredScopes; track scope) {
                <span class="px-2 py-0.5 text-xs font-mono bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded">
                  {{ scope }}
                </span>
              }
            </div>
            <!-- GHA hint -->
            <div class="flex items-start gap-1.5 pt-1 text-xs text-slate-500 dark:text-slate-400">
              <ng-icon name="lucideGithub" size="12" class="flex-shrink-0 mt-0.5" />
              <span>The <span class="font-mono">workflow</span> scope is needed to commit GitHub Actions workflow files to your repository.</span>
            </div>
            <a
              [href]="patCreateUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Create classic token with all scopes
              <ng-icon name="lucideExternalLink" size="12" />
            </a>
          </div>

          @if (error()) {
            <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <ng-icon name="lucideAlertCircle" size="16" class="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p class="text-xs text-red-700 dark:text-red-400">{{ error() }}</p>
            </div>
          }

          <button
            (click)="connectPat()"
            [disabled]="isLoading() || !patToken.trim()"
            class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            @if (isLoading()) {
              <ng-icon name="lucideLoader" size="16" class="animate-spin" />
              <span>Connecting...</span>
            } @else {
              <ng-icon name="lucideKey" size="16" />
              <span>Connect with Token</span>
            }
          </button>
        </div>
      }

      @if (authMethod() === 'oauth_app' && error()) {
        <div class="mt-4 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 max-w-sm w-full text-left">
          <ng-icon name="lucideAlertCircle" size="16" class="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p class="text-xs text-red-700 dark:text-red-400">{{ error() }}</p>
        </div>
      }
    </div>
  `,
})
export class GithubConnectComponent {
  readonly authMethod = input.required<GitHubSetupStatusResponseDto.AuthMethodEnum>();
  readonly appSlug = input<string>();
  readonly connected = output<{ username: string }>();

  private readonly gitHubOAuthApi = inject(GitHubOAuthService);
  private readonly githubAppOAuth = inject(GithubAppOAuthService);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly scopeCheck = signal<ScopeCheckResult | null>(null);
  patToken = '';
  private pendingUsername = '';

  readonly requiredScopes = REQUIRED_SCOPES;
  readonly patCreateUrl = PAT_CREATE_URL;

  async installGithubApp(): Promise<void> {
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
        this.error.set(
          'API did not return an install URL. Please retry or contact support.',
        );
        this.isLoading.set(false);
        return;
      }
      globalThis.window.location.href = response.installUrl;
    } catch (err: any) {
      this.error.set(
        err?.error?.message ||
          'Could not generate the GitHub install link. Please try again.',
      );
      this.isLoading.set(false);
    }
  }

  async connectOAuth(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.gitHubOAuthApi.gitHubOAuthControllerConnect()
      );
      globalThis.window.location.href = response.url;
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Failed to initiate GitHub connection. Please try again.');
      this.isLoading.set(false);
    }
  }

  async connectPat(): Promise<void> {
    if (!this.patToken.trim()) return;

    this.isLoading.set(true);
    this.error.set(null);
    this.scopeCheck.set(null);

    try {
      const response = await firstValueFrom(
        this.gitHubOAuthApi.gitHubOAuthControllerConnectPat({
          personalAccessToken: this.patToken.trim(),
        })
      );
      this.pendingUsername = response.githubUsername || '';

      // Check scopes — show result before emitting connected
      await this.checkScopes();

      // If all scopes ok: auto-proceed after short delay so user sees the green banner
      const check = this.scopeCheck();
      if (!check || check.missingScopes.length === 0) {
        setTimeout(() => this.confirmConnected(), 1500);
      }
      // If scopes missing: wait for user to click "Continue anyway"
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Invalid token. Make sure it has the required scopes.');
    } finally {
      this.isLoading.set(false);
    }
  }

  confirmConnected(): void {
    this.connected.emit({ username: this.pendingUsername });
  }

  private async checkScopes(): Promise<void> {
    try {
      const status = await firstValueFrom(
        this.gitHubOAuthApi.gitHubOAuthControllerGetStatus()
      );
      const rawScopes = status.scopes ?? '';
      // GitHub returns scopes comma-separated; some backends store them space-separated
      const separator = rawScopes.includes(',') ? ',' : ' ';
      const grantedScopes = rawScopes.split(separator).map(s => s.trim()).filter(Boolean);

      const missingScopes = REQUIRED_SCOPES.filter(s => !grantedScopes.includes(s));
      this.scopeCheck.set({ grantedScopes, missingScopes });
    } catch {
      // Scope check best-effort: if it fails, proceed normally
      this.connected.emit({ username: this.pendingUsername });
    }
  }

  getScopeBadgeClass(scope: string, grantedScopes: string[]): string {
    const has = grantedScopes.includes(scope);
    const base = 'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded';
    return has
      ? `${base} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`
      : `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`;
  }
}
