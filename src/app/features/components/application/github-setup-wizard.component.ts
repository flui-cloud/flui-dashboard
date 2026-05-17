import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideGithub,
  lucideKey,
  lucideShield,
  lucideCheckCircle,
  lucideChevronLeft,
  lucideChevronRight,
  lucideLoader,
  lucideAlertCircle,
  lucideExternalLink,
  lucideArrowRight,
  lucideStar,
} from '@ng-icons/lucide';
import { WizardShellComponent, WizardStep } from '../../../shared/components/wizard-shell/wizard-shell.component';
import { GithubSetupWizardService, SetupMethod } from '../../service/github-setup-wizard.service';

@Component({
  selector: 'app-github-setup-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, WizardShellComponent],
  providers: [
    provideIcons({
      lucideGithub,
      lucideKey,
      lucideShield,
      lucideCheckCircle,
      lucideChevronLeft,
      lucideChevronRight,
      lucideLoader,
      lucideAlertCircle,
      lucideExternalLink,
      lucideArrowRight,
      lucideStar,
    }),
  ],
  template: `
    <app-wizard-shell
      wizardTitle="GitHub Integration Setup"
      wizardDescription="Configure how users connect their GitHub accounts"
      [steps]="steps()"
      [currentStepIndex]="currentStepIndex()"
      [createButtonText]="createButtonText()"
      (next)="onNext()"
      (previous)="onPrevious()"
      (cancelled)="onCancel()"
      (create)="onCreate()"
    >
      <!-- Step 0: Method Selection -->
      @if (currentStepIndex() === 0) {
        <div class="space-y-4">
          <p class="text-sm text-slate-600 dark:text-slate-400">
            Choose how users will authenticate with GitHub. This is a one-time system configuration.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <!-- GitHub App card (recommended) -->
            <button
              (click)="selectMethod('github_app')"
              [class]="getMethodCardClass('github_app')"
              class="relative flex flex-col items-start text-left p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-md"
            >
              <span class="absolute -top-2.5 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <ng-icon name="lucideStar" size="10" /> Recommended
              </span>
              <div class="flex items-center gap-3 mb-3">
                <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                  <ng-icon name="lucideGithub" size="20" class="text-slate-700 dark:text-slate-300" />
                </div>
                <span class="font-semibold text-sm text-slate-900 dark:text-white">GitHub App</span>
                @if (wizardService.selectedMethod() === 'github_app') {
                  <ng-icon name="lucideCheckCircle" size="16" class="ml-auto text-blue-600 dark:text-blue-400" />
                }
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Install a GitHub App for automatic access. No per-user tokens needed.
              </p>
              <ul class="mt-3 space-y-1">
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-green-500">✓</span> No per-user tokens
                </li>
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-green-500">✓</span> Granular permissions
                </li>
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-green-500">✓</span> Built-in webhooks
                </li>
              </ul>
            </button>

            <!-- OAuth App card -->
            <button
              (click)="selectMethod('oauth_app')"
              [class]="getMethodCardClass('oauth_app')"
              class="flex flex-col items-start text-left p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-md"
            >
              <div class="flex items-center gap-3 mb-3">
                <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                  <ng-icon name="lucideShield" size="20" class="text-slate-700 dark:text-slate-300" />
                </div>
                <span class="font-semibold text-sm text-slate-900 dark:text-white">OAuth App</span>
                @if (wizardService.selectedMethod() === 'oauth_app') {
                  <ng-icon name="lucideCheckCircle" size="16" class="ml-auto text-blue-600 dark:text-blue-400" />
                }
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Users click "Connect with GitHub" and authorize via OAuth. Best for teams.
              </p>
              <ul class="mt-3 space-y-1">
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-green-500">✓</span> One-click user experience
                </li>
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-green-500">✓</span> Automatic token management
                </li>
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-amber-500">△</span> Requires GitHub OAuth App setup
                </li>
              </ul>
            </button>

            <!-- PAT card -->
            <button
              (click)="selectMethod('pat')"
              [class]="getMethodCardClass('pat')"
              class="flex flex-col items-start text-left p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-md"
            >
              <div class="flex items-center gap-3 mb-3">
                <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                  <ng-icon name="lucideKey" size="20" class="text-slate-700 dark:text-slate-300" />
                </div>
                <span class="font-semibold text-sm text-slate-900 dark:text-white">Personal Access Token</span>
                @if (wizardService.selectedMethod() === 'pat') {
                  <ng-icon name="lucideCheckCircle" size="16" class="ml-auto text-blue-600 dark:text-blue-400" />
                }
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Each user generates and pastes their own GitHub PAT. Simpler setup, more control.
              </p>
              <ul class="mt-3 space-y-1">
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-green-500">✓</span> No OAuth App required
                </li>
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-green-500">✓</span> Fine-grained token control
                </li>
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-amber-500">△</span> Users must manage their own tokens
                </li>
              </ul>
            </button>
          </div>
        </div>
      }

      <!-- Step 1: Configuration -->
      @if (currentStepIndex() === 1) {
        @if (wizardService.selectedMethod() === 'github_app') {
          <div class="space-y-5">
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p class="text-xs text-blue-800 dark:text-blue-300 font-medium mb-1">How to create a GitHub App</p>
              <ol class="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                <li>Go to GitHub → Settings → Developer settings → GitHub Apps</li>
                <li>Click "New GitHub App"</li>
                <li>Set permissions: Contents (R/W), Actions (R/W), Workflows (W), Packages (R/W)</li>
                <li>Subscribe to events: Installation, Workflow run</li>
                <li>Generate a Private Key and note the App ID</li>
              </ol>
              <a
                href="https://github.com/settings/apps/new"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Create GitHub App
                <ng-icon name="lucideExternalLink" size="12" />
              </a>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  App ID <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  [ngModel]="wizardService.githubAppForm().appId"
                  (ngModelChange)="wizardService.updateGitHubAppForm({ appId: $event })"
                  placeholder="123456"
                  class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p class="mt-1 text-xs text-slate-400">Found at the top of your GitHub App's settings page</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Private Key (PEM) <span class="text-red-500">*</span>
                </label>
                <textarea
                  [ngModel]="wizardService.githubAppForm().privateKey"
                  (ngModelChange)="wizardService.updateGitHubAppForm({ privateKey: $event })"
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                  rows="4"
                  class="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
                <p class="mt-1 text-xs text-slate-400">Download the .pem file from your GitHub App and paste its content here</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Webhook Secret <span class="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  [ngModel]="wizardService.githubAppForm().webhookSecret"
                  (ngModelChange)="wizardService.updateGitHubAppForm({ webhookSecret: $event })"
                  placeholder="••••••••••••••••••••"
                  class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p class="mt-1 text-xs text-slate-400">The secret you set in the webhook configuration</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  App Slug <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  [ngModel]="wizardService.githubAppForm().appSlug"
                  (ngModelChange)="wizardService.updateGitHubAppForm({ appSlug: $event })"
                  placeholder="flui-cloud"
                  class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p class="mt-1 text-xs text-slate-400">From the app URL: github.com/settings/apps/<strong>your-slug</strong></p>
              </div>
            </div>

            @if (wizardService.isConfiguring()) {
              <div class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <ng-icon name="lucideLoader" size="16" class="text-blue-600 dark:text-blue-400 animate-spin" />
                <p class="text-xs text-blue-700 dark:text-blue-400">Validating credentials with GitHub...</p>
              </div>
            }

            @if (wizardService.error()) {
              <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <ng-icon name="lucideAlertCircle" size="16" class="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p class="text-xs text-red-700 dark:text-red-400">{{ wizardService.error() }}</p>
              </div>
            }
          </div>
        } @else if (wizardService.selectedMethod() === 'oauth_app') {
          <div class="space-y-5">
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p class="text-xs text-blue-800 dark:text-blue-300 font-medium mb-1">How to create a GitHub OAuth App</p>
              <ol class="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                <li>Go to GitHub → Settings → Developer settings → OAuth Apps</li>
                <li>Click "New OAuth App"</li>
                <li>Set Authorization callback URL to the value below</li>
                <li>Copy Client ID and generate a Client Secret</li>
              </ol>
              <a
                href="https://github.com/settings/developers"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open GitHub Developer Settings
                <ng-icon name="lucideExternalLink" size="12" />
              </a>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Client ID <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  [ngModel]="wizardService.oauthForm().clientId"
                  (ngModelChange)="wizardService.updateOAuthForm({ clientId: $event })"
                  placeholder="Iv23liXXXXXXXXXXXXXX"
                  class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Client Secret <span class="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  [ngModel]="wizardService.oauthForm().clientSecret"
                  (ngModelChange)="wizardService.updateOAuthForm({ clientSecret: $event })"
                  placeholder="••••••••••••••••••••"
                  class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Callback URL <span class="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  [ngModel]="wizardService.oauthForm().callbackUrl"
                  (ngModelChange)="wizardService.updateOAuthForm({ callbackUrl: $event })"
                  placeholder="https://your-domain.com/api/v1/repositories/github/callback"
                  class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <p class="mt-1 text-xs text-slate-400">Must match exactly what you set in GitHub OAuth App settings</p>
              </div>
            </div>

            @if (wizardService.isConfiguring()) {
              <div class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <ng-icon name="lucideLoader" size="16" class="text-blue-600 dark:text-blue-400 animate-spin" />
                <p class="text-xs text-blue-700 dark:text-blue-400">Validating credentials...</p>
              </div>
            }

            @if (wizardService.error()) {
              <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <ng-icon name="lucideAlertCircle" size="16" class="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p class="text-xs text-red-700 dark:text-red-400">{{ wizardService.error() }}</p>
              </div>
            }
          </div>
        } @else {
          <!-- PAT mode confirmation -->
          <div class="space-y-4">
            <div class="flex items-start gap-4 p-5 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
              <ng-icon name="lucideCheckCircle" size="24" class="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm font-medium text-green-900 dark:text-green-100">Ready to enable PAT mode</p>
                <p class="text-xs text-green-700 dark:text-green-400 mt-1">
                  No additional configuration needed. Once enabled, each user will be prompted to
                  generate and paste their own Personal Access Token from GitHub.
                </p>
              </div>
            </div>

            <div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p class="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Users will need to create a <strong>classic</strong> PAT with these scopes:</p>
              <div class="flex flex-wrap gap-2">
                @for (scope of ['repo', 'write:packages', 'user:email', 'admin:repo_hook']; track scope) {
                  <span class="px-2 py-1 text-xs font-mono bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded">
                    {{ scope }}
                  </span>
                }
              </div>
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                GitHub Classic Token Settings
                <ng-icon name="lucideExternalLink" size="12" />
              </a>
            </div>

            @if (wizardService.error()) {
              <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <ng-icon name="lucideAlertCircle" size="16" class="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p class="text-xs text-red-700 dark:text-red-400">{{ wizardService.error() }}</p>
              </div>
            }
          </div>
        }
      }

      <!-- Step 2: Done -->
      @if (currentStepIndex() === 2) {
        <div class="flex flex-col items-center py-8 text-center space-y-4">
          <div class="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <ng-icon name="lucideCheckCircle" size="32" class="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">GitHub Integration Configured</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              @if (wizardService.selectedMethod() === 'github_app') {
                GitHub App is active. Repositories are automatically accessible once the app is installed on a GitHub account or organization.
              } @else if (wizardService.selectedMethod() === 'oauth_app') {
                OAuth App is active. Users can now connect their GitHub accounts with one click.
              } @else {
                PAT mode is active. Users will be prompted to paste their Personal Access Token.
              }
            </p>
          </div>
          <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-left w-full max-w-xs">
            <p class="text-xs text-slate-500 dark:text-slate-400">Auth method</p>
            <p class="text-sm font-medium text-slate-900 dark:text-white mt-0.5">
              {{ methodLabel() }}
            </p>
          </div>
        </div>
      }
    </app-wizard-shell>
  `,
})
export class GithubSetupWizardComponent implements OnInit {
  readonly wizardService = inject(GithubSetupWizardService);
  private readonly router = inject(Router);

