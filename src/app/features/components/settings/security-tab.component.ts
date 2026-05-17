import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideAlertCircle, lucideShield } from '@ng-icons/lucide';
import { AppConfigService } from '../../../core/services/app-config.service';
import { AuthService as ApiAuthService } from '../../../core/api/api/auth.service';
import {
  HlmCardDirective,
  HlmCardContentDirective,
  HlmCardHeaderDirective,
  HlmCardTitleDirective,
  HlmCardDescriptionDirective,
} from '@spartan-ng/ui-card-helm';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
import { HlmLabelDirective } from '@spartan-ng/ui-label-helm';

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
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmCardHeaderDirective,
    HlmCardTitleDirective,
    HlmCardDescriptionDirective,
    HlmInputDirective,
    HlmLabelDirective,
  ],
  providers: [provideIcons({ lucideCheck, lucideAlertCircle, lucideShield })],
  template: `
    <div hlmCard>
      <div hlmCardHeader>
        <h3 hlmCardTitle>Change password</h3>
        <p hlmCardDescription>Update your account password.</p>
      </div>
      <div hlmCardContent>
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">

          <div class="space-y-1.5">
            <label hlmLabel for="currentPassword">Current password</label>
            <input
              hlmInput
              id="currentPassword"
              type="password"
              formControlName="currentPassword"
              placeholder="••••••••"
              class="w-full"
              [class.border-destructive]="isInvalid('currentPassword')"
            />
            @if (isInvalid('currentPassword')) {
              <p class="text-xs text-destructive">Current password is required.</p>
            }
          </div>

          <div class="space-y-1.5">
            <label hlmLabel for="newPassword">New password</label>
            <input
              hlmInput
              id="newPassword"
              type="password"
              formControlName="newPassword"
              placeholder="••••••••"
              class="w-full"
              [class.border-destructive]="isInvalid('newPassword')"
            />
            @if (isInvalid('newPassword')) {
              <p class="text-xs text-destructive">
                @if (form.get('newPassword')?.hasError('required')) { New password is required. }
                @else if (form.get('newPassword')?.hasError('minlength')) { Minimum 8 characters. }
              </p>
            }
          </div>

          <div class="space-y-1.5">
            <label hlmLabel for="confirmPassword">Confirm new password</label>
            <input
              hlmInput
              id="confirmPassword"
              type="password"
              formControlName="confirmPassword"
              placeholder="••••••••"
              class="w-full"
              [class.border-destructive]="isInvalid('confirmPassword') || hasMismatch()"
            />
            @if (isInvalid('confirmPassword')) {
              <p class="text-xs text-destructive">Please confirm your new password.</p>
            } @else if (hasMismatch()) {
              <p class="text-xs text-destructive">Passwords do not match.</p>
            }
          </div>

          @if (error()) {
            <div class="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <ng-icon name="lucideAlertCircle" class="h-4 w-4 shrink-0" />
              {{ error() }}
            </div>
          }

          @if (success()) {
            <div class="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
              <ng-icon name="lucideCheck" class="h-4 w-4 shrink-0" />
              Password changed successfully.
            </div>
          }

          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            [disabled]="saving()"
          >
            {{ saving() ? 'Updating...' : 'Update password' }}
          </button>

        </form>
      </div>
    </div>
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
