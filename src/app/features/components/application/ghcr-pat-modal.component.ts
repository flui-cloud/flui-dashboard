import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideKey,
  lucideExternalLink,
  lucideAlertCircle,
  lucideX,
  lucideLoader,
  lucideRefreshCw,
  lucideCalendar,
} from '@ng-icons/lucide';
import { GithubAppOAuthService } from '../../../core/services/github-app-oauth.service';

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
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideKey,
      lucideExternalLink,
      lucideAlertCircle,
      lucideX,
      lucideLoader,
      lucideRefreshCw,
      lucideCalendar,
    }),
  ],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" (click)="onBackdrop($event)">
      <div class="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full shadow-xl" (click)="$event.stopPropagation()">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 class="text-base font-semibold text-slate-900 dark:text-white">{{ title() }}</h3>
          <button (click)="cancelled.emit()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <ng-icon name="lucideX" class="h-5 w-5" />
          </button>
        </div>

        <div class="p-5 space-y-3">
          @if (mode !== 'update-expiry') {
            <a
              [href]="patCreateUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Create a classic token with read:packages and delete:packages
              <ng-icon name="lucideExternalLink" class="h-3 w-3" />
            </a>

            <div>
              <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Personal Access Token
              </label>
              <input
                type="password"
                [(ngModel)]="token"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                [disabled]="busy()"
                class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>
          }

          <div>
            <label class="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Token expiration date
            </label>
            <input
              type="date"
              [(ngModel)]="expiresAt"
              [min]="minDate"
              [disabled]="busy()"
              class="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Match the expiration you set on GitHub. We'll warn you 14 days before.
            </p>
          </div>

          @if (mode !== 'update-expiry') {
            <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Required scopes: <span class="font-mono">read:packages</span>
                (or <span class="font-mono">write:packages</span>)
                and <span class="font-mono">delete:packages</span>.
              </p>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Needed because GitHub App tokens can't pull or delete private container packages outside of GitHub Actions.
              </p>
            </div>
          }

          @if (errorMsg()) {
            <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <ng-icon name="lucideAlertCircle" class="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p class="text-xs text-red-700 dark:text-red-400">{{ errorMsg() }}</p>
            </div>
          }
        </div>

        <div class="flex items-center justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700">
          <button
            (click)="cancelled.emit()"
            [disabled]="busy()"
            class="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            (click)="submit()"
            [disabled]="busy() || !canSubmit()"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            @if (busy()) {
              <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
              <span>Saving…</span>
            } @else {
              <ng-icon [name]="mode === 'rotate' ? 'lucideRefreshCw' : (mode === 'update-expiry' ? 'lucideCalendar' : 'lucideKey')" class="h-4 w-4" />
              <span>{{ submitLabel() }}</span>
            }
          </button>
        </div>
      </div>
    </div>
  `,
})
export class GhcrPatModalComponent implements OnInit {
  @Input({ required: true }) mode: GhcrPatModalMode = 'create';
  @Input() initialExpiresAt: string | null | undefined = null;

  @Output() cancelled = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly oauthApi = inject(GithubAppOAuthService);

  readonly patCreateUrl = GHCR_PAT_CREATE_URL;
  readonly minDate = TODAY_PLUS_DAYS(1);

  token = '';
  expiresAt = '';

  busy = signal(false);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    if (this.initialExpiresAt) {
      this.expiresAt = this.initialExpiresAt.slice(0, 10);
    } else {
      this.expiresAt = TODAY_PLUS_DAYS(90);
    }
  }

  title = computed(() => {
    switch (this.mode) {
      case 'rotate': return 'Rotate GHCR token';
      case 'update-expiry': return 'Update token expiration';
      default: return 'Connect GHCR token';
    }
  });

  submitLabel = computed(() => {
    switch (this.mode) {
      case 'rotate': return 'Rotate token';
      case 'update-expiry': return 'Update expiration';
      default: return 'Save token';
    }
  });

  canSubmit(): boolean {
    if (!this.expiresAt) return false;
    if (this.mode === 'update-expiry') return true;
    return this.token.trim().length > 0;
  }

  onBackdrop(_event: MouseEvent): void {
    if (this.busy()) return;
    this.cancelled.emit();
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    this.errorMsg.set(null);
    const expiresIso = new Date(this.expiresAt).toISOString();
    try {
      if (this.mode === 'create') {
        await this.oauthApi.savePackagesPat(this.token.trim(), expiresIso);
      } else if (this.mode === 'rotate') {
        await this.oauthApi.rotatePackagesPat(this.token.trim(), expiresIso);
      } else {
        await this.oauthApi.updatePackagesPatExpiry(expiresIso);
      }
      this.saved.emit();
    } catch (err: any) {
      this.errorMsg.set(
        err?.error?.message ||
          err?.message ||
          'Could not save the token. Make sure it has read:packages and delete:packages scopes and the expiration is in the future.',
      );
      this.busy.set(false);
    }
  }
}