  readonly currentStepIndex = signal(0);

  readonly methodLabel = computed(() => {
    switch (this.wizardService.selectedMethod()) {
      case 'github_app': return 'GitHub App';
      case 'oauth_app': return 'OAuth App';
      case 'pat': return 'Personal Access Token';
      default: return '—';
    }
  });

  readonly steps = computed<WizardStep[]>(() => {
    const method = this.wizardService.selectedMethod();
    const step = this.currentStepIndex();

    let configDescription: string;
    if (method === 'github_app') configDescription = 'Enter GitHub App credentials';
    else if (method === 'oauth_app') configDescription = 'Enter OAuth App credentials';
    else configDescription = 'Confirm PAT mode';

    let configIcon: string;
    if (method === 'github_app') configIcon = 'lucideGithub';
    else if (method === 'pat') configIcon = 'lucideKey';
    else configIcon = 'lucideShield';

    return [
      {
        id: 'method',
        title: 'Choose Method',
        description: 'GitHub App, OAuth App, or PAT',
        icon: 'lucideGithub',
        isValid: method !== null,
        isCompleted: step > 0,
      },
      {
        id: 'configure',
        title: 'Configure',
        description: configDescription,
        icon: configIcon,
        isValid: this.isConfigureStepValid(),
        isCompleted: step > 1,
      },
      {
        id: 'done',
        title: 'Done',
        description: 'Setup complete',
        icon: 'lucideCheckCircle',
        isValid: true,
        isCompleted: false,
      },
    ];
  });

