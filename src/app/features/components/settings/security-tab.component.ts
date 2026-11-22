import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { AppConfigService } from '../../../core/services/app-config.service';
import { AuthService as ApiAuthService } from '../../../core/api/api/auth.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

function passwordMatchValidator(ctrl: AbstractControl): ValidationErrors | null {
  const newPwd = ctrl.get('newPassword')?.value;
  const confirm = ctrl.get('confirmPassword')?.value;
  if (newPwd && confirm && newPwd !== confirm) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-security-tab',
  imports: [ReactiveFormsModule, FlAlert, FlField, FlPanel, FlButton, FlSpinner, FlStatus],
  host: { class: 'fl-stack' },
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <fl-panel title="Change password">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex max-w-md flex-col gap-4">
        <fl-field
          label="Current password"
          for="currentPassword"
          [error]="isInvalid('currentPassword') ? 'Current password is required.' : null"
        >
          <div class="fl-input fl-input--lg">
            <input
              id="currentPassword"
              type="password"
              formControlName="currentPassword"
              autocomplete="current-password"
            />
          </div>
        </fl-field>

        <fl-field
          label="New password"
          for="newPassword"
          hint="At least 8 characters."
          [error]="newPasswordError()"
        >
          <div class="fl-input fl-input--lg">
            <input
              id="newPassword"
              type="password"
              formControlName="newPassword"
              autocomplete="new-password"
            />
          </div>
        </fl-field>

        <fl-field label="Confirm new password" for="confirmPassword" [error]="confirmError()">
          <div class="fl-input fl-input--lg">
            <input
              id="confirmPassword"
              type="password"
              formControlName="confirmPassword"
              autocomplete="new-password"
            />
          </div>
        </fl-field>

        @if (error()) {
          <fl-alert tone="error" title="Password not changed">{{ error() }}</fl-alert>
        }

        <div class="flex flex-wrap items-center gap-3">
          <button flButton="primary" type="submit" [disabled]="saving()">
            @if (saving()) {
              <fl-spinner label="Updating" />
            }
            {{ saving() ? 'Updating…' : 'Update password' }}
          </button>
          @if (success()) {
            <fl-status tone="success" label="Password changed" />
          }
        </div>
      </form>
    </fl-panel>
  `,
})
export class SecurityTabComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cfg = inject(AppConfigService);
  private readonly apiAuth = inject(ApiAuthService);

  readonly saving = signal(false);
  readonly success = signal(false);
  readonly error = signal<string | null>(null);

  form = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator },
  );

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  protected newPasswordError(): string | null {
    if (!this.isInvalid('newPassword')) return null;
    if (this.form.get('newPassword')?.hasError('required')) return 'New password is required.';
    if (this.form.get('newPassword')?.hasError('minlength')) return 'Minimum 8 characters.';
    return null;
  }

  protected confirmError(): string | null {
    if (this.isInvalid('confirmPassword')) return 'Please confirm your new password.';
    if (this.hasMismatch()) return 'Passwords do not match.';
    return null;
  }

  hasMismatch(): boolean {
    return !!(this.form.errors?.['passwordMismatch'] && this.form.get('confirmPassword')?.touched);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving.set(true);
    this.success.set(false);
    this.error.set(null);

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.apiAuth.authControllerChangePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(true);
        this.form.reset();
        setTimeout(() => this.success.set(false), 4000);
      },
      error: (err) => {
        this.saving.set(false);
        if (err?.status === 401) {
          this.error.set('Current password is incorrect.');
        } else {
          this.error.set('Failed to change password. Please try again.');
        }
      },
    });
  }
}
