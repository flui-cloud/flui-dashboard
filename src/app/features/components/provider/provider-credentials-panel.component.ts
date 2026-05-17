import { Component, computed, inject, input, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendar,
  lucideChevronDown,
  lucideChevronUp,
  lucideEye,
  lucideEyeOff,
  lucideKeyRound,
  lucideLoader,
  lucideRotateCcw,
  lucideX,
} from '@ng-icons/lucide';
import { ProvidersService } from '../../service/providers.service';
import { ProviderConfigurationDto, ProviderDefinitionDto, ProviderCredentialsDto } from '../../../core/api';

interface CredentialField {
  key: string;
  label: string;
  providerLabel?: string;
  hint?: string;
  secret: boolean;
  required: boolean;
}

@Component({
  selector: 'provider-credentials-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgIcon],
  providers: [
    provideIcons({
      lucideCalendar,
      lucideChevronDown,
      lucideChevronUp,
      lucideEye,
      lucideEyeOff,
      lucideKeyRound,
      lucideLoader,
      lucideRotateCcw,
      lucideX,
    }),
  ],
  template: `
    <section class="bg-card border border-border rounded-xl overflow-hidden">
      <header class="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
        <ng-icon name="lucideKeyRound" class="h-4 w-4 text-muted-foreground" />
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Credentials</h2>
      </header>

      <div class="p-6 space-y-4">
        <!-- Current info -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Type</p>
            <p class="font-medium mt-1">{{ credentialTypeLabel() }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Configured</p>
            <p class="font-medium mt-1">{{ formatDate(configuration().createdAt) }}</p>
          </div>
        </div>

        <!-- Expiry row -->
        <div class="pt-3 border-t border-border">
          @if (configuration().credentialsExpiresAt) {
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-2">
                <ng-icon name="lucideCalendar" [class]="'h-4 w-4 ' + expiryIconClass()" />
                <div>
                  <p class="text-xs text-muted-foreground uppercase tracking-wide">Key expiry</p>
                  <p [class]="'font-medium text-sm ' + expiryTextClass()">
                    {{ formatDate(configuration().credentialsExpiresAt) }}
                    <span class="text-xs ml-1">({{ expiryRelativeLabel() }})</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                (click)="clearExpiry()"
                [disabled]="isSavingExpiry()"
                class="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <ng-icon name="lucideX" class="h-3 w-3" />
                Clear
              </button>
            </div>
          } @else {
            <p class="text-xs text-muted-foreground">No expiry set for these credentials.</p>
          }

          <!-- Update expiry form -->
          <button
            type="button"
            (click)="showExpiryForm.set(!showExpiryForm())"
            class="mt-2 inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors gap-1"
          >
            <ng-icon [name]="showExpiryForm() ? 'lucideChevronUp' : 'lucideChevronDown'" class="h-3.5 w-3.5" />
            {{ configuration().credentialsExpiresAt ? 'Change expiry date' : 'Set expiry date' }}
          </button>

          @if (showExpiryForm()) {
            <div class="mt-3 flex items-center gap-3">
              <input
                type="date"
                [value]="expiryInputValue()"
                (change)="onExpiryChange($event)"
                class="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                (click)="saveExpiry()"
                [disabled]="isSavingExpiry() || !pendingExpiry()"
                class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                @if (isSavingExpiry()) { <ng-icon name="lucideLoader" class="h-3.5 w-3.5 mr-1.5 animate-spin" /> }
                Save
              </button>
            </div>
            @if (expiryError()) {
              <p class="text-xs text-red-600 dark:text-red-400 mt-2">{{ expiryError() }}</p>
            }
          }
        </div>

        <!-- Rotate credentials -->
        <div class="pt-3 border-t border-border">
          <button
            type="button"
            (click)="showRotateForm.set(!showRotateForm())"
            class="inline-flex items-center gap-2 text-sm font-medium hover:text-foreground text-muted-foreground transition-colors"
          >
            <ng-icon name="lucideRotateCcw" class="h-4 w-4" />
            Rotate credentials
            <ng-icon [name]="showRotateForm() ? 'lucideChevronUp' : 'lucideChevronDown'" class="h-3.5 w-3.5 ml-auto" />
          </button>

          @if (showRotateForm()) {
            <form [formGroup]="rotateForm" (ngSubmit)="rotate()" class="mt-4 space-y-4">
              @for (field of credentialFields(); track field.key) {
                <div class="space-y-1.5">
                  <label class="text-sm font-medium">
                    {{ field.providerLabel || field.label }}
                    @if (field.required) { <span class="text-red-500">*</span> }
                  </label>
                  @if (field.secret) {
                    <div class="relative">
                      <input
                        [type]="showPasswords()[field.key] ? 'text' : 'password'"
                        [formControlName]="field.key"
                        class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <button type="button" (click)="togglePwd(field.key)" class="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground">
                        <ng-icon [name]="showPasswords()[field.key] ? 'lucideEyeOff' : 'lucideEye'" class="h-4 w-4" />
                      </button>
                    </div>
                  } @else {
                    <input type="text" [formControlName]="field.key" class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  }
                  @if (field.hint) { <p class="text-xs text-muted-foreground">{{ field.hint }}</p> }
                </div>
              }

              @if (supportsExpiry()) {
                <div class="space-y-1.5">
                  <label class="text-sm font-medium">
                    Expiry date <span class="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input type="date" formControlName="expiresAt" class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
              }

              @if (rotateError()) {
                <p class="text-sm text-red-600 dark:text-red-400">{{ rotateError() }}</p>
              }

              <div class="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  [disabled]="rotateForm.invalid || isRotating()"
                  class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  @if (isRotating()) { <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" /> }
                  Confirm rotation
                </button>
                <button type="button" (click)="showRotateForm.set(false)" class="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          }
        </div>
      </div>
    </section>
  `,
})
export class ProviderCredentialsPanelComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly providersService = inject(ProvidersService);

  provider = input.required<ProviderDefinitionDto>();
  configuration = input.required<ProviderConfigurationDto>();
  updated = output<ProviderConfigurationDto>();

  protected showExpiryForm = signal(false);
  protected showRotateForm = signal(false);
  protected isSavingExpiry = signal(false);
  protected isRotating = signal(false);
  protected expiryError = signal('');
  protected rotateError = signal('');
  protected pendingExpiry = signal<string | null>(null);
  protected showPasswords = signal<Record<string, boolean>>({});

  rotateForm!: FormGroup;

  protected credentialFields = computed<CredentialField[]>(() => {
    const schema = (this.provider() as unknown as { credentialFields?: { fields?: CredentialField[] } }).credentialFields;
    if (schema?.fields?.length) return schema.fields;
    return this.fallbackFields();
  });

  protected supportsExpiry = computed(() => {
    const schema = (this.provider() as unknown as { credentialFields?: { supportsExpiry?: boolean } }).credentialFields;
    if (schema && typeof schema.supportsExpiry === 'boolean') return schema.supportsExpiry;
    const type = this.configuration().credentialsType as string | undefined;
    return type === 'api_key' || type === 'access_key_secret';
  });

  protected credentialTypeLabel = computed(() => {
    switch (this.configuration().credentialsType) {
      case 'api_key': return 'API Key';
      case 'access_key_secret': return 'Access Key + Secret';
      case 'bearer_token': return 'Bearer Token';
      case 'user_password': return 'Username / Password';
      default: return this.configuration().credentialsType ?? 'Unknown';
    }
  });

  protected expiryDaysLeft = computed<number | null>(() => {
    const v = this.configuration().credentialsExpiresAt;
    if (!v) return null;
    const diff = new Date(v).getTime() - Date.now();
    return Number.isNaN(diff) ? null : Math.ceil(diff / 86400000);
  });

  protected expiryRelativeLabel = computed(() => {
    const d = this.expiryDaysLeft();
    if (d === null) return '';
    if (d < 0) return `expired ${-d} day${-d === 1 ? '' : 's'} ago`;
    if (d === 0) return 'expires today';
    return `${d} day${d === 1 ? '' : 's'} left`;
  });

  protected expiryIconClass = computed(() => {
    const d = this.expiryDaysLeft();
    if (d !== null && d < 0) return 'text-red-600 dark:text-red-400';
    if (d !== null && d <= 14) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-muted-foreground';
  });

  protected expiryTextClass = computed(() => {
    const d = this.expiryDaysLeft();
    if (d !== null && d < 0) return 'text-red-600 dark:text-red-400';
    if (d !== null && d <= 14) return 'text-yellow-700 dark:text-yellow-300';
    return '';
  });

  protected expiryInputValue = computed(() => {
    const v = this.configuration().credentialsExpiresAt;
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  });

  ngOnInit(): void {
    this.buildRotateForm();
  }

  private buildRotateForm(): void {
    const controls: Record<string, unknown> = {};
    this.credentialFields().forEach((f) => {
      controls[f.key] = ['', f.required ? [Validators.required] : []];
    });
    if (this.supportsExpiry()) controls['expiresAt'] = [''];
    this.rotateForm = this.fb.group(controls);
  }

  onExpiryChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.pendingExpiry.set(val || null);
  }

  async saveExpiry(): Promise<void> {
    if (this.isSavingExpiry() || !this.pendingExpiry()) return;
    this.isSavingExpiry.set(true);
    this.expiryError.set('');
    try {
      const config = await this.providersService.updateCredentialsExpiry(this.provider().id, {
        expiresAt: new Date(this.pendingExpiry()!).toISOString(),
      });
      this.updated.emit(config);
      this.showExpiryForm.set(false);
      this.pendingExpiry.set(null);
    } catch (e: unknown) {
      this.expiryError.set(this.extractError(e, 'Failed to update expiry.'));
    } finally {
      this.isSavingExpiry.set(false);
    }
  }

  async clearExpiry(): Promise<void> {
    this.isSavingExpiry.set(true);
    this.expiryError.set('');
    try {
      const config = await this.providersService.updateCredentialsExpiry(this.provider().id, { expiresAt: null });
      this.updated.emit(config);
    } catch (e: unknown) {
      this.expiryError.set(this.extractError(e, 'Failed to clear expiry.'));
    } finally {
      this.isSavingExpiry.set(false);
    }
  }

  async rotate(): Promise<void> {
    if (this.rotateForm.invalid || this.isRotating()) return;
    this.isRotating.set(true);
    this.rotateError.set('');
    try {
      const formValue = this.rotateForm.value;
      const credentials: ProviderCredentialsDto = {
        provider: this.provider().id as ProviderCredentialsDto.ProviderEnum,
        type: (this.configuration().credentialsType ?? 'api_key') as ProviderCredentialsDto.TypeEnum,
      };
      for (const field of this.credentialFields()) {
        if (formValue[field.key]) {
          (credentials as unknown as Record<string, unknown>)[field.key] = formValue[field.key];
        }
      }
      if (formValue['expiresAt']) {
        credentials.expiresAt = new Date(formValue['expiresAt']).toISOString();
      }
      const config = await this.providersService.rotateCredentials(this.provider().id, credentials);
      this.updated.emit(config);
      this.showRotateForm.set(false);
      this.rotateForm.reset();
    } catch (e: unknown) {
      this.rotateError.set(this.extractError(e, 'Failed to rotate credentials.'));
    } finally {
      this.isRotating.set(false);
    }
  }

  togglePwd(key: string): void {
    this.showPasswords.update((s) => ({ ...s, [key]: !s[key] }));
  }

  protected formatDate(value: string | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }

  private fallbackFields(): CredentialField[] {
    const type = this.configuration().credentialsType as string | undefined;
    const name = this.provider().displayName;
    switch (type) {
      case 'api_key':
        return [{ key: 'apiKey', label: 'API Token', providerLabel: 'API Token', hint: `Your ${name} API token`, secret: true, required: true }];
      case 'access_key_secret':
        return [
          { key: 'accessKey', label: 'Access Key ID', providerLabel: 'Access Key ID', hint: `Your ${name} Access Key ID`, secret: false, required: true },
          { key: 'secretKey', label: 'Secret Key', providerLabel: 'Secret Key', hint: `Your ${name} Secret Key`, secret: true, required: true },
        ];
      case 'bearer_token':
        return [{ key: 'bearerToken', label: 'Bearer Token', providerLabel: 'Bearer Token', secret: true, required: true }];
      case 'user_password':
        return [
          { key: 'clientId', label: 'Client ID', providerLabel: 'Client ID', secret: false, required: true },
          { key: 'clientSecret', label: 'Client Secret', providerLabel: 'Client Secret', secret: true, required: true },
          { key: 'username', label: 'Username', providerLabel: 'Username', secret: false, required: true },
          { key: 'password', label: 'Password', providerLabel: 'Password', secret: true, required: true },
        ];
      default:
        return [];
    }
  }

  private extractError(error: unknown, fallback: string): string {
    const e = error as { error?: { message?: string }; message?: string } | undefined;
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
