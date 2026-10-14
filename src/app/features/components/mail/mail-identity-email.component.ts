import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideKeyRound, lucideRefreshCw } from '@ng-icons/lucide';
import { MailConsoleService } from '../../service/mail-console.service';
import { MailIdentityStatus } from '../../model/mail-console.models';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { consoleError } from './mail-format';
import { mailIdentityView } from './mail-identity-email-view';

const TONE: Record<string, string> = {
  ok: 'bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  warn: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400',
  error: 'bg-destructive/10 text-destructive',
  idle: 'bg-muted text-muted-foreground',
};

@Component({
  selector: 'app-mail-identity-email',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, DatePipe, ReadOnlySectionDirective],
  providers: [provideIcons({ lucideKeyRound, lucideRefreshCw })],
  template: `
    <div class="mb-4 rounded-lg border border-border bg-card px-4 py-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <ng-icon name="lucideKeyRound" class="h-4 w-4 text-muted-foreground" />
            <span class="font-medium text-foreground">Sign-in emails</span>
            @if (view(); as v) {
              <span class="rounded-md px-1.5 py-0.5 text-[11px]" [class]="toneClass()">
                {{ v.badge }}
              </span>
            }
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            Verification and password reset emails
            @if (view()?.provider; as provider) {
              are sent through <span class="text-foreground">{{ provider }}</span>.
            } @else {
              are sent through your transactional provider.
            }
          </p>
          @if (view()?.note; as note) {
            <p class="mt-1 text-xs text-amber-700 dark:text-amber-400">{{ note }}</p>
          }
          @if (status()?.lastDeliveryAt; as at) {
            <p class="mt-1 text-xs text-muted-foreground">Last sent {{ at | date: 'medium' }}</p>
          }
          @if (error()) {
            <p class="mt-1 text-xs text-destructive">{{ error() }}</p>
          }
        </div>
        <button
          appReadOnlySection="mail"
          type="button"
          (click)="sync()"
          [disabled]="syncing() || loading()"
          class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="syncing()" />
          Sync
        </button>
      </div>
    </div>
  `,
})
export class MailIdentityEmailComponent implements OnInit {
  private readonly api = inject(MailConsoleService);

  readonly status = signal<MailIdentityStatus | null>(null);
  readonly loading = signal(false);
  readonly syncing = signal(false);
  readonly error = signal<string | null>(null);

  readonly view = computed(() => {
    const status = this.status();
    return status ? mailIdentityView(status) : null;
  });
  readonly toneClass = computed(() => TONE[this.view()?.tone ?? 'idle']);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.identity().subscribe({
      next: (status) => {
        this.status.set(status);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.loading.set(false);
      },
    });
  }

  sync(): void {
    this.syncing.set(true);
    this.api.syncIdentity().subscribe({
      next: (status) => {
        this.status.set(status);
        this.error.set(null);
        this.syncing.set(false);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.syncing.set(false);
      },
    });
  }
}
