import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideRotateCcw,
  lucideSearch,
  lucideTriangleAlert,
  lucideUndo2,
} from '@ng-icons/lucide';
import { MailSectionNavComponent } from './mail-section-nav.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { MailConsoleService } from '../../service/mail-console.service';
import { MailSuppression } from '../../model/mail-console.models';
import { consoleError, whenLabel } from './mail-format';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  MailSuppressionsSurfaceInput,
  MailSuppressionsSurfaceRevision,
  buildMailSuppressionsSurface,
  presentedContent,
} from './mail-suppressions-surface';

const REASON_LABEL: Record<string, string> = {
  bounce: 'Bounced',
  complaint: 'Marked as spam',
  unsubscribe: 'Unsubscribed',
  manual: 'Added by hand',
};

@Component({
  selector: 'app-mail-suppressions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon, MailSectionNavComponent, ConfirmationDialogComponent],
  providers: [
    provideIcons({
      lucideRotateCcw,
      lucideSearch,
      lucideTriangleAlert,
      lucideUndo2,
    }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <app-mail-section-nav>
        <button
          slot="actions"
          type="button"
          (click)="load()"
          [disabled]="loading()"
          class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          <ng-icon
            name="lucideRotateCcw"
            class="h-3.5 w-3.5"
            [class.animate-spin]="loading()"
          />
          Refresh
        </button>
      </app-mail-section-nav>

      <p class="mb-4 max-w-3xl text-sm text-muted-foreground">
        Addresses Flui has stopped writing to, and how far the stop reaches.
        <span class="font-medium text-foreground">All</span> stops every message;
        <span class="font-medium text-foreground">bulk</span> stops one-to-many mail only — so
        someone who left a mailing list still gets the password reset they asked for thirty seconds
        ago.
      </p>

      @if (loading()) {
        <div class="mb-3 flex items-center gap-2">
          <div class="skeleton h-9 w-72"></div>
          <div class="skeleton h-3 w-20"></div>
        </div>
        <div class="overflow-hidden rounded-lg border border-border bg-card">
          <div class="border-b border-border px-4 py-2">
            <div class="skeleton h-3 w-40"></div>
          </div>
          @for (i of [1, 2, 3]; track i) {
            <div class="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0">
              <div class="skeleton h-4 flex-1"></div>
              <div class="skeleton h-4 w-32"></div>
              <div class="skeleton h-5 w-20"></div>
              <div class="skeleton h-4 w-24"></div>
              <div class="skeleton h-7 w-24"></div>
            </div>
          }
        </div>
      } @else if (error()) {
        <div
          class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ error() }}</span>
        </div>
      } @else if (!entries().length) {
        <p class="text-sm text-muted-foreground">
          Nothing is suppressed. Bounces and complaints land here on their own as they arrive.
        </p>
      } @else {
        <div class="mb-3 flex items-center gap-2">
          <div class="relative">
            <ng-icon
              name="lucideSearch"
              class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            />
            <input
              type="text"
              [(ngModel)]="query"
              (ngModelChange)="search.set($event)"
              placeholder="Filter by address"
              class="h-9 w-72 rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground"
            />
          </div>
          <span class="text-xs text-muted-foreground tabular-nums">
            {{ shown().length }} of {{ entries().length }}
          </span>
        </div>

        <div class="overflow-x-auto rounded-lg border border-border bg-card">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border text-left text-xs text-muted-foreground">
                <th class="px-4 py-2 font-medium">Address</th>
                <th class="px-4 py-2 font-medium">Why</th>
                <th class="px-4 py-2 font-medium">Reaches</th>
                <th class="px-4 py-2 font-medium">Since</th>
                <th class="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              @for (s of shown(); track s.address) {
                <tr class="border-b border-border/60 last:border-0">
                  <td class="px-4 py-2 font-mono text-xs text-foreground">{{ s.address }}</td>
                  <td class="px-4 py-2">
                    <div class="text-foreground">{{ reason(s) }}</div>
                    @if (s.detail) {
                      <div class="truncate font-mono text-[11px] text-muted-foreground" [title]="s.detail">
                        {{ s.detail }}
                      </div>
                    }
                  </td>
                  <td class="px-4 py-2">
                    <span
                      class="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                      [class]="
                        s.scope === 'all'
                          ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                          : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400'
                      "
                    >
                      {{ s.scope === 'all' ? 'Everything' : 'Bulk only' }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-xs text-muted-foreground">{{ when(s.at) }}</td>
                  <td class="px-4 py-2 text-right">
                    <button
                      type="button"
                      (click)="askRemove(s.address)"
                      class="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted"
                      title="Start writing to this address again"
                    >
                      <ng-icon name="lucideUndo2" class="h-3.5 w-3.5" /> Allow again
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <app-confirmation-dialog
        #removeDialog
        [title]="removeTitle()"
        [message]="removeMessage"
        [details]="removeDetails"
        confirmText="Allow again"
        processingText="Allowing…"
        variant="warning"
        (confirmed)="confirmRemove()"
        (cancelled)="pending.set(null)"
      />
    </div>
  `,
})
export class MailSuppressionsComponent implements OnInit, OnDestroy {
  private readonly api = inject(MailConsoleService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected query = '';
  protected readonly search = signal('');
  protected readonly entries = signal<MailSuppression[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal<string | null>(null);

  private readonly removeDialog = viewChild<ConfirmationDialogComponent>('removeDialog');

  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.entries().filter((e) => e.address.includes(q)) : this.entries();
  });

  protected readonly removeTitle = computed(() => `Allow ${this.pending() ?? 'this address'} again`);

  protected readonly removeMessage = 'Flui will start writing to this address again.';

  protected readonly removeDetails = [
    'Reasonable when a mailbox that was full has room again, or when the entry was added by hand.',
    'If it bounced because the mailbox does not exist, it will bounce again and land straight back here.',
  ];

  private readonly surfaceRevision = new MailSuppressionsSurfaceRevision();

  readonly surface = computed(() => {
    const input: MailSuppressionsSurfaceInput = {
      entries: this.entries(),
      shownCount: this.shown().length,
      loading: this.loading(),
      hasLoadError: !!this.error(),
    };
    return buildMailSuppressionsSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.suppressions().subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.loading.set(false);
      },
    });
  }

  protected askRemove(address: string): void {
    this.pending.set(address);
    this.removeDialog()?.open();
  }

  protected confirmRemove(): void {
    const address = this.pending();
    if (!address) return;
    this.removeDialog()?.setProcessing(true);
    this.api.unsuppress(address).subscribe({
      next: () => {
        this.entries.update((list) => list.filter((e) => e.address !== address));
        this.pending.set(null);
        this.removeDialog()?.close();
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.removeDialog()?.setProcessing(false);
        this.removeDialog()?.close();
      },
    });
  }

  protected reason(s: MailSuppression): string {
    return REASON_LABEL[s.reason] ?? s.reason;
  }

  protected when(iso: string): string {
    return whenLabel(iso);
  }
}
