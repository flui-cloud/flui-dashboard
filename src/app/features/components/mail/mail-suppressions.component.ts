import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideSearch, lucideUserX } from '@ng-icons/lucide';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { MailSectionNavComponent } from './mail-section-nav.component';
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
  providers: [provideIcons({ lucideRefreshCw, lucideSearch, lucideUserX })],
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
          (click)="load()"
        >
          <fl-icon name="lucideRefreshCw" />
        </button>
      </app-mail-section-nav>

      <p class="m-0 max-w-3xl text-fl-body-sm text-fl-ink-muted">
        Addresses Flui has stopped writing to, and how far the stop reaches. Everything stops every
        message; bulk only stops one-to-many mail, so someone who left a mailing list still gets the
        password reset they asked for thirty seconds ago.
      </p>

      @if (error()) {
        <fl-alert tone="error" title="Could not load the suppressions">{{ error() }}</fl-alert>
      }

      <fl-panel title="Suppressions" [count]="loading() ? null : entries().length" [flush]="true">
        @if (!loading() && entries().length) {
          <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
            <div class="fl-toolbar__group">
              <label class="fl-input">
                <fl-icon name="lucideSearch" [size]="14" />
                <span class="fl-sr">Filter by address</span>
                <input
                  type="search"
                  [(ngModel)]="query"
                  (ngModelChange)="search.set($event)"
                  placeholder="Filter by address"
                  aria-label="Filter by address"
                />
              </label>
            </div>
            <div class="fl-toolbar__group">
              <span class="fl-toolbar__info">{{ shown().length }} of {{ entries().length }}</span>
            </div>
          </div>
        }

        @if (loading()) {
          <fl-loading-state [rows]="4" />
        } @else if (error()) {
          <fl-empty-state [compact]="true" title="Nothing to show" />
        } @else if (!entries().length) {
          <fl-empty-state
            icon="lucideUserX"
            title="Nothing is suppressed"
            body="Bounces and complaints land here on their own as they arrive."
          />
        } @else if (!shown().length) {
          <fl-empty-state [compact]="true" title="No address matches this filter" />
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Address</th>
                  <th scope="col">Why</th>
                  <th scope="col">Reaches</th>
                  <th scope="col">Since</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (s of shown(); track s.address) {
                  <tr>
                    <td class="fl-mono">{{ s.address }}</td>
                    <td>
                      <div class="flex flex-col">
                        <span>{{ reason(s) }}</span>
                        @if (s.detail) {
                          <span class="fl-mono fl-cell-clip text-fl-ink-muted" [title]="s.detail">{{
                            s.detail
                          }}</span>
                        }
                      </div>
                    </td>
                    <td>
                      <fl-status
                        [tone]="s.scope === 'all' ? 'error' : 'warning'"
                        [label]="s.scope === 'all' ? 'Everything' : 'Bulk only'"
                      />
                    </td>
                    <td class="text-fl-ink-muted">{{ when(s.at) }}</td>
                    <td class="is-fit">
                      <button
                        flButton="ghost"
                        size="sm"
                        type="button"
                        title="Start writing to this address again"
                        [attr.aria-label]="'Allow ' + s.address + ' again'"
                        [disabled]="pending() === s.address"
                        (click)="askRemove(s.address)"
                      >
                        Allow again
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    </div>
  `,
})
export class MailSuppressionsComponent implements OnInit, OnDestroy {
  private readonly api = inject(MailConsoleService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly confirm = inject(ConfirmService);

  protected query = '';
  protected readonly search = signal('');
  protected readonly entries = signal<MailSuppression[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal<string | null>(null);

  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.entries().filter((e) => e.address.includes(q)) : this.entries();
  });

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

  protected async askRemove(address: string): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Allow ${address} again`,
      body:
        'Flui will start writing to this address again. Reasonable when a mailbox that was full ' +
        'has room again, or when the entry was added by hand. If it bounced because the mailbox ' +
        'does not exist, it will bounce again and land straight back here.',
      confirmLabel: 'Allow again',
    });
    if (ok) this.confirmRemove(address);
  }

  private confirmRemove(address: string): void {
    this.pending.set(address);
    this.api.unsuppress(address).subscribe({
      next: () => {
        this.entries.update((list) => list.filter((e) => e.address !== address));
        this.pending.set(null);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.pending.set(null);
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
