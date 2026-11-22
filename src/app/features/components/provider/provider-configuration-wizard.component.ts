import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProvidersService } from '../../service/providers.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { ProviderMarkComponent } from '../../../shared/components/provider-mark.component';
import {
  ProviderConfigurationDto,
  ProviderCredentialsDto,
  ProviderDefinitionDto,
} from '../../../core/api';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlWizardSteps, WizardStep as KitWizardStep } from '../../../ui/patterns/wizard-steps';
import { FlButton } from '../../../ui/primitives/button';
import {
  CredentialFieldDefinition,
  GET_FLUI_RUNNING_URL,
  credentialKind,
  credentialSchema,
} from './provider-presentation';
import { fallbackCredentialFields } from './provider-credentials';
import { ProviderWizardCredentials } from './provider-wizard-credentials';
import { ProviderWizardCheck, ValidationStatus, WizardRegion } from './provider-wizard-check';
import { ProviderWizardRegions } from './provider-wizard-regions';

interface ConnectStep {
  id: string;
  title: string;
  description: string;
  isValid: boolean;
  isCompleted: boolean;
}

export interface ConfigurationResult {
  success: boolean;
  configuration?: ProviderConfigurationDto;
  error?: string;
}

@Component({
  selector: 'provider-configuration-wizard',
  imports: [
    ProviderMarkComponent,
    FlPanel,
    FlAlert,
    FlWizardSteps,
    FlButton,
    ProviderWizardCredentials,
    ProviderWizardCheck,
    ProviderWizardRegions,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { class: 'fl-stack' },
  template: `
    <div class="fl-pagehead">
      <div class="fl-pagehead__main">
        <div class="fl-pagehead__line">
          <app-provider-mark [name]="provider().displayName" [size]="28" />
          <h1 class="fl-pagehead__title">Connect {{ provider().displayName }}</h1>
        </div>
        <div class="fl-pagehead__meta">{{ provider().description }}</div>
      </div>
      <div class="fl-pagehead__actions">
        <button flButton="ghost" type="button" (click)="cancelled.emit()">Back to providers</button>
      </div>
    </div>

    @if (demoFinished()) {
      <fl-alert
        tone="info"
        title="In the demo, nothing is connected."
        data-testid="wizard-demo-end"
      >
        Install Flui to connect your {{ provider().displayName }} account.
        <ng-container alertActions>
          <a flButton="primary" size="sm" [href]="getFluiRunningUrl" target="_blank" rel="noopener"
            >Get Flui running</a
          >
          <button flButton="ghost" size="sm" type="button" (click)="cancelled.emit()">
            Back to providers
          </button>
        </ng-container>
      </fl-alert>
    } @else {
      <fl-wizard-steps
        data-testid="wizard-steps"
        [steps]="stepList()"
        [current]="currentStepIndex()"
        (stepSelect)="goToStep($event)"
      />

      <fl-panel [title]="currentStep().title">
        <div class="fl-stack">
          <p class="text-fl-body-sm text-fl-ink-muted">{{ currentStep().description }}</p>
          @switch (currentStepIndex()) {
            @case (0) {
              <app-provider-wizard-credentials
                [form]="credentialsForm"
                [provider]="provider()"
                [fields]="getDynamicCredentialFields()"
                [supportsExpiry]="supportsExpiry()"
                [demo]="demo()"
                [demoPlaceholder]="demoPlaceholder"
                [showPasswords]="showPasswords()"
                (toggleSecret)="togglePasswordVisibility($event)"
              />
            }
            @case (1) {
              <app-provider-wizard-check
                [status]="validationStatus()"
                [error]="validationError()"
                [providerName]="provider().displayName"
                [regions]="availableRegions()"
                (retry)="validateCredentials()"
              />
            }
            @case (2) {
              <app-provider-wizard-regions
                [regions]="availableRegions()"
                [selected]="selectedRegions()"
                (toggled)="toggleRegion($event)"
              />
            }
          }
        </div>
      </fl-panel>

      @if (completionError()) {
        <fl-alert tone="error" title="Setup failed">{{ completionError() }}</fl-alert>
      }

      <div class="flex flex-wrap items-center justify-between gap-2">
        <button
          flButton
          type="button"
          [disabled]="currentStepIndex() === 0"
          (click)="previousStep()"
        >
          Previous
        </button>
        <div class="flex items-center gap-2">
          <button flButton="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
          @if (currentStepIndex() < steps().length - 1) {
            <button
              flButton="primary"
              type="button"
              [disabled]="!canProceed()"
              data-testid="wizard-next"
              (click)="nextStep()"
            >
              @if (currentStepIndex() === 0) {
                {{ demo() ? 'Continue' : 'Validate credentials' }}
              } @else {
                Next
              }
            </button>
          } @else {
            <button
              flButton="primary"
              type="button"
              [disabled]="!canComplete() || isCompleting()"
              data-testid="wizard-complete"
              (click)="complete()"
            >
              {{ isCompleting() ? 'Setting up…' : 'Complete setup' }}
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class ProviderConfigurationWizardComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly providersService = inject(ProvidersService);
  private readonly sandbox = inject(SandboxService);

  provider = input.required<ProviderDefinitionDto>();
  completeOutput = output<ConfigurationResult>();
  cancelled = output<void>();

  credentialsForm!: FormGroup;
  currentStepIndex = signal<number>(0);
  validationStatus = signal<ValidationStatus>('idle');
  validationError = signal<string>('');
  selectedRegions = signal<string[]>([]);
  showPasswords = signal<Record<string, boolean>>({});
  availableRegions = signal<WizardRegion[]>([]);
  isCompleting = signal<boolean>(false);
  completionError = signal<string>('');

  /** A demo guest walks every step; nothing is validated, stored or sent. */
  readonly demo = computed(() => this.sandbox.inSandbox());
  readonly demoFinished = signal(false);
  protected readonly demoPlaceholder = 'Entered in your own installation';
  protected readonly getFluiRunningUrl = GET_FLUI_RUNNING_URL;

  private readonly validated = computed(() => {
    const status = this.validationStatus();
    return status === 'success' || status === 'skipped';
  });

  readonly steps = computed<ConnectStep[]>(() => [
    {
      id: 'credentials',
      title: 'Credentials',
      description: 'What ' + this.provider().displayName + ' needs so Flui can create machines',
      isValid: this.credentialsForm?.valid || false,
      isCompleted: this.validated(),
    },
    {
      id: 'validation',
      title: 'Check the connection',
      description: 'Flui tests the credentials with ' + this.provider().displayName,
      isValid: this.validated(),
      isCompleted: this.validated(),
    },
    {
      id: 'regions',
      title: 'Pick regions',
      description: 'Where new machines may be placed. You can change this later.',
      isValid: this.selectedRegions().length > 0,
      isCompleted: this.selectedRegions().length > 0,
    },
  ]);

  readonly currentStep = computed(() => this.steps()[this.currentStepIndex()]);

  protected readonly stepList = computed<KitWizardStep[]>(() =>
    this.steps().map((step) => ({ name: step.title })),
  );

  ngOnInit(): void {
    this.initializeCredentialsForm();
    this.loadRegions();
  }

  private initializeCredentialsForm(): void {
    const formControls: Record<string, unknown> = {};
    const fields = this.getDynamicCredentialFields();

    fields.forEach((field) => {
      formControls[field.key] = ['', field.required ? [Validators.required] : []];
    });

    formControls['expiresAt'] = [''];

    this.credentialsForm = this.fb.group(formControls);
    if (this.demo()) this.credentialsForm.disable();
  }

  private async loadRegions(): Promise<void> {
    try {
      const regions = await this.providersService.getProviderRegions(this.provider().id);
      this.availableRegions.set(regions);
    } catch (error) {
      console.error('Failed to load regions:', error);
      this.availableRegions.set(this.getSupportedRegions());
    }
  }

  private getCredentialFieldsSchema() {
    return credentialSchema(this.provider());
  }

  private getCredentialType(): string | undefined {
    return credentialKind(this.provider());
  }

  getDynamicCredentialFields(): CredentialFieldDefinition[] {
    const schemaFields = this.getCredentialFieldsSchema()?.fields;
    if (schemaFields?.length) {
      return schemaFields;
    }

    return fallbackCredentialFields(this.getCredentialType(), this.provider().displayName);
  }

  supportsExpiry(): boolean {
    const schema = this.getCredentialFieldsSchema();
    if (schema && typeof schema.supportsExpiry === 'boolean') {
      return schema.supportsExpiry;
    }
    const type = this.getCredentialType();
    return type === 'api_key' || type === 'access_key_secret';
  }

  getSupportedRegions() {
    return this.provider().capabilities?.supportedRegions || [];
  }

  canProceed(): boolean {
    switch (this.currentStepIndex()) {
      case 0:
        return this.demo() || this.credentialsForm.valid;
      case 1:
        return this.validated();
      default:
        return true;
    }
  }

  canComplete(): boolean {
    return this.selectedRegions().length > 0 && this.validated();
  }

  nextStep(): void {
    if (this.currentStepIndex() === 0 && this.demo()) {
      this.validationStatus.set('skipped');
      this.currentStepIndex.set(1);
    } else if (this.currentStepIndex() === 0) {
      this.validateCredentials();
    } else if (this.canProceed()) {
      this.currentStepIndex.update((index) => Math.min(index + 1, this.steps().length - 1));
    }
  }

  previousStep(): void {
    this.currentStepIndex.update((index) => Math.max(index - 1, 0));
  }

  private createProviderCredentials(): ProviderCredentialsDto {
    const formValue = this.credentialsForm.value;
    const credentialType = this.getCredentialType() ?? 'api_key';

    const credentials: ProviderCredentialsDto = {
      provider: this.provider().id as ProviderCredentialsDto.ProviderEnum,
      type: credentialType as ProviderCredentialsDto.TypeEnum,
    };

    for (const field of this.getDynamicCredentialFields()) {
      const value = formValue[field.key];
      if (value !== undefined && value !== '') {
        (credentials as unknown as Record<string, unknown>)[field.key] = value;
      }
    }

    if (formValue.expiresAt) {
      credentials.expiresAt = new Date(formValue.expiresAt).toISOString();
    }

    return credentials;
  }

  async validateCredentials(): Promise<void> {
    if (this.demo() || !this.credentialsForm.valid) return;

    this.validationStatus.set('validating');
    this.currentStepIndex.set(1);

    try {
      const credentials = this.createProviderCredentials();
      const result = await this.providersService.validateProvider(this.provider().id, credentials);

      if (result.success) {
        this.validationStatus.set('success');
        if (result.availableRegions?.length) {
          this.availableRegions.set(result.availableRegions);
        } else {
          await this.loadAvailableRegions();
        }
      } else {
        this.validationStatus.set('error');
        this.validationError.set(result.message || 'Invalid credentials provided');
      }
    } catch (error: unknown) {
      this.validationStatus.set('error');
      this.validationError.set(
        (error as { error?: { message?: string } })?.error?.message || 'Validation failed',
      );
    }
  }

  private async loadAvailableRegions(): Promise<void> {
    try {
      const regions = await this.providersService.getProviderRegions(this.provider().id);
      if (regions?.length) {
        this.availableRegions.set(regions);
      }
    } catch (error) {
      console.error('Failed to load available regions:', error);
    }
  }

  toggleRegion(regionId: string): void {
    this.selectedRegions.update((regions) => {
      const index = regions.indexOf(regionId);
      if (index >= 0) {
        return regions.filter((id) => id !== regionId);
      } else {
        return [...regions, regionId];
      }
    });
  }

  togglePasswordVisibility(fieldKey: string): void {
    this.showPasswords.update((passwords) => ({
      ...passwords,
      [fieldKey]: !passwords[fieldKey],
    }));
  }

  protected goToStep(index: number): void {
    if (index < this.currentStepIndex()) this.currentStepIndex.set(index);
  }

  async complete(): Promise<void> {
    if (!this.canComplete()) return;
    if (this.demo()) {
      this.demoFinished.set(true);
      return;
    }

    this.isCompleting.set(true);
    this.completionError.set('');

    try {
      const credentials = this.createProviderCredentials();
      const regions = this.selectedRegions();
      const configuration = await this.providersService.configureProvider(this.provider().id, {
        credentials,
        enabledRegions: regions,
      });
      this.completeOutput.emit({
        success: true,
        configuration,
      });
    } catch (error: unknown) {
      console.error('Failed to complete setup:', error);
      const message = (error as { error: { message?: string } }).error.message;
      this.completionError.set(message || 'Failed to complete provider setup');
      this.completeOutput.emit({
        success: false,
        error: message || 'Failed to complete provider setup',
      });
    } finally {
      this.isCompleting.set(false);
    }
  }
}
