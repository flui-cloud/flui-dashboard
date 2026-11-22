import { Component, OnInit, computed, inject, signal, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideX } from '@ng-icons/lucide';
import { GithubAppOAuthService } from '../../../core/services/github-app-oauth.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

export type GhcrPatModalMode = 'create' | 'rotate' | 'update-expiry';

const GHCR_PAT_CREATE_URL =
  'https://github.com/settings/tokens/new?scopes=read:packages,delete:packages&description=Flui+GHCR+pull';

const TODAY_PLUS_DAYS = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

@Component({
  selector: 'app-ghcr-pat-modal',
  imports: [FormsModule, FlAlert, FlField, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideExternalLink, lucideX })],
  host: { '(document:keydown.escape)': 'onBackdrop()' },
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="onBackdrop()"
    >
      <div
        class="fl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ghcr-pat-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="ghcr-pat-title">{{ title() }}</h2>
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
          @if (mode() !== 'update-expiry') {
            <p>
              Flui needs a classic token with
              <span class="fl-mono">read:packages</span> (or
              <span class="fl-mono">write:packages</span>) and
              <span class="fl-mono">delete:packages</span>: GitHub App tokens cannot pull or delete
              private container packages outside GitHub Actions.
            </p>
            <a
              class="fl-link inline-flex items-center gap-1"
              [href]="patCreateUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              Create the token on GitHub
              <fl-icon name="lucideExternalLink" [size]="14" />
            </a>

            <fl-field label="Personal access token" for="ghcr-pat-token">
              <div class="fl-input fl-input--lg">
                <input
                  id="ghcr-pat-token"
                  type="password"
                  autocomplete="off"
                  placeholder="ghp_…"
                  [ngModel]="token()"
                  (ngModelChange)="token.set($event)"
                  [disabled]="busy()"
                />
              </div>
            </fl-field>
          }

          <fl-field
            label="Token expiration date"
            for="ghcr-pat-expiry"
            hint="Match the expiration set on GitHub. Flui warns you 14 days before."
          >
            <div class="fl-input fl-input--lg">
              <input
                id="ghcr-pat-expiry"
                type="date"
                [ngModel]="expiresAt()"
                (ngModelChange)="expiresAt.set($event)"
                [min]="minDate"
                [disabled]="busy()"
              />
            </div>
          </fl-field>

          @if (errorMsg()) {
            <fl-alert tone="error" title="Could not save the token">{{ errorMsg() }}</fl-alert>
          }
        </div>

        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" [disabled]="busy()" (click)="cancelled.emit()">
            Cancel
          </button>
          <button
            flButton="primary"
            type="button"
            [disabled]="busy() || !canSubmit()"
            (click)="submit()"
          >
            @if (busy()) {
              <fl-spinner label="Saving" />
              Saving…
            } @else {
              {{ submitLabel() }}
            }
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class GhcrPatModalComponent implements OnInit {
  readonly mode = input.required<GhcrPatModalMode>();
  readonly initialExpiresAt = input<string | null | undefined>(null);

  readonly cancelled = output<void>();
  readonly saved = output<void>();

  private readonly oauthApi = inject(GithubAppOAuthService);

  readonly patCreateUrl = GHCR_PAT_CREATE_URL;
  readonly minDate = TODAY_PLUS_DAYS(1);

  readonly token = signal('');
  readonly expiresAt = signal('');

  readonly busy = signal(false);
  readonly errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    const initialExpiresAt = this.initialExpiresAt();
    this.expiresAt.set(initialExpiresAt ? initialExpiresAt.slice(0, 10) : TODAY_PLUS_DAYS(30));
  }

  readonly title = computed(() => {
    switch (this.mode()) {
      case 'rotate':
        return 'Rotate GHCR token';
      case 'update-expiry':
        return 'Update token expiration';
      default:
        return 'Connect GHCR token';
    }
  });

  readonly submitLabel = computed(() => {
    switch (this.mode()) {
      case 'rotate':
        return 'Rotate token';
      case 'update-expiry':
        return 'Update expiration';
      default:
        return 'Save token';
    }
  });

  readonly canSubmit = computed(() => {
    if (!this.expiresAt()) return false;
    if (this.mode() === 'update-expiry') return true;
    return this.token().trim().length > 0;
  });

  onBackdrop(): void {
    if (this.busy()) return;
    this.cancelled.emit();
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    this.errorMsg.set(null);
    const expiresIso = new Date(this.expiresAt()).toISOString();
    const token = this.token().trim();
    try {
      const mode = this.mode();
      if (mode === 'create') {
        await this.oauthApi.savePackagesPat(token, expiresIso);
      } else if (mode === 'rotate') {
        await this.oauthApi.rotatePackagesPat(token, expiresIso);
      } else {
        await this.oauthApi.updatePackagesPatExpiry(expiresIso);
      }
      this.saved.emit();
    } catch (err: unknown) {
      const e = err as { error?: { message?: string }; message?: string } | null;
      this.errorMsg.set(
        e?.error?.message ||
          e?.message ||
          'Make sure it has the read:packages and delete:packages scopes and the expiration is in the future.',
      );
      this.busy.set(false);
    }
  }
}
