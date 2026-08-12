import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLoader,
  lucideRotateCcw,
  lucideSearch,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { MailSectionNavComponent } from './mail-section-nav.component';
import { MailConsoleService } from '../../service/mail-console.service';
import { MailDeliveryEvent, MailEventKind } from '../../model/mail-console.models';
import { consoleError, shortWhen } from './mail-format';

const PAGE = 50;

const FILTERS: { label: string; kinds: MailEventKind[] }[] = [
  { label: 'Everything', kinds: [] },
  { label: 'Failures', kinds: ['bounced', 'complained'] },
  { label: 'Delivered', kinds: ['delivered'] },
  { label: 'In flight', kinds: ['queued', 'sent', 'deferred'] },
];

const KIND_CLASS: Record<string, string> = {
  delivered: 'bg-muted text-foreground',
  sent: 'bg-muted text-muted-foreground',
  queued: 'bg-muted text-muted-foreground',
  deferred: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400',
  bounced: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  complained: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  unsubscribed: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400',
  canceled: 'bg-muted text-muted-foreground',
};

@Component({
  selector: 'app-mail-activity',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon, MailSectionNavComponent],
  providers: [
    provideIcons({ lucideLoader, lucideRotateCcw, lucideSearch, lucideTriangleAlert }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <app-mail-section-nav>
        <button
          slot="actions"
          type="button"
          (click)="reload()"
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

      <div class="mb-3 flex flex-wrap items-center gap-2">
        <div class="flex rounded-md border border-border p-0.5">
          @for (f of filters; track f.label) {
            <button
              type="button"
              (click)="applyFilter(f.kinds)"
              class="rounded px-2.5 py-1 text-xs font-medium transition-colors"
              [class]="
                isActive(f.kinds)
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              "
            >
              {{ f.label }}
            </button>
          }
        </div>
        <div class="relative">
          <ng-icon
            name="lucideSearch"
            class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          />
          <input
            type="text"
            [(ngModel)]="query"
            (keydown.enter)="reload()"
            placeholder="Address, either side"
            class="h-9 w-64 rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground"
          />
        </div>
      </div>

      @if (error()) {
        <div
          class="mb-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ error() }}</span>
        </div>
      }

      @if (loading() && !events().length) {
        <div class="overflow-hidden rounded-lg border border-border bg-card">
          <div class="border-b border-border px-4 py-2">
            <div class="skeleton h-3 w-56"></div>
          </div>
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="flex items-start gap-4 border-b border-border/60 px-4 py-3 last:border-0">
              <div class="skeleton h-4 w-24"></div>
              <div class="skeleton h-5 w-20"></div>
              <div class="skeleton h-4 w-56"></div>
              <div class="skeleton h-4 w-44"></div>
              <div class="skeleton h-4 flex-1"></div>
            </div>
          }
        </div>
      } @else if (!events().length) {
        <p class="text-sm text-muted-foreground">Nothing matches in this window.</p>
      } @else {
        <div class="overflow-x-auto rounded-lg border border-border bg-card">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border text-left text-xs text-muted-foreground">
                <th class="px-4 py-2 font-medium">When</th>
                <th class="px-4 py-2 font-medium">Outcome</th>
                <th class="px-4 py-2 font-medium">To</th>
                <th class="px-4 py-2 font-medium">From</th>
                <th class="px-4 py-2 font-medium">Subject</th>
              </tr>
            </thead>
            <tbody>
              @for (e of events(); track e.messageId + e.recipient) {
                <tr class="border-b border-border/60 last:border-0 align-top">
                  <td class="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                    {{ at(e.at) }}
                  </td>
                  <td class="px-4 py-2">
                    <span
                      class="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                      [class]="kindClass(e.kind)"
                      >{{ e.kind }}</span
                    >
                  </td>
                  <td class="px-4 py-2 font-mono text-xs text-foreground">{{ e.recipient }}</td>
                  <td class="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {{ e.from ?? '—' }}
                  </td>
                  <td class="px-4 py-2">
                    <div class="max-w-md truncate text-foreground">{{ e.subject ?? '—' }}</div>
                    @if (e.reason) {
                      <div class="max-w-md truncate font-mono text-[11px] text-red-600 dark:text-red-400"
                           [title]="e.reason">
                        {{ e.code ? e.code + ' ' : '' }}{{ e.reason }}
                      </div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (more()) {
          <div class="mt-3 flex justify-center">
            <button
              type="button"
              (click)="loadMore()"
              [disabled]="loading()"
              class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              @if (loading()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
              }
              Load more
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class MailActivityComponent implements OnInit {
  private readonly api = inject(MailConsoleService);

  protected readonly filters = FILTERS;
  protected query = '';
  protected readonly kinds = signal<MailEventKind[]>([]);
  protected readonly events = signal<MailDeliveryEvent[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly more = signal(false);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.events.set([]);
    this.fetch(0);
  }

  protected loadMore(): void {
    this.fetch(this.events().length);
  }

  protected applyFilter(kinds: MailEventKind[]): void {
    this.kinds.set(kinds);
    this.reload();
  }

  protected isActive(kinds: MailEventKind[]): boolean {
    return this.kinds().join(',') === kinds.join(',');
  }

  private fetch(offset: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .events({
        ...(this.kinds().length ? { kinds: this.kinds() } : {}),
        ...(this.query.trim() ? { search: this.query.trim() } : {}),
        limit: PAGE,
        offset,
      })
      .subscribe({
        next: (page) => {
          this.events.update((held) => (offset === 0 ? page : [...held, ...page]));
          this.more.set(page.length === PAGE);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(consoleError(err));
          this.loading.set(false);
        },
      });
  }

  protected at(iso: string): string {
    return shortWhen(iso);
  }

  protected kindClass(kind: string): string {
    return KIND_CLASS[kind] ?? 'bg-muted text-muted-foreground';
  }
}
