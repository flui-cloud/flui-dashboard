import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  OnInit,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
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
import { ProviderLogoService } from '../../../shared/services/provider-logo.service';
import { ProviderDefinitionDto, ProviderCredentialsDto } from '../../../core/api';
interface CredentialFieldDefinition {
  key: string;
  label: string;
  providerLabel: string;
  hint?: string;
  secret: boolean;
  required: boolean;
}

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
  imports: [CommonModule, ReactiveFormsModule, NgIcon],
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
  template: `
    <div class="max-w-4xl mx-auto">
      <div class="mb-8">
        <div class="flex items-center space-x-3 mb-4">
          @if (logoUrl()) {
          <img
            [src]="logoUrl()"
            [alt]="provider().displayName"
            class="h-8 w-8 object-contain"
          />
          } @else {
          <ng-icon name="lucideGlobe" class="h-8 w-8 text-muted-foreground" />
          }
          <div>
            <h1 class="text-2xl font-bold">
              Configure {{ provider().displayName }}
            </h1>
            <p class="text-muted-foreground">{{ provider().description }}</p>
          </div>
        </div>

        <div class="flex items-center space-x-4">
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
          <h2 class="text-lg font-semibold">{{ currentStep().title }}</h2>
          <p class="text-muted-foreground">{{ currentStep().description }}</p>
        </div>
      </div>

      <div class="bg-card border border-border rounded-lg p-6 mb-6">
        @switch (currentStepIndex()) { @case (0) {
        <form [formGroup]="credentialsForm" class="space-y-6">
          <div
            class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <div class="flex items-start space-x-3">
              <ng-icon
                name="lucideInfo"
                class="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0"
              />
              <div class="flex-1 min-w-0">
                <h3 class="font-medium text-blue-900 dark:text-blue-100">
                  API Credentials Required
                </h3>
                <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  You'll need to provide API credentials to connect with
                  {{ provider().displayName }}.
                  @if (provider().accessKeyDocumentationUrl) {
                  <a
                    [href]="provider().accessKeyDocumentationUrl"
                    target="_blank"
                    class="inline-flex items-center ml-1 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Learn how to get your credentials
                    <ng-icon name="lucideExternalLink" class="h-3 w-3 ml-1" />
                  </a>
                  }
                </p>

                @if (provider().dnsZoneDelegation) {
                <div class="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                  <p class="text-sm font-medium text-blue-900 dark:text-blue-100 flex items-center gap-1">
                    <ng-icon name="lucideGlobe" class="h-4 w-4" />
                    DNS Zone Delegation
                  </p>
                  <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    To use custom domains, delegate your domain to {{ provider().displayName }}. The exact nameservers to set at your registrar are listed in {{ provider().displayName }}'s console once you register the zone.
                  </p>
                  <a
                    [href]="provider().dnsZoneDelegation!.delegationGuideUrl"
                    target="_blank"
                    class="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View delegation guide
                    <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                  </a>
                </div>
                }
              </div>
            </div>
          </div>

          @for (field of getDynamicCredentialFields(); track field.key) {
          <div class="space-y-2">
            <label class="text-sm font-medium">
              {{ field.providerLabel || field.label }}
              @if (field.required) {
              <span class="text-red-500">*</span>
              }
            </label>

            @if (field.secret) {
            <div class="relative">
              <input
                [type]="showPasswords()[field.key] ? 'text' : 'password'"
                [formControlName]="field.key"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
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
            </div>
            } @else {
            <input
              type="text"
              [formControlName]="field.key"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            }

            @if (field.hint) {
            <p class="text-sm text-muted-foreground">{{ field.hint }}</p>
            }

            @if (credentialsForm.get(field.key)?.errors &&
            credentialsForm.get(field.key)?.touched) {
            <p class="text-sm text-red-500">This field is required</p>
            }
          </div>
          }

          @if (supportsExpiry()) {
          <div class="space-y-2">
            <label class="text-sm font-medium">
              Key Expiry Date
              <span class="text-muted-foreground font-normal ml-1">(optional)</span>
            </label>
            <input
              type="date"
              formControlName="expiresAt"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p class="text-sm text-muted-foreground">
              Set this if the key has an expiry configured in the provider console.
            </p>
          </div>
          }
        </form>
        } @case (1) {
        <div class="text-center space-y-6">
          @if (validationStatus() === 'validating') {
          <div class="space-y-4">
            <ng-icon
              name="lucideLoader"
              class="h-12 w-12 mx-auto text-blue-500 animate-spin"
            />
            <h3 class="text-lg font-semibold">Validating Credentials</h3>
            <p class="text-muted-foreground">
              Testing connection to {{ provider().displayName }}...
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
            <h3
              class="text-lg font-semibold text-green-900 dark:text-green-100"
            >
              Connection Successful!
            </h3>
            <p class="text-muted-foreground">
              Your credentials are valid and the connection is working properly.
            </p>

            @if (availableRegions().length > 0) {
            <div class="mt-6 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg">
              <h4 class="font-medium mb-3">Available Regions Detected</h4>
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
            <h3 class="text-lg font-semibold text-red-900 dark:text-red-100">
              Validation Failed
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
              Retry Validation
            </button>
          </div>
          }
        </div>
        } @case (2) {
        <div class="space-y-6">
          <div
            class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <div class="flex items-start space-x-3">
              <ng-icon
                name="lucideGlobe"
                class="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5"
              />
              <div>
                <h3 class="font-medium text-blue-900 dark:text-blue-100">
                  Select Deployment Regions
                </h3>
                <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Choose which regions to enable for deployment. You can modify
                  this later.
                </p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (region of availableRegions(); track region.id) {
            <div
              class="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <label class="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  [checked]="selectedRegions().includes(region.id)"
                  (change)="toggleRegion(region.id)"
                  class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div class="flex-1">
                  <div class="flex items-center space-x-2">
                    <span class="text-lg">{{ '🌍' }}</span>
                    <span class="font-medium">{{ region.displayName || region.name }}</span>
                  </div>
                  <p class="text-sm text-muted-foreground">
                    {{ region.country || 'Unknown location' }}
                  </p>
                </div>
                @if (!region.available) {
                <span
                  class="text-xs text-red-500 bg-red-100 dark:bg-red-900/20 px-2 py-1 rounded"
                >
                  Unavailable
                </span>
                }
              </label>
            </div>
            }
          </div>

          @if (selectedRegions().length === 0) {
          <div
            class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
          >
            <div class="flex items-center space-x-2">
              <ng-icon
                name="lucideTriangleAlert"
                class="h-5 w-5 text-yellow-600 dark:text-yellow-400"
              />
              <p class="text-sm text-yellow-800 dark:text-yellow-200">
                Please select at least one region to continue.
              </p>
            </div>
          </div>
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
          >
            @if (currentStepIndex() === 0) { Validate Credentials } @else { Next
            }
            <ng-icon name="lucideArrowRight" class="h-4 w-4 ml-2" />
          </button>
          } @else {
          <button
            (click)="complete()"
            [disabled]="!canComplete() || isCompleting()"
            class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            @if (isCompleting()) {
            <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" />
            Setting up...
            } @else {
            <ng-icon name="lucideCheck" class="h-4 w-4 mr-2" />
            Complete Setup
            }
          </button>
          }
        </div>

        @if (completionError()) {
        <div class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div class="flex items-start space-x-3">
            <ng-icon name="lucideX" class="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <h3 class="font-medium text-red-900 dark:text-red-100">Setup Failed</h3>
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">
                {{ completionError() }}
              </p>
            </div>
          </div>
        </div>
        }
      </div>
    </div>
  `,
})
export class ProviderConfigurationWizardComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly providersService = inject(ProvidersService);
  private readonly providerLogo = inject(ProviderLogoService);

  readonly logoUrl = toSignal(
    toObservable(computed(() => this.provider()?.logoUrl ?? null)).pipe(
      switchMap((url) => this.providerLogo.resolve(url)),
    ),
    { initialValue: null as string | null },
  );

  provider = input.required<ProviderDefinitionDto>();
  completeOutput = output<{ success: boolean; configuration?: any; error?: string }>();
  cancelled = output<void>();

  credentialsForm!: FormGroup;
  currentStepIndex = signal<number>(0);
  validationStatus = signal<'idle' | 'validating' | 'success' | 'error'>('idle');
  validationError = signal<string>('');
  selectedRegions = signal<string[]>([]);
  showPasswords = signal<Record<string, boolean>>({});
  availableRegions = signal<any[]>([]);
  isCompleting = signal<boolean>(false);
  completionError = signal<string>('');

  readonly steps = computed<WizardStep[]>(() => [
    {
      id: 'credentials',
      title: 'API Credentials',
      description:
        'Enter your API credentials to connect with ' +
        this.provider().displayName,
      isValid: this.credentialsForm?.valid || false,
      isCompleted: this.validationStatus() === 'success',
    },
    {
      id: 'validation',
      title: 'Validate Connection',
      description: 'Testing your credentials and connection',
      isValid: this.validationStatus() === 'success',
      isCompleted: this.validationStatus() === 'success',
    },
    {
      id: 'regions',
      title: 'Select Regions',
      description: 'Choose which regions to enable for deployment',
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

  private getCredentialFieldsSchema(): {
    type?: string;
    supportsExpiry?: boolean;
    fields?: CredentialFieldDefinition[];
  } | undefined {
    return (this.provider() as unknown as {
      credentialFields?: { type?: string; supportsExpiry?: boolean; fields?: CredentialFieldDefinition[] };
    }).credentialFields;
  }

  private getCredentialType(): string | undefined {
    return this.getCredentialFieldsSchema()?.type
      ?? (this.provider().capabilities?.credentialType as string | undefined);
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
        return this.credentialsForm.valid;
      case 1:
        return this.validationStatus() === 'success';
      default:
        return true;
    }
  }

  canComplete(): boolean {
    return (
      this.selectedRegions().length > 0 && this.validationStatus() === 'success'
    );
  }

  nextStep(): void {
    if (this.currentStepIndex() === 0) {
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
    if (!this.credentialsForm.valid) return;

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
