import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  OnInit,
  ChangeDetectionStrategy
} from '@angular/core';

import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCheck,
  lucideX,
  lucideLoader,
  lucideEye,
  lucideEyeOff,
  lucideExternalLink,
  lucideShield,
  lucideGlobe,
  lucideTriangleAlert,
  lucideInfo,
} from '@ng-icons/lucide';
import { ProvidersService } from '../../service/providers.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { ProviderMarkComponent } from '../../../shared/components/provider-mark.component';
import { ProviderDefinitionDto, ProviderCredentialsDto } from '../../../core/api';
import {
  CredentialFieldDefinition,
  GET_FLUI_RUNNING_URL,
  credentialKind,
  credentialSchema,
} from './provider-presentation';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  isValid: boolean;
  isCompleted: boolean;
}

@Component({
  selector: 'provider-configuration-wizard',
  standalone: true,
  imports: [ReactiveFormsModule, NgIcon, ProviderMarkComponent],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCheck,
      lucideX,
      lucideLoader,
      lucideEye,
      lucideEyeOff,
      lucideExternalLink,
      lucideShield,
      lucideGlobe,
      lucideTriangleAlert,
      lucideInfo,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="max-w-4xl mx-auto">
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-5">
          <app-provider-mark [name]="provider().displayName" [size]="32" />
          <div class="min-w-0">
            <h1 class="text-2xl font-semibold tracking-tight text-foreground">
              Connect {{ provider().displayName }}
            </h1>
            <p class="text-sm text-muted-foreground truncate">{{ provider().description }}</p>
          </div>
        </div>

        @if (!demoFinished()) {
          <div class="flex items-center gap-2" data-testid="wizard-steps">
            @for (step of steps(); track step.id; let i = $index) {
              <div class="flex items-center">
                <div [class]="getStepClass(i)">
                  @if (step.isCompleted) {
                    <ng-icon name="lucideCheck" class="h-4 w-4" />
                  } @else {
                    <span class="text-sm font-medium">{{ i + 1 }}</span>
                  }
                </div>
                @if (i < steps().length - 1) {
                  <div [class]="getConnectorClass(i)" class="w-12 h-0.5 mx-2"></div>
                }
              </div>
            }
          </div>

          <div class="mt-4">
            <h2 class="text-lg font-semibold text-foreground">{{ currentStep().title }}</h2>
            <p class="text-sm text-muted-foreground">{{ currentStep().description }}</p>
          </div>
        }
      </div>

      @if (demoFinished()) {
        <div
          role="note"
          class="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground"
          data-testid="wizard-demo-end"
        >
          <ng-icon name="lucideInfo" class="mt-0.5 h-4 w-4 flex-shrink-0 opacity-70" />
          <div class="space-y-2">
            <p class="leading-relaxed">
              <span class="font-medium text-foreground">In the demo, nothing is connected.</span>
              Install Flui to connect your {{ provider().displayName }} account.
            </p>
            <div class="flex flex-wrap items-center gap-4">
              <a
                [href]="getFluiRunningUrl"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Get Flui running
                <ng-icon name="lucideExternalLink" class="h-3 w-3" />
              </a>
              <button
                type="button"
                (click)="cancelled.emit()"
                class="text-sm font-medium text-foreground hover:underline"
              >
                Back to providers
              </button>
            </div>
          </div>
        </div>
      } @else {
      <div class="card-surface p-6 mb-6">
        @switch (currentStepIndex()) { @case (0) {
        <form [formGroup]="credentialsForm" class="space-y-6">
          <div class="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <ng-icon name="lucideShield" class="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div class="flex-1 min-w-0 text-sm text-muted-foreground">
              <p>
                {{ provider().displayName }} gives you these in its console.
                @if (provider().accessKeyDocumentationUrl) {
                  <a
                    [href]="provider().accessKeyDocumentationUrl"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center gap-1 ml-1 font-medium text-primary hover:underline"
                  >
                    Where to find them
                    <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                  </a>
                }
              </p>
              @if (provider().dnsZoneDelegation) {
                <p class="mt-1 flex items-center gap-1">
                  <ng-icon name="lucideGlobe" class="h-3.5 w-3.5 shrink-0" />
                  Custom domains can be delegated to {{ provider().displayName }}.
                  <a
                    [href]="provider().dnsZoneDelegation!.delegationGuideUrl"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    title="The nameservers to set at your registrar are listed in the provider's console once the zone is registered."
                  >
                    How
                    <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                  </a>
                </p>
              }
            </div>
          </div>

          @for (field of getDynamicCredentialFields(); track field.key) {
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground" [attr.for]="'credential-' + field.key">
              {{ field.providerLabel || field.label }}
              @if (field.required) {
              <span class="text-muted-foreground">*</span>
              }
            </label>

            @if (field.secret) {
            <div class="relative">
              <input
                [id]="'credential-' + field.key"
                [type]="showPasswords()[field.key] ? 'text' : 'password'"
                [formControlName]="field.key"
                [attr.placeholder]="demo() ? demoPlaceholder : null"
                autocomplete="off"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              />
              @if (!demo()) {
              <button
                type="button"
                (click)="togglePasswordVisibility(field.key)"
                class="absolute inset-y-0 right-0 flex items-center pr-3"
              >
                <ng-icon
                  [name]="showPasswords()[field.key] ? 'lucideEyeOff' : 'lucideEye'"
                  class="h-4 w-4 text-muted-foreground hover:text-foreground"
                />
              </button>
              }
            </div>
            } @else {
            <input
              [id]="'credential-' + field.key"
              type="text"
              [formControlName]="field.key"
              [attr.placeholder]="demo() ? demoPlaceholder : null"
              autocomplete="off"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            />
            }

            @if (field.hint) {
            <p class="text-xs text-muted-foreground">{{ field.hint }}</p>
            }

            @if (credentialsForm.get(field.key)?.errors &&
            credentialsForm.get(field.key)?.touched) {
            <p class="text-sm text-destructive">This field is required</p>
            }
          </div>
          }

          @if (supportsExpiry()) {
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground" for="credential-expiry">
              Key expiry date
              <span class="text-muted-foreground font-normal ml-1">(optional)</span>
            </label>
            <input
              id="credential-expiry"
              type="date"
              formControlName="expiresAt"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p class="text-xs text-muted-foreground">
              Set it if the key expires in the provider console.
            </p>
          </div>
          }
        </form>
        } @case (1) {
        <div class="text-center space-y-6">
          @if (validationStatus() === 'skipped') {
          <div class="space-y-4" data-testid="wizard-demo-check">
            <div class="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center">
              <ng-icon name="lucideShield" class="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 class="text-lg font-semibold text-foreground">Connection check</h3>
            <p class="text-sm text-muted-foreground max-w-md mx-auto">
              Here Flui tests the credentials against {{ provider().displayName }}. In the demo nothing is sent.
            </p>
            @if (availableRegions().length > 0) {
            <p class="text-sm text-muted-foreground">
              {{ availableRegions().length }} regions to choose from next.
            </p>
            }
          </div>
          } @else if (validationStatus() === 'validating') {
          <div class="space-y-4">
            <ng-icon
              name="lucideLoader"
              class="h-12 w-12 mx-auto text-muted-foreground animate-spin"
            />
            <h3 class="text-lg font-semibold">Validating credentials</h3>
            <p class="text-muted-foreground">
              Testing the connection to {{ provider().displayName }}...
            </p>
          </div>
          } @else if (validationStatus() === 'success') {
          <div class="space-y-4">
            <div
              class="h-12 w-12 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center"
            >
              <ng-icon
                name="lucideCheck"
                class="h-6 w-6 text-green-600 dark:text-green-400"
              />
            </div>
            <h3 class="text-lg font-semibold text-foreground">
              Connection successful
            </h3>
            <p class="text-muted-foreground">
              Your credentials are valid and the connection works.
            </p>

            @if (availableRegions().length > 0) {
            <div class="mt-6 p-4 card-inner text-left">
              <h4 class="text-label mb-3">Regions detected</h4>
              <div class="grid grid-cols-2 gap-2">
                @for (region of availableRegions(); track region.id) {
                <div class="flex items-center space-x-2 text-sm">
                  <span>{{ region.flagEmoji || '🌍' }}</span>
                  <span>{{ region.displayName || region.name }}</span>
                </div>
                }
              </div>
            </div>
            }
          </div>
          } @else if (validationStatus() === 'error') {
          <div class="space-y-4">
            <div
              class="h-12 w-12 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center"
            >
              <ng-icon
                name="lucideX"
                class="h-6 w-6 text-red-600 dark:text-red-400"
              />
            </div>
            <h3 class="text-lg font-semibold text-foreground">
              Validation failed
            </h3>
            <p class="text-muted-foreground">
              {{
                validationError() ||
                  'Unable to connect with the provided credentials.'
              }}
            </p>
            <button
              (click)="validateCredentials()"
              class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ng-icon name="lucideLoader" class="h-4 w-4 mr-2" />
              Retry validation
            </button>
          </div>
          }
        </div>
        } @case (2) {
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            @for (region of availableRegions(); track region.id) {
            <label
              class="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
              [attr.data-testid]="'wizard-region-' + region.id"
            >
              <input
                type="checkbox"
                [checked]="selectedRegions().includes(region.id)"
                (change)="toggleRegion(region.id)"
                class="h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <span class="text-base leading-none">{{ region.flagEmoji || '🌍' }}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-foreground truncate">{{ region.displayName || region.name }}</span>
                <span class="block text-xs text-muted-foreground">{{ region.id }}</span>
              </span>
              @if (region.available === false) {
              <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span class="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"></span>
                Unavailable
              </span>
              }
            </label>
            }
          </div>

          @if (selectedRegions().length === 0) {
          <p class="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            Pick at least one region to continue.
          </p>
          }
        </div>
        } }
      </div>

      <div class="flex items-center justify-between">
        <button
          (click)="previousStep()"
          [disabled]="currentStepIndex() === 0"
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4 mr-2" />
          Previous
        </button>

        <div class="flex items-center space-x-2">
          <button
            (click)="cancelled.emit()"
            class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Cancel
          </button>

          @if (currentStepIndex() < steps().length - 1) {
          <button
            (click)="nextStep()"
            [disabled]="!canProceed()"
            class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="wizard-next"
          >
            @if (currentStepIndex() === 0) { {{ demo() ? 'Continue' : 'Validate credentials' }} } @else { Next }
            <ng-icon name="lucideArrowRight" class="h-4 w-4 ml-2" />
          </button>
          } @else {
          <button
            (click)="complete()"
            [disabled]="!canComplete() || isCompleting()"
            class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="wizard-complete"
          >
            @if (isCompleting()) {
            <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" />
            Setting up...
            } @else {
            <ng-icon name="lucideCheck" class="h-4 w-4 mr-2" />
            Complete setup
            }
          </button>
          }
        </div>
      </div>

      @if (completionError()) {
      <div class="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <p class="font-medium">Setup failed</p>
        <p class="mt-1">{{ completionError() }}</p>
      </div>
      }
      }
    </div>
  `,
})
export class ProviderConfigurationWizardComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly providersService = inject(ProvidersService);
  private readonly sandbox = inject(SandboxService);

  provider = input.required<ProviderDefinitionDto>();
  completeOutput = output<{ success: boolean; configuration?: any; error?: string }>();
  cancelled = output<void>();

  credentialsForm!: FormGroup;
  currentStepIndex = signal<number>(0);
  validationStatus = signal<'idle' | 'validating' | 'success' | 'error' | 'skipped'>('idle');
  validationError = signal<string>('');
  selectedRegions = signal<string[]>([]);
  showPasswords = signal<Record<string, boolean>>({});
  availableRegions = signal<any[]>([]);
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

  readonly steps = computed<WizardStep[]>(() => [
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

  ngOnInit(): void {
    this.initializeCredentialsForm();
    this.loadRegions();
  }

  private initializeCredentialsForm(): void {
    const formControls: Record<string, any> = {};
    const fields = this.getDynamicCredentialFields();

    fields.forEach((field) => {
      formControls[field.key] = ['', field.required ? [Validators.required] : []];
    });

    // Always add expiresAt (optional)
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

    const credentialType = this.getCredentialType();
    const providerName = this.provider().displayName;

    switch (credentialType) {
      case 'api_key':
        return [{
          key: 'apiKey', label: 'API Token', providerLabel: 'API Token',
          hint: `Your ${providerName} API token`, secret: true, required: true,
        }];
      case 'bearer_token':
        return [{
          key: 'bearerToken', label: 'Bearer Token', providerLabel: 'Bearer Token',
          hint: `Your ${providerName} bearer token`, secret: true, required: true,
        }];
      case 'user_password':
        return [
          { key: 'clientId', label: 'Client ID', providerLabel: 'Client ID', secret: false, required: true },
          { key: 'clientSecret', label: 'Client Secret', providerLabel: 'Client Secret', secret: true, required: true },
          { key: 'username', label: 'Username', providerLabel: 'Username', secret: false, required: true },
          { key: 'password', label: 'Password', providerLabel: 'Password', secret: true, required: true },
        ];
      case 'access_key_secret':
        return [
          {
            key: 'accessKey', label: 'Access Key ID', providerLabel: 'Access Key ID',
            hint: `Your ${providerName} Access Key ID`, secret: false, required: true,
          },
          {
            key: 'secretKey', label: 'Secret Key', providerLabel: 'Secret Key',
            hint: `Your ${providerName} Secret Key`, secret: true, required: true,
          },
        ];
      default:
        return [];
    }
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
      this.currentStepIndex.update((index) =>
        Math.min(index + 1, this.steps().length - 1)
      );
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
      const result = await this.providersService.validateProvider(
        this.provider().id,
        credentials
      );

      if (result.success) {
        this.validationStatus.set('success');
        this.updateStepCompletion(0, true);
        this.updateStepCompletion(1, true);

        // Use regions from validation response if available, otherwise fetch separately
        if (result.availableRegions?.length) {
          this.availableRegions.set(result.availableRegions);
        } else {
          await this.loadAvailableRegions();
        }
      } else {
        this.validationStatus.set('error');
        this.validationError.set(result.message || 'Invalid credentials provided');
      }
    } catch (error: any) {
      this.validationStatus.set('error');
      this.validationError.set(error?.error?.message || 'Validation failed');
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

  private updateStepCompletion(stepIndex: number, completed: boolean): void {
    // Implementation handled by computed properties
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

      // Call the providers service to configure the provider
      const configuration = await this.providersService.configureProvider(
        this.provider().id,
        {
          credentials,
          enabledRegions: regions
        }
      );

      // Emit success with the configuration
      this.completeOutput.emit({
        success: true,
        configuration
      });

    } catch (error: any) {
      console.error('Failed to complete setup:', error);
      this.completionError.set(error.error.message || 'Failed to complete provider setup');

      // Emit error
      this.completeOutput.emit({
        success: false,
        error: error.error.message || 'Failed to complete provider setup'
      });
    } finally {
      this.isCompleting.set(false);
    }
  }

  getStepClass(stepIndex: number): string {
    const step = this.steps()[stepIndex];
    const isCurrent = stepIndex === this.currentStepIndex();
    const baseClass =
      'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors';

    if (step.isCompleted) {
      return `${baseClass} bg-green-500 border-green-500 text-white`;
    } else if (isCurrent) {
      return `${baseClass} bg-primary border-primary text-primary-foreground`;
    } else {
      return `${baseClass} bg-background border-muted-foreground text-muted-foreground`;
    }
  }

  getConnectorClass(stepIndex: number): string {
    const currentStep = this.steps()[stepIndex];
    const nextStep = this.steps()[stepIndex + 1];

    if (currentStep.isCompleted && nextStep.isCompleted) {
      return 'bg-green-500';
    } else if (currentStep.isCompleted) {
      return 'bg-primary';
    } else {
      return 'bg-muted-foreground';
    }
  }
}
