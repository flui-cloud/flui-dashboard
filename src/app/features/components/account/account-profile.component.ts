import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HlmCardContentDirective, HlmCardDirective } from '@spartan-ng/ui-card-helm';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
import { HlmLabelDirective } from '@spartan-ng/ui-label-helm';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import {
  AccountProfile,
  AccountService,
  accountErrorMessage,
} from '../../service/account.service';

@Component({
  selector: 'app-account-profile',
  host: { class: 'block' },
  standalone: true,
  imports: [
    FormsModule,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmInputDirective,
    HlmLabelDirective,
    HlmButtonDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div hlmCard>
      <form hlmCardContent class="pt-6 space-y-4" (ngSubmit)="save()" data-testid="profile-form">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label hlmLabel for="firstName">First name</label>
            <input hlmInput id="firstName" name="firstName" class="w-full" [(ngModel)]="firstName" required />
          </div>
          <div class="space-y-1.5">
            <label hlmLabel for="lastName">Last name</label>
            <input hlmInput id="lastName" name="lastName" class="w-full" [(ngModel)]="lastName" required />
          </div>
        </div>
        <div class="space-y-1.5">
          <label hlmLabel for="displayName">Display name</label>
          <input
            hlmInput
            id="displayName"
            name="displayName"
            class="w-full"
            [(ngModel)]="displayName"
            [placeholder]="firstName + ' ' + lastName"
          />
        </div>
        <div class="space-y-1.5">
          <label hlmLabel for="email">Email</label>
          <input hlmInput id="email" class="w-full" [value]="profile().email ?? ''" disabled />
          @if (profile().email && !profile().emailVerified) {
            <p class="text-xs text-muted-foreground">Not verified yet.</p>
          }
        </div>
        @if (error()) {
          <p class="text-sm text-destructive" data-testid="profile-error">{{ error() }}</p>
        }
        @if (saved()) {
          <p class="text-sm text-green-600 dark:text-green-400" data-testid="profile-saved">Saved.</p>
        }
        <button hlmBtn type="submit" [disabled]="saving() || !firstName.trim() || !lastName.trim()">
          {{ saving() ? 'Saving...' : 'Save' }}
        </button>
      </form>
    </div>
  `,
})
export class AccountProfileComponent {
  private readonly account = inject(AccountService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = input.required<AccountProfile>();
  readonly changed = output<AccountProfile>();

  protected firstName = '';
  protected lastName = '';
  protected displayName = '';
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const p = this.profile();
      this.firstName = p.firstName ?? '';
      this.lastName = p.lastName ?? '';
      this.displayName = p.displayName ?? '';
    });
  }

  save(): void {
    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();
    if (!firstName || !lastName) return;
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    this.account
      .updateProfile({
        firstName,
        lastName,
        displayName: this.displayName.trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.saving.set(false);
          this.saved.set(true);
          this.changed.emit(profile);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(accountErrorMessage(err, 'Your name could not be saved.'));
        },
      });
  }
}
