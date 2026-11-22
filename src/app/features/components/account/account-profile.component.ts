import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { AccountProfile, AccountService, accountErrorMessage } from '../../service/account.service';

@Component({
  selector: 'app-account-profile',
  imports: [FormsModule, FlAlert, FlField, FlKeyValue, FlKvItem, FlPanel, FlButton, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Profile">
      <fl-key-value>
        <fl-kv-item key="Username" [mono]="true">{{ profile().userName }}</fl-kv-item>
        <fl-kv-item key="Email" [mono]="true">{{ profile().email ?? '—' }}</fl-kv-item>
        <fl-kv-item key="Email status">
          @if (!profile().email) {
            <fl-status tone="neutral" label="None on file" />
          } @else if (profile().emailVerified) {
            <fl-status tone="success" label="Verified" />
          } @else {
            <fl-status tone="warning" label="Not verified yet" />
          }
        </fl-kv-item>
        <fl-kv-item key="Display name">{{
          profile().displayName || nameOf(profile()) || '—'
        }}</fl-kv-item>
      </fl-key-value>
    </fl-panel>

    <fl-panel title="Name">
      <form class="flex max-w-xl flex-col gap-4" (ngSubmit)="save()" data-testid="profile-form">
        <div class="fl-grid-2">
          <fl-field label="First name" for="firstName">
            <div class="fl-input fl-input--lg">
              <input id="firstName" name="firstName" [(ngModel)]="firstName" required />
            </div>
          </fl-field>
          <fl-field label="Last name" for="lastName">
            <div class="fl-input fl-input--lg">
              <input id="lastName" name="lastName" [(ngModel)]="lastName" required />
            </div>
          </fl-field>
        </div>
        <fl-field
          label="Display name"
          for="displayName"
          hint="Shown across the console. Leave empty to use your full name."
        >
          <div class="fl-input fl-input--lg">
            <input
              id="displayName"
              name="displayName"
              [(ngModel)]="displayName"
              [placeholder]="firstName + ' ' + lastName"
            />
          </div>
        </fl-field>
        @if (error()) {
          <fl-alert tone="error" title="Could not save your name" data-testid="profile-error">{{
            error()
          }}</fl-alert>
        }
        <div class="flex items-center gap-3">
          <button
            flButton
            type="submit"
            [disabled]="saving() || !firstName.trim() || !lastName.trim()"
          >
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
          @if (saved()) {
            <fl-status tone="success" label="Saved" data-testid="profile-saved" />
          }
        </div>
      </form>
    </fl-panel>
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

  protected nameOf(p: AccountProfile): string {
    return [p.firstName, p.lastName].filter(Boolean).join(' ');
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
