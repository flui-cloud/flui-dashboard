import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideAlertCircle } from '@ng-icons/lucide';
import { AuthService } from '../../../core/services/auth.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import {
  HlmCardDirective,
  HlmCardContentDirective,
  HlmCardHeaderDirective,
  HlmCardTitleDirective,
  HlmCardDescriptionDirective,
} from '@spartan-ng/ui-card-helm';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
import { HlmLabelDirective } from '@spartan-ng/ui-label-helm';

@Component({
  selector: 'app-profile-tab',
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
  providers: [provideIcons({ lucideCheck, lucideAlertCircle })],
  template: `
    <div hlmCard>
      <div hlmCardHeader>
        <h3 hlmCardTitle>Profile information</h3>
        <p hlmCardDescription>Update your display name.</p>
      </div>
      <div hlmCardContent class="space-y-5">

        <!-- Email (read-only) -->
        <div class="space-y-1.5">
          <label hlmLabel>Email</label>
          <input hlmInput class="w-full" [value]="_email()" disabled />
          <p class="text-xs text-muted-foreground">Email cannot be changed here.</p>
        </div>

        @if (_isLocal()) {
          <!-- Name form -->
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <div class="space-y-1.5">
              <label hlmLabel for="name">Display name</label>
              <input
                hlmInput
                id="name"
                formControlName="name"
                placeholder="Your name"
                class="w-full"
                [class.border-destructive]="isInvalid('name')"
              />
              @if (isInvalid('name')) {
                <p class="text-xs text-destructive">
                  @if (form.get('name')?.hasError('required')) { Name is required. }
                  @else if (form.get('name')?.hasError('minlength')) { Minimum 2 characters. }
                </p>
              }
            </div>

            @if (error()) {
              <div class="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <ng-icon name="lucideAlertCircle" class="h-4 w-4 shrink-0" />
                {{ error() }}
              </div>
            }

            @if (saved()) {
              <div class="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
                <ng-icon name="lucideCheck" class="h-4 w-4 shrink-0" />
                Profile updated successfully.
              </div>
            }

            <button
              type="submit"
              class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              [disabled]="saving()"
            >
              {{ saving() ? 'Saving...' : 'Save changes' }}
            </button>
          </form>
        } @else {
          <!-- OIDC: sola lettura -->
          <div class="space-y-1.5">
            <label hlmLabel>Display name</label>
            <input hlmInput class="w-full" [value]="_name()" disabled />
          </div>
          <p class="text-sm text-muted-foreground">
            Your profile is managed by your sign-in provider. To change your name or email,
            update them
            @if (_oidcIssuer()) {
              on <a [href]="_oidcIssuer()" target="_blank" rel="noopener noreferrer"
                class="font-medium text-primary underline-offset-4 hover:underline">your provider's account page</a>.
            } @else {
              on your provider's account page.
            }
          </p>
        }
      </div>
    </div>
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
  protected readonly _oidcIssuer = computed(() => this.cfg.oidcIssuer || '');

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
  });

  ngOnInit(): void {
    const name = this.authService.currentUser()?.name ?? '';
    this.form.patchValue({ name });
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
