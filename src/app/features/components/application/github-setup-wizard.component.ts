import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import {
  GithubSetupWizardService,
  SetupMethod,
  organizationProblem,
} from '../../service/github-setup-wizard.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlWizardSteps, WizardStep } from '../../../ui/patterns/wizard-steps';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import {
  GithubSetupWizardSurfaceInput,
  GithubSetupWizardSurfaceRevision,
  buildGithubSetupWizardSurface,
  presentedContent,
} from './github-setup-wizard-surface';
import { existingLabel, methodLabel } from './github-setup-helpers';
import { GithubSetupMethodStep } from './github-setup-method-step';
import { GithubSetupAppStep } from './github-setup-app-step';
import { GithubSetupPatStep } from './github-setup-pat-step';

@Component({
  selector: 'app-github-setup-wizard',
  imports: [
    FlPageHeader,
    FlPanel,
    FlWizardSteps,
    FlKeyValue,
    FlKvItem,
    FlButton,
    FlSpinner,
    FlStatus,
    GithubSetupMethodStep,
    GithubSetupAppStep,
    GithubSetupPatStep,
  ],
  template: `
    <div class="fl-page">
      <fl-page-header title="Set up GitHub" [breadcrumb]="breadcrumb">
        <span headerMeta>Connect Flui to GitHub so people can deploy from their repositories.</span>
      </fl-page-header>

      <div class="fl-wizard">
        <nav aria-label="Steps">
          <fl-wizard-steps [steps]="wizardSteps()" [current]="currentStepIndex()" />
        </nav>

        <fl-panel [title]="stepTitle()" [flush]="true">
          <div class="p-4">
            @switch (currentStepIndex()) {
              @case (0) {
                <app-github-setup-method-step
                  [method]="wizardService.selectedMethod()"
                  [configuredLabel]="configuredLabel()"
                  [configuring]="wizardService.isConfiguring()"
                  (methodSelect)="selectMethod($event)"
                  (resetIntegration)="resetIntegration()"
                />
              }
              @case (1) {
                @if (wizardService.selectedMethod() === 'github_app') {
                  <app-github-setup-app-step
                    [manualMode]="manualMode()"
                    [manifest]="wizardService.manifestForm()"
                    [appForm]="wizardService.githubAppForm()"
                    [defaultPublicApiUrl]="defaultPublicApiUrl()"
                    [configuring]="wizardService.isConfiguring()"
                    [error]="wizardService.error()"
                    (manifestChange)="wizardService.updateManifestForm($event)"
                    (appFormChange)="wizardService.updateGitHubAppForm($event)"
                    (toggleManual)="toggleManualMode()"
                  />
                } @else {
                  <app-github-setup-pat-step
                    [token]="wizardService.patForm().token"
                    [validation]="wizardService.patValidation()"
                    [configuring]="wizardService.isConfiguring()"
                    [error]="wizardService.error()"
                    (tokenChange)="wizardService.updatePatForm({ token: $event })"
                    (validate)="onValidatePat()"
                  />
                }
              }
              @case (2) {
                <div class="fl-stack">
                  <fl-status tone="success" label="GitHub integration configured" />
                  <p class="m-0 text-fl-body-sm text-fl-ink-muted">
                    @if (wizardService.selectedMethod() === 'github_app') {
                      The GitHub App is active. People can now install it on their accounts or
                      organizations and import repositories.
                    } @else {
                      The personal access token is saved and ready to use.
                    }
                  </p>
                  <fl-key-value class="fl-kv--compact">
                    <fl-kv-item key="Auth method">{{ methodName() }}</fl-kv-item>
                  </fl-key-value>
                </div>
              }
            }
          </div>

          <div class="fl-wizard__footer border-t border-fl-border px-4 py-3">
            <button flButton="ghost" type="button" (click)="onCancel()">Cancel</button>
            <button
              flButton
              type="button"
              [disabled]="currentStepIndex() === 0"
              (click)="onPrevious()"
            >
              Previous
            </button>
            @if (currentStepIndex() < 2) {
              <button
                flButton="primary"
                type="button"
                [disabled]="!canProceed()"
                (click)="onNext()"
              >
                @if (currentStepIndex() === 1 && wizardService.isConfiguring()) {
                  <fl-spinner label="Saving" />
                }
                Next
              </button>
            } @else {
              <button flButton="primary" type="button" (click)="onCreate()">
                Go to repositories
              </button>
            }
          </div>
        </fl-panel>
      </div>
    </div>
  `,
})
export class GithubSetupWizardComponent implements OnInit, OnDestroy {
  readonly wizardService = inject(GithubSetupWizardService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly confirm = inject(ConfirmService);

  readonly currentStepIndex = signal(0);
  readonly manualMode = signal(false);

  protected readonly breadcrumb: readonly Crumb[] = [
    { label: 'Repositories', link: '/apps/repositories' },
    { label: 'Set up GitHub' },
  ];

  private readonly surfaceRevision = new GithubSetupWizardSurfaceRevision();

  readonly surface = computed(() => {
    const input: GithubSetupWizardSurfaceInput = {
      currentStepIndex: this.currentStepIndex(),
      selectedMethod: this.wizardService.selectedMethod(),
      manualMode: this.manualMode(),
      configuredStatus: this.wizardService.configuredStatus(),
      patValidation: this.wizardService.patValidation(),
      hasError: !!this.wizardService.error(),
    };
    return buildGithubSetupWizardSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  readonly methodName = computed(() => methodLabel(this.wizardService.selectedMethod()));

  readonly configuredLabel = computed(() => existingLabel(this.wizardService.configuredStatus()));

  protected readonly wizardSteps = computed<WizardStep[]>(() => {
    const step = this.currentStepIndex();
    return [
      { name: 'Choose a method', summary: step > 0 ? this.methodName() : undefined },
      { name: 'Configure' },
      { name: 'Done' },
    ];
  });

  protected readonly stepTitle = computed(() => {
    switch (this.currentStepIndex()) {
      case 0:
        return 'Choose a method';
      case 1:
        return this.wizardService.selectedMethod() === 'github_app'
          ? 'Create or connect a GitHub App'
          : 'Validate and save your token';
      default:
        return 'Setup complete';
    }
  });

  protected readonly canProceed = computed(() => {
    if (this.currentStepIndex() === 0) return this.wizardService.selectedMethod() !== null;
    return this.isConfigureStepValid();
  });

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
    const ok = await this.confirm.confirm({
      title: 'Reset the GitHub integration',
      body: 'This removes the current GitHub integration configuration. People lose access to GitHub-backed repositories until you set it up again.',
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (!ok) return;
    const success = await this.wizardService.resetIntegration();
    if (success) {
      this.currentStepIndex.set(0);
      this.manualMode.set(false);
    }
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
      return !organizationProblem(f.organization);
    }
    return false;
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
