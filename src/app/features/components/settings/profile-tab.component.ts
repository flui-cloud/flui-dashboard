import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-profile-tab',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlPanel,
    FlButton,
    FlSpinner,
    FlStatus,
  ],
  host: { class: 'fl-stack' },
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <fl-panel title="Profile information">
      <div class="flex flex-col gap-5">
        <fl-key-value>
          <fl-kv-item key="Email">{{ _email() || '—' }}</fl-kv-item>
          @if (!_isLocal()) {
            <fl-kv-item key="Display name">{{ _name() || '—' }}</fl-kv-item>
          }
        </fl-key-value>

        @if (_isLocal()) {
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex max-w-md flex-col gap-4">
            <fl-field label="Display name" for="name" [error]="nameError()">
              <div class="fl-input fl-input--lg">
                <input id="name" formControlName="name" placeholder="Your name" />
              </div>
            </fl-field>

            @if (error()) {
              <fl-alert tone="error" title="Profile not saved">{{ error() }}</fl-alert>
            }

            <div class="flex flex-wrap items-center gap-3">
              <button flButton="primary" type="submit" [disabled]="saving()">
                @if (saving()) {
                  <fl-spinner label="Saving" />
                }
                {{ saving() ? 'Saving…' : 'Save changes' }}
              </button>
              @if (saved()) {
                <fl-status tone="success" label="Profile updated" />
              }
            </div>
          </form>
        } @else {
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            Change your name, password and sign-in options in
            <a routerLink="/account" class="fl-link">your account</a>.
          </p>
        }
      </div>
    </fl-panel>
  `,
})
export class ProfileTabComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly cfg = inject(AppConfigService);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);

  protected readonly _isLocal = computed(() => this.cfg.authMode === 'local');
  protected readonly _email = computed(() => this.authService.currentUser()?.email ?? '');
  protected readonly _name = computed(() => this.authService.currentUser()?.name ?? '');

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
  });

  ngOnInit(): void {
    const name = this.authService.currentUser()?.name ?? '';
    this.form.patchValue({ name });
  }

  protected nameError(): string | null {
    if (!this.isInvalid('name')) return null;
    if (this.form.get('name')?.hasError('required')) return 'Name is required.';
    if (this.form.get('name')?.hasError('minlength')) return 'Minimum 2 characters.';
    return null;
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);

    const { name } = this.form.getRawValue();
    this.authService.updateProfile(name).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 3000);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to update profile. Please try again.');
      },
    });
  }
}
