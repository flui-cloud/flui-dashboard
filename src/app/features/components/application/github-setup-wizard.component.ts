import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideGithub,
  lucideKey,
  lucideCheckCircle,
  lucideLoader,
  lucideAlertCircle,
  lucideExternalLink,
  lucideStar,
  lucideChevronDown,
  lucideChevronRight,
} from '@ng-icons/lucide';
import { environment } from '../../../../environments/environment';
import {
  WizardShellComponent,
  WizardStep,
} from '../../../shared/components/wizard-shell/wizard-shell.component';
import {
  GithubSetupWizardService,
  SetupMethod,
} from '../../service/github-setup-wizard.service';

const PAT_DEEP_LINK =
  'https://github.com/settings/tokens/new' +
  '?scopes=repo,workflow,user:email,admin:repo_hook,write:packages,read:packages,delete:packages' +
  '&description=Flui';

@Component({
  selector: 'app-github-setup-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, WizardShellComponent],
  providers: [
    provideIcons({
      lucideGithub,
      lucideKey,
      lucideCheckCircle,
      lucideLoader,
      lucideAlertCircle,
      lucideExternalLink,
      lucideStar,
      lucideChevronDown,
      lucideChevronRight,
    }),
  ],
  template: `
    <app-wizard-shell
      wizardTitle="GitHub Integration Setup"
      wizardDescription="Connect Flui to GitHub so users can deploy from their repositories"
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
          @if (wizardService.configuredStatus()?.configured) {
            <div class="flex items-start gap-3 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
              <ng-icon name="lucideAlertCircle" size="20" class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-amber-900 dark:text-amber-200">
                  GitHub is already configured
                </p>
                <p class="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                  Active: <span class="font-mono">{{ existingLabel() }}</span>. Configuring a new method overwrites the current setup. To remove the integration entirely, click Reset.
                </p>
              </div>
              <button
                type="button"
                (click)="resetIntegration()"
                [disabled]="wizardService.isConfiguring()"
                class="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50"
              >
                @if (wizardService.isConfiguring()) {
                  <ng-icon name="lucideLoader" size="12" class="animate-spin" />
                }
                Reset
              </button>
            </div>
          }

          <p class="text-sm text-slate-600 dark:text-slate-400">
            Choose how Flui connects to GitHub. This is a one-time system configuration.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
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
                Create a GitHub App with one click. Works for personal and org repos, integrates webhooks, no per-user tokens.
              </p>
              <ul class="mt-3 space-y-1">
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-green-500">✓</span> Works for any account or org
                </li>
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-green-500">✓</span> Auto webhooks for deploy-on-push
                </li>
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-green-500">✓</span> Bot identity, no token rotation
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
                Single-user / advanced. One classic PAT covers both repository access and GHCR container pulls. No App registration required.
              </p>
              <ul class="mt-3 space-y-1">
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-green-500">✓</span> Fastest setup for solo dev
                </li>
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-amber-500">△</span> Org PAT policies may block
                </li>
                <li class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-amber-500">△</span> Token expires &amp; must be rotated
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
            @if (!manualMode()) {
              <!-- Manifest flow (default) -->
              <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p class="text-xs text-blue-800 dark:text-blue-300">
                  We'll redirect you to GitHub with the App configuration pre-filled.
                  Confirm there and you'll come back here with everything connected.
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  App name <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  [ngModel]="wizardService.manifestForm().name"
                  (ngModelChange)="wizardService.updateManifestForm({ name: $event })"
                  placeholder="flui-acme"
                  class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p class="mt-1 text-xs text-slate-400">Must be unique across GitHub. Pick something descriptive (your company or instance).</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Flui public URL <span class="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  [ngModel]="wizardService.manifestForm().publicApiUrl"
                  (ngModelChange)="wizardService.updateManifestForm({ publicApiUrl: $event })"
                  [placeholder]="defaultPublicApiUrl()"
                  class="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Base URL where this Flui API is reachable. The OAuth callback, the manifest callback and (if webhooks are on) the webhook URL are all derived from this.
                </p>
                @if (derivedUrls(); as urls) {
                  <div class="mt-2 p-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-1.5">
                    <p class="text-xs font-medium text-slate-700 dark:text-slate-300">GitHub will be configured with:</p>
                    <p class="text-xs font-mono text-slate-600 dark:text-slate-400 break-all">
                      <span class="text-slate-500 dark:text-slate-500">OAuth callback:</span> {{ urls.callback }}
                    </p>
                    <p class="text-xs font-mono text-slate-600 dark:text-slate-400 break-all">
                      <span class="text-slate-500 dark:text-slate-500">Manifest redirect:</span> {{ urls.redirect }}
                    </p>
                    @if (wizardService.manifestForm().webhooksEnabled) {
                      <p class="text-xs font-mono text-slate-600 dark:text-slate-400 break-all">
                        <span class="text-slate-500 dark:text-slate-500">Webhook:</span> {{ urls.webhook }}
                      </p>
                    }
                  </div>
                }
                @if (isLocalPublicApiUrl()) {
                  <div class="mt-2 flex items-start gap-2 p-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                    <ng-icon name="lucideAlertCircle" size="14" class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p class="text-xs text-amber-800 dark:text-amber-300">
                      This URL points to localhost — GitHub won't be able to reach the webhook (if enabled) nor complete the user-authorization redirect from a different machine. In development, expose your API through a tunnel and paste the tunnel's public URL here.
                    </p>
                  </div>
                }
              </div>

              <label class="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  [ngModel]="wizardService.manifestForm().webhooksEnabled"
                  (ngModelChange)="wizardService.updateManifestForm({ webhooksEnabled: $event })"
                  class="mt-1"
                />
                <span class="text-sm text-slate-700 dark:text-slate-300">
                  Enable webhooks for deploy-on-push
                  <span class="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Needs the Flui public URL above to be reachable from github.com.
                  </span>
                </span>
              </label>

              <label class="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  [ngModel]="wizardService.manifestForm().publicApp"
                  (ngModelChange)="wizardService.updateManifestForm({ publicApp: $event })"
                  class="mt-1"
                />
                <span class="text-sm text-slate-700 dark:text-slate-300">
                  Allow installation on other accounts / organizations
                  <span class="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Off (default): only the account that owns the App can install it. Turn on if you need to access repos under accounts or organizations different from the one creating the App.
                  </span>
                </span>
              </label>

              <button
                type="button"
                (click)="toggleManualMode()"
                class="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <ng-icon name="lucideChevronRight" size="12" />
                I already have a GitHub App
              </button>
            } @else {
              <!-- Manual mode (existing App) -->
              <div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p class="text-xs text-amber-800 dark:text-amber-300">
                  Paste credentials from your existing GitHub App. Prefer the guided flow above for new installations.
                </p>
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
                </div>
              </div>

              <button
                type="button"
                (click)="toggleManualMode()"
                class="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <ng-icon name="lucideChevronDown" size="12" />
                Back to guided flow
              </button>
            }

            @if (wizardService.isConfiguring()) {
              <div class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <ng-icon name="lucideLoader" size="16" class="text-blue-600 dark:text-blue-400 animate-spin" />
                <p class="text-xs text-blue-700 dark:text-blue-400">{{ manualMode() ? 'Validating credentials with GitHub…' : 'Preparing manifest and redirecting to GitHub…' }}</p>
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
          <!-- PAT mode -->
          <div class="space-y-5">
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p class="text-xs text-blue-800 dark:text-blue-300 mb-2">
                Open GitHub with the required scopes pre-selected, generate a classic PAT, then paste it back here. We'll validate it before saving. This single token covers cloning private repos, registering webhooks, and pulling images from GHCR.
              </p>
              <a
                [href]="patDeepLink"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Create a token on GitHub
                <ng-icon name="lucideExternalLink" size="12" />
              </a>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Personal Access Token <span class="text-red-500">*</span>
              </label>
              <input
                type="password"
                autocomplete="off"
                [ngModel]="wizardService.patForm().token"
                (ngModelChange)="wizardService.updatePatForm({ token: $event })"
                placeholder="ghp_••••••••••••••••••••"
                class="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                [disabled]="!wizardService.patForm().token || wizardService.isConfiguring()"
                (click)="onValidatePat()"
                class="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                @if (wizardService.isConfiguring()) {
                  <ng-icon name="lucideLoader" size="12" class="animate-spin" />
                }
                Validate
              </button>
            </div>

            @if (wizardService.patValidation(); as v) {
              @if (v.valid && (v.missingScopes?.length ?? 0) === 0) {
                <div class="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <ng-icon name="lucideCheckCircle" size="16" class="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div class="text-xs text-green-800 dark:text-green-300">
                    <p>Authenticated as <strong>&#64;{{ v.login }}</strong>.</p>
                    <p class="mt-0.5">Scopes: <span class="font-mono">{{ (v.scopes ?? []).join(', ') }}</span></p>
                  </div>
                </div>
              } @else if (v.valid) {
                <div class="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <ng-icon name="lucideAlertCircle" size="16" class="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div class="text-xs text-amber-800 dark:text-amber-300">
                    <p>Authenticated as <strong>&#64;{{ v.login }}</strong>, but the token is missing scopes:</p>
                    <p class="mt-0.5 font-mono">{{ (v.missingScopes ?? []).join(', ') }}</p>
                    <p class="mt-1">Re-create the token with these scopes checked, otherwise webhooks / packages won't work.</p>
                  </div>
                </div>
              } @else {
                <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <ng-icon name="lucideAlertCircle" size="16" class="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p class="text-xs text-red-700 dark:text-red-400">{{ patErrorLabel(v.error, v.message) }}</p>
                </div>
              }
            }

            <p class="text-xs text-slate-500 dark:text-slate-400">
              Using <strong>classic</strong> PATs. Fine-grained PATs are not supported yet because they can't grant <span class="font-mono">admin:repo_hook</span>, required to register webhooks.
            </p>

            @if (wizardService.error() && !wizardService.patValidation()) {
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
                GitHub App is active. Users can now install it on their accounts or organizations and start importing repositories.
              } @else {
                PAT mode is active. Your Personal Access Token is saved and ready to use.
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
  private readonly route = inject(ActivatedRoute);

  readonly currentStepIndex = signal(0);
  readonly manualMode = signal(false);
  readonly patDeepLink = PAT_DEEP_LINK;

  readonly methodLabel = computed(() => {
    switch (this.wizardService.selectedMethod()) {
      case 'github_app':
        return 'GitHub App';
      case 'pat':
        return 'Personal Access Token';
      default:
        return '—';
    }
  });

  readonly steps = computed<WizardStep[]>(() => {
    const method = this.wizardService.selectedMethod();
    const step = this.currentStepIndex();

    const configDescription =
      method === 'github_app' ? 'Create or connect a GitHub App' : 'Validate and save your PAT';
    const configIcon = method === 'pat' ? 'lucideKey' : 'lucideGithub';

    return [
      {
        id: 'method',
        title: 'Choose Method',
        description: 'GitHub App or PAT',
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
    this.wizardService.updateManifestForm({
      publicApiUrl: this.defaultPublicApiUrl(),
    });
    void this.wizardService.loadStatus();
    const params = this.route.snapshot.queryParamMap;
    const manifest = params.get('manifest');
    if (manifest === 'success') {
      this.wizardService.selectMethod('github_app');
      this.currentStepIndex.set(2);
    } else if (manifest === 'error') {
      this.wizardService.selectMethod('github_app');
      const reason = params.get('reason') ?? 'unknown';
      this.wizardService.setError(`GitHub App creation failed: ${reason}`);
    }
  }

  async resetIntegration(): Promise<void> {
    if (this.wizardService.isConfiguring()) return;
    const ok = globalThis.confirm(
      'This removes the current GitHub integration configuration. Users will lose access to GitHub-backed repositories until you reconfigure. Proceed?',
    );
    if (!ok) return;
    const success = await this.wizardService.resetIntegration();
    if (success) {
      this.currentStepIndex.set(0);
      this.manualMode.set(false);
    }
  }

  existingLabel(): string {
    const s = this.wizardService.configuredStatus();
    if (!s?.configured) return '';
    const mode = s.authMethod === 'github_app' ? 'GitHub App' : 'Personal Access Token';
    return s.appSlug ? `${mode} — ${s.appSlug}` : mode;
  }

  selectMethod(method: SetupMethod): void {
    this.wizardService.selectMethod(method);
  }

  toggleManualMode(): void {
    this.manualMode.update((v) => !v);
  }

  defaultPublicApiUrl(): string {
    return environment.apiBaseUrl.replace(/\/$/, '');
  }

  isLocalPublicApiUrl(): boolean {
    const url = this.wizardService.manifestForm().publicApiUrl.trim();
    if (!url) return false;
    return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(url);
  }

  derivedUrls(): { callback: string; redirect: string; webhook: string } | null {
    const raw = this.wizardService.manifestForm().publicApiUrl.trim();
    if (!raw || !/^https?:\/\//i.test(raw)) return null;
    const base = raw.replace(/\/$/, '');
    return {
      callback: `${base}/api/v1/repositories/github-app/user-callback`,
      redirect: `${base}/api/v1/repositories/github/setup/github-app/manifest-callback`,
      webhook: `${base}/api/v1/webhooks/github-app`,
    };
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
    if (method === 'pat') {
      const v = this.wizardService.patValidation();
      return !!v?.valid;
    }
    if (method === 'github_app') {
      if (this.manualMode()) {
        const form = this.wizardService.githubAppForm();
        return !!(form.appId && form.privateKey && form.webhookSecret && form.appSlug);
      }
      const f = this.wizardService.manifestForm();
      if (!f.name.trim()) return false;
      if (!f.publicApiUrl.trim()) return false;
      return true;
    }
    return false;
  }

  patErrorLabel(error?: string, message?: string): string {
    switch (error) {
      case 'invalid_token':
        return 'Invalid token — GitHub rejected it (401).';
      case 'sso_required':
        return 'This token needs SSO authorization for one of your organizations. Authorize it on GitHub and try again.';
      case 'empty_token':
        return 'Paste a token to validate.';
      case 'github_unreachable':
        return `Could not reach GitHub: ${message ?? 'unknown error'}`;
      default: {
        const suffix = message ? `: ${message}` : '.';
        return `Token validation failed${suffix}`;
      }
    }
  }

  async onValidatePat(): Promise<void> {
    await this.wizardService.validatePat();
  }

  async onNext(): Promise<void> {
    if (this.currentStepIndex() === 1) {
      const method = this.wizardService.selectedMethod();
      if (method === 'pat') {
        const ok = await this.wizardService.configurePat();
        if (ok) this.currentStepIndex.set(2);
        return;
      }
      if (method === 'github_app') {
        if (this.manualMode()) {
          const ok = await this.wizardService.configureGitHubApp();
          if (ok) this.currentStepIndex.set(2);
          return;
        }
        await this.startManifestRedirect();
        return;
      }
      return;
    }
    this.currentStepIndex.update((i) => i + 1);
  }

  private async startManifestRedirect(): Promise<void> {
    const result = await this.wizardService.startManifest();
    if (!result) return;

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = result.githubUrl;
    form.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'manifest';
    input.value = JSON.stringify(result.manifestJson);
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
  }

  onPrevious(): void {
    this.currentStepIndex.update((i) => i - 1);
  }

  onCancel(): void {
    this.router.navigate(['/apps/repositories']);
  }

  onCreate(): void {
    this.router.navigate(['/apps/repositories']);
  }
}