  readonly createButtonText = computed(() => 'Go to Repositories');

  ngOnInit(): void {
    this.wizardService.reset();
  }

  selectMethod(method: SetupMethod): void {
    this.wizardService.selectMethod(method);
  }

  getMethodCardClass(method: SetupMethod): string {
    const selected = this.wizardService.selectedMethod() === method;
    if (selected) {
      return 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20';
    }
    return 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600';
  }

  isConfigureStepValid(): boolean {
    if (this.wizardService.isConfiguring()) return false;
    const method = this.wizardService.selectedMethod();
    if (method === 'pat') return true;
    if (method === 'oauth_app') {
      const form = this.wizardService.oauthForm();
      return !!(form.clientId && form.clientSecret && form.callbackUrl);
    }
    if (method === 'github_app') {
      const form = this.wizardService.githubAppForm();
      return !!(form.appId && form.privateKey && form.webhookSecret && form.appSlug);
    }
    return false;
  }

  async onNext(): Promise<void> {
    if (this.currentStepIndex() === 1) {
      const method = this.wizardService.selectedMethod();
      let success = false;
      if (method === 'oauth_app') {
        success = await this.wizardService.configureOAuth();
      } else if (method === 'pat') {
        success = await this.wizardService.configurePat();
      } else if (method === 'github_app') {
        success = await this.wizardService.configureGitHubApp();
      }
      if (success) {
        this.currentStepIndex.set(2);
      }
      return;
    }
    this.currentStepIndex.update(i => i + 1);
  }

  onPrevious(): void {
    this.currentStepIndex.update(i => i - 1);
  }

  onCancel(): void {
    this.router.navigate(['/apps/repositories']);
  }

  onCreate(): void {
    this.router.navigate(['/apps/repositories']);
  }
}
