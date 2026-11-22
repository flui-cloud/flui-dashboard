import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideSearch } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
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

const KIND_STATUS: Record<MailEventKind, { tone: StatusTone; label: string }> = {
  delivered: { tone: 'success', label: 'Delivered' },
  sent: { tone: 'progress', label: 'Sent' },
  queued: { tone: 'progress', label: 'Queued' },
  deferred: { tone: 'warning', label: 'Deferred' },
  bounced: { tone: 'error', label: 'Bounced' },
  complained: { tone: 'error', label: 'Complaint' },
  unsubscribed: { tone: 'warning', label: 'Unsubscribed' },
  canceled: { tone: 'neutral', label: 'Canceled' },
};

@Component({
  selector: 'app-mail-activity',
  imports: [
    FormsModule,
    FlAlert,
    FlPanel,
    FlTable,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlStatus,
    MailSectionNavComponent,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideSearch })],
  template: `
    <div class="fl-page">
      <app-mail-section-nav>
        <button
          headerActions
          flButton
          type="button"
          [iconOnly]="true"
          aria-label="Refresh"
          [disabled]="loading()"
          (click)="reload()"
        >
          <fl-icon name="lucideRefreshCw" />
        </button>
      </app-mail-section-nav>

      @if (error()) {
        <fl-alert tone="error" title="Could not load the activity">{{ error() }}</fl-alert>
      }

      <fl-panel [flush]="true">
        <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
          <div class="fl-toolbar__group">
            <label class="fl-input">
              <fl-icon name="lucideSearch" [size]="14" />
              <span class="fl-sr">Search</span>
              <input
                type="search"
                [(ngModel)]="query"
                (keydown.enter)="reload()"
                placeholder="Address, either side"
                aria-label="Search by address"
              />
            </label>
            <div class="fl-segmented" role="group" aria-label="Outcome">
              @for (f of filters; track f.label) {
                <button
                  type="button"
                  [attr.aria-pressed]="isActive(f.kinds)"
                  (click)="applyFilter(f.kinds)"
                >
                  {{ f.label }}
                </button>
              }
            </div>
          </div>
          <div class="fl-toolbar__group">
            <span class="fl-toolbar__info"
              >{{ events().length }}{{ more() ? '+' : '' }}
              {{ events().length === 1 ? 'event' : 'events' }}</span
            >
          </div>
        </div>

        @if (loading() && !events().length) {
          <fl-loading-state [rows]="6" />
        } @else if (!events().length) {
          <fl-empty-state title="Nothing matches in this window" />
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">To</th>
                  <th scope="col">From</th>
                  <th scope="col">Subject</th>
                </tr>
              </thead>
              <tbody>
                @for (e of events(); track e.messageId + e.recipient) {
                  <tr>
                    <td class="fl-num text-fl-ink-muted">{{ at(e.at) }}</td>
                    <td>
                      <fl-status [tone]="status(e.kind).tone" [label]="status(e.kind).label" />
                    </td>
                    <td class="fl-mono">{{ e.recipient }}</td>
                    <td class="fl-mono text-fl-ink-muted">{{ e.from ?? '—' }}</td>
                    <td class="whitespace-normal">
                      <div class="flex max-w-md flex-col">
                        <span class="truncate">{{ e.subject ?? '—' }}</span>
                        @if (e.reason) {
                          <span class="fl-mono truncate text-fl-ink-muted" [title]="e.reason"
                            >{{ e.code ? e.code + ' ' : '' }}{{ e.reason }}</span
                          >
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (more()) {
            <div class="flex justify-center border-t border-fl-border p-3">
              <button flButton size="sm" type="button" [disabled]="loading()" (click)="loadMore()">
                Load more
              </button>
            </div>
          }
        }
      </fl-panel>
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

  protected status(kind: MailEventKind): { tone: StatusTone; label: string } {
    return KIND_STATUS[kind] ?? { tone: 'neutral', label: kind };
  }
}
