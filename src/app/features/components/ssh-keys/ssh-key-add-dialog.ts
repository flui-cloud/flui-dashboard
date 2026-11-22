import { Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { ProviderRef } from './ssh-keys-rows';

export interface NewKeyRequest {
  readonly name: string;
  readonly userName: string;
  readonly providers: readonly string[];
}

@Component({
  selector: 'app-ssh-key-add-dialog',
  imports: [ReactiveFormsModule, FlAlert, FlField, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="cancelled.emit()"
    >
      <form
        class="fl-dialog fl-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ssh-key-add-title"
        [formGroup]="form"
        (ngSubmit)="submit()"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="ssh-key-add-title">Add SSH key</h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            (click)="cancelled.emit()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>

        <div class="fl-dialog__body">
          @if (error()) {
            <fl-alert tone="error" title="Key not created">{{ error() }}</fl-alert>
          }
          <div class="fl-grid-2">
            <fl-field
              label="Name"
              for="ssh-key-name"
              [error]="state().nameError ? 'Use at least 3 characters.' : null"
            >
              <div class="fl-input fl-input--lg">
                <input
                  id="ssh-key-name"
                  type="text"
                  formControlName="name"
                  placeholder="my-ssh-key"
                  autocomplete="off"
                />
              </div>
            </fl-field>
            <fl-field
              label="User name"
              for="ssh-key-user"
              [error]="state().userError ? 'Enter a user name.' : null"
            >
              <div class="fl-input fl-input--lg">
                <input
                  id="ssh-key-user"
                  type="text"
                  formControlName="userName"
                  placeholder="admin"
                  autocomplete="off"
                />
              </div>
            </fl-field>
          </div>

          <fieldset class="fl-fieldset">
            <legend>Method</legend>
            <label class="fl-radiocard">
              <input type="radio" formControlName="generateNew" [value]="true" />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">Generate a new key pair</span>
                <span class="fl-radiocard__desc">
                  The server generates the pair. The private key can be downloaded once it exists.
                </span>
              </span>
            </label>
            <label class="fl-radiocard">
              <input type="radio" formControlName="generateNew" [value]="false" />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">Import an existing public key</span>
                <span class="fl-radiocard__desc">Paste a public key you already use.</span>
              </span>
            </label>
          </fieldset>

          @if (!state().generateNew) {
            <fl-field
              label="Public key"
              for="ssh-key-public"
              hint="Paste your SSH public key."
              [error]="state().publicKeyError ? 'Paste a public key.' : null"
            >
              <textarea
                id="ssh-key-public"
                class="fl-textarea fl-mono"
                rows="4"
                formControlName="publicKey"
                placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA…"
                spellcheck="false"
              ></textarea>
            </fl-field>
            <fl-alert tone="warning" title="Import is not available yet">
              The API only generates new keys for now. Importing a public key comes in a later
              update.
            </fl-alert>
          }

          @if (providers().length > 0) {
            <fieldset class="fl-fieldset">
              <legend>Sync to providers</legend>
              <span class="text-fl-caption text-fl-ink-muted">
                Leave all unchecked to sync to every configured provider.
              </span>
              <div class="fl-row">
                @for (p of providers(); track p.id) {
                  <label class="fl-check">
                    <input
                      type="checkbox"
                      [checked]="selected().includes(p.id)"
                      (change)="toggleProvider(p.id)"
                    />
                    <span>{{ p.displayName }}</span>
                  </label>
                }
              </div>
            </fieldset>
          }
        </div>

        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
          <button
            flButton="primary"
            type="submit"
            [disabled]="state().invalid || !state().generateNew || saving()"
          >
            @if (saving()) {
              <fl-spinner label="Generating" />
              Generating…
            } @else {
              Generate key
            }
          </button>
        </footer>
      </form>
    </div>
  `,
})
export class SshKeyAddDialog {
  readonly providers = input.required<readonly ProviderRef[]>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly submitted = output<NewKeyRequest>();
  readonly cancelled = output<void>();

  protected readonly form = inject(FormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    userName: ['', [Validators.required]],
    publicKey: [''],
    generateNew: [true],
  });

  protected readonly selected = signal<string[]>([]);
  private readonly formEvent = toSignal(this.form.events, { initialValue: null });

  protected readonly state = computed(() => {
    this.formEvent();
    const c = this.form.controls;
    return {
      generateNew: !!c.generateNew.value,
      invalid: this.form.invalid,
      nameError: c.name.invalid && c.name.touched,
      userError: c.userName.invalid && c.userName.touched,
      publicKeyError: c.publicKey.invalid && c.publicKey.touched,
    };
  });

  constructor() {
    this.form.controls.generateNew.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((generateNew) => {
        const publicKey = this.form.controls.publicKey;
        if (generateNew) {
          publicKey.clearValidators();
          publicKey.setValue('');
        } else {
          publicKey.setValidators([Validators.required]);
        }
        publicKey.updateValueAndValidity();
      });
  }

  protected toggleProvider(id: string): void {
    this.selected.update((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );
  }

  protected submit(): void {
    if (this.form.invalid) return;
    const { name, userName } = this.form.getRawValue();
    this.submitted.emit({
      name: name ?? '',
      userName: userName ?? '',
      providers: this.selected(),
    });
  }
}
