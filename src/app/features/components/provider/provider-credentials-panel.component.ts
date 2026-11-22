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
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideEye, lucideEyeOff } from '@ng-icons/lucide';
import { ProvidersService } from '../../service/providers.service';
import {
  ProviderConfigurationDto,
  ProviderCredentialsDto,
  ProviderDefinitionDto,
} from '../../../core/api';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlField } from '../../../ui/patterns/field';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { CredentialFieldDefinition, formatDateTime } from './provider-presentation';
import {
  dateInputValue,
  errorMessageOf,
  expiryDaysLeft,
  expiryRelativeLabel,
  expiryTone,
  fallbackCredentialFields,
  savedCredentialLabel,
} from './provider-credentials';

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
  imports: [
    ReadOnlySectionDirective,
    ReactiveFormsModule,
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlField,
    FlAlert,
    FlButton,
    FlIcon,
    FlStatus,
  ],
  providers: [provideIcons({ lucideEye, lucideEyeOff })],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Credentials">
      <button
        panelActions
        flButton
        size="sm"
        type="button"
        appReadOnlySection="providers"
        [attr.aria-expanded]="showRotateForm()"
        (click)="showRotateForm.set(!showRotateForm())"
      >
        {{ showRotateForm() ? 'Close' : 'Rotate credentials' }}
      </button>

      <div class="fl-stack">
        <fl-key-value>
          <fl-kv-item key="Type">{{ credentialTypeLabel() }}</fl-kv-item>
          <fl-kv-item key="Connected">{{ formatDate(configuration().createdAt) }}</fl-kv-item>
          <fl-kv-item key="Key expiry">
            @if (configuration().credentialsExpiresAt) {
              <fl-status
                [tone]="expiryStatusTone()"
                [label]="
                  formatDate(configuration().credentialsExpiresAt) +
                  ' (' +
                  expiryRelativeLabel() +
                  ')'
                "
              />
            } @else {
              <span class="text-fl-ink-muted">Not set</span>
            }
          </fl-kv-item>
        </fl-key-value>

        <div class="fl-row flex-wrap">
          <button
            flButton
            size="sm"
            type="button"
            appReadOnlySection="providers"
            [attr.aria-expanded]="showExpiryForm()"
            (click)="showExpiryForm.set(!showExpiryForm())"
          >
            {{ configuration().credentialsExpiresAt ? 'Change expiry date' : 'Set expiry date' }}
          </button>
          @if (configuration().credentialsExpiresAt) {
            <button
              flButton="ghost"
              size="sm"
              type="button"
              [disabled]="isSavingExpiry()"
              (click)="clearExpiry()"
            >
              Clear expiry
            </button>
          }
        </div>

        @if (showExpiryForm()) {
          <div class="flex flex-wrap items-end gap-2">
            <fl-field label="Expiry date" for="credentials-expiry-date">
              <span class="fl-input fl-input--lg">
                <input
                  id="credentials-expiry-date"
                  type="date"
                  [value]="expiryInputValue()"
                  (change)="onExpiryChange($event)"
                />
              </span>
            </fl-field>
            <button
              flButton
              type="button"
              [disabled]="isSavingExpiry() || !pendingExpiry()"
              (click)="saveExpiry()"
            >
              {{ isSavingExpiry() ? 'Saving…' : 'Save expiry' }}
            </button>
          </div>
        }
        @if (expiryError()) {
          <fl-alert tone="error" title="Could not update the expiry">{{ expiryError() }}</fl-alert>
        }

        @if (showRotateForm()) {
          <form
            [formGroup]="rotateForm"
            (ngSubmit)="rotate()"
            class="fl-stack border-t border-fl-border pt-4"
          >
            <p class="text-fl-body-sm text-fl-ink-muted">
              Enter new credentials from the {{ provider().displayName }} console. They replace the
              saved ones.
            </p>
            @for (field of credentialFields(); track field.key) {
              <fl-field
                [label]="
                  (field.providerLabel || field.label) + (field.required ? '' : ' (optional)')
                "
                [for]="'rotate-' + field.key"
                [hint]="field.hint"
              >
                <span class="fl-input fl-input--lg">
                  <input
                    [id]="'rotate-' + field.key"
                    [type]="field.secret && !showPasswords()[field.key] ? 'password' : 'text'"
                    [formControlName]="field.key"
                    autocomplete="off"
                    spellcheck="false"
                  />
                  @if (field.secret) {
                    <button
                      type="button"
                      class="inline-flex text-fl-ink-muted hover:text-fl-ink"
                      [attr.aria-label]="showPasswords()[field.key] ? 'Hide value' : 'Show value'"
                      (click)="togglePwd(field.key)"
                    >
                      <fl-icon [name]="showPasswords()[field.key] ? 'lucideEyeOff' : 'lucideEye'" />
                    </button>
                  }
                </span>
              </fl-field>
            }

            @if (supportsExpiry()) {
              <fl-field label="Expiry date (optional)" for="rotate-expires-at">
                <span class="fl-input fl-input--lg">
                  <input id="rotate-expires-at" type="date" formControlName="expiresAt" />
                </span>
              </fl-field>
            }

            @if (rotateError()) {
              <fl-alert tone="error" title="Could not rotate the credentials">{{
                rotateError()
              }}</fl-alert>
            }

            <div class="flex justify-end gap-2">
              <button flButton="ghost" type="button" (click)="showRotateForm.set(false)">
                Cancel
              </button>
              <button
                flButton="primary"
                type="submit"
                [disabled]="rotateForm.invalid || isRotating()"
              >
                {{ isRotating() ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </form>
        }
      </div>
    </fl-panel>
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
    const schema = (
      this.provider() as unknown as { credentialFields?: { fields?: CredentialField[] } }
    ).credentialFields;
    if (schema?.fields?.length) return schema.fields;
    return this.fallbackFields();
  });

  protected supportsExpiry = computed(() => {
    const schema = (
      this.provider() as unknown as { credentialFields?: { supportsExpiry?: boolean } }
    ).credentialFields;
    if (schema && typeof schema.supportsExpiry === 'boolean') return schema.supportsExpiry;
    const type = this.configuration().credentialsType as string | undefined;
    return type === 'api_key' || type === 'access_key_secret';
  });

  protected credentialTypeLabel = computed(() =>
    savedCredentialLabel(this.configuration().credentialsType),
  );

  protected expiryDaysLeft = computed<number | null>(() =>
    expiryDaysLeft(this.configuration().credentialsExpiresAt),
  );

  protected expiryRelativeLabel = computed(() => expiryRelativeLabel(this.expiryDaysLeft()));

  protected expiryStatusTone = computed(() => expiryTone(this.expiryDaysLeft()));

  protected expiryInputValue = computed(() =>
    dateInputValue(this.configuration().credentialsExpiresAt),
  );

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
      this.expiryError.set(errorMessageOf(e, 'Failed to update expiry.'));
    } finally {
      this.isSavingExpiry.set(false);
    }
  }

  async clearExpiry(): Promise<void> {
    this.isSavingExpiry.set(true);
    this.expiryError.set('');
    try {
      const config = await this.providersService.updateCredentialsExpiry(this.provider().id, {
        expiresAt: null,
      });
      this.updated.emit(config);
    } catch (e: unknown) {
      this.expiryError.set(errorMessageOf(e, 'Failed to clear expiry.'));
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
        type: (this.configuration().credentialsType ??
          'api_key') as ProviderCredentialsDto.TypeEnum,
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
      this.rotateError.set(errorMessageOf(e, 'Failed to rotate credentials.'));
    } finally {
      this.isRotating.set(false);
    }
  }

  togglePwd(key: string): void {
    this.showPasswords.update((s) => ({ ...s, [key]: !s[key] }));
  }

  protected formatDate(value: string | undefined): string {
    return formatDateTime(value);
  }

  private fallbackFields(): CredentialFieldDefinition[] {
    return fallbackCredentialFields(
      this.configuration().credentialsType as string | undefined,
      this.provider().displayName,
    );
  }
}
