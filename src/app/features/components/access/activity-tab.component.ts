import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideInfo,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlErrorState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { AuditService } from '../../service/audit.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { AuditEventListComponent } from './audit-event-list.component';
import {
  AUDIT_PERIOD_LABELS,
  AuditEvent,
  AuditFilter,
  AuditPeriod,
  isAuditEmail,
} from '../../model/audit.model';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-activity-tab',
  imports: [
    FlAlert,
    FlPanel,
    FlErrorState,
    FlLoadingState,
    FlButton,
    FlIcon,
    AuditEventListComponent,
  ],
  providers: [
    provideIcons({
      lucideChevronLeft,
      lucideChevronRight,
      lucideInfo,
      lucideRefreshCw,
    }),
  ],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Activity" [flush]="true">
      <ng-container panelActions>
        <button
          flButton="ghost"
          size="sm"
          type="button"
          [attr.aria-expanded]="showInfo()"
          (click)="showInfo.set(!showInfo())"
        >
          <fl-icon name="lucideInfo" [size]="14" />
          What is recorded
        </button>
        <button
          flButton
          size="sm"
          type="button"
          [iconOnly]="true"
          title="Refresh"
          aria-label="Refresh"
          (click)="reload()"
        >
          <fl-icon name="lucideRefreshCw" [size]="14" />
        </button>
      </ng-container>
      <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
        <div class="fl-toolbar__group">
          <label class="fl-input">
            <span class="fl-sr">Person</span>
            <input
              id="act-person"
              type="email"
              placeholder="Filter by email"
              [value]="email()"
              (change)="email.set(value($event))"
              (keyup.enter)="email.set(value($event))"
            />
          </label>
          <span class="fl-select-wrap">
            <select
              id="act-period"
              class="fl-select fl-select--sm"
              aria-label="Period"
              (change)="period.set(periodValue($event))"
            >
              @for (p of periods; track p) {
                <option [value]="p" [selected]="period() === p">{{ periodLabels[p] }}</option>
              }
            </select>
          </span>
          <label class="fl-check">
            <input
              id="act-data"
              type="checkbox"
              [checked]="dataOnly()"
              (change)="dataOnly.set(checked($event))"
            />
            <span>Only application data</span>
          </label>
          <label class="fl-check">
            <input
              id="act-refused"
              type="checkbox"
              [checked]="refusedOnly()"
              (change)="refusedOnly.set(checked($event))"
            />
            <span>Only refused</span>
          </label>
        </div>
      </div>

      @if (showInfo()) {
        <p class="border-b border-fl-border px-4 py-3 text-fl-body-sm text-fl-ink-secondary">
          Every change, every refused request and every read of application data, newest first.
          "data" marks what reached an application's data; "key" and "agent" mark actions made with
          an API key or by an agent.
        </p>
      }

      @if (emailInvalid()) {
        <div class="p-4">
          <fl-alert tone="warning" title="Enter a full email address." />
        </div>
      } @else if (loading()) {
        <fl-loading-state [rows]="5" />
      } @else if (error()) {
        <fl-error-state
          [compact]="true"
          title="The activity record could not be read."
          (retry)="reload()"
        />
      } @else {
        <app-audit-event-list [events]="events()" emptyText="Nothing recorded for these filters." />
        @if (page() > 0 || hasOlder()) {
          <div class="flex items-center justify-between gap-3 border-t border-fl-border px-4 py-3">
            <span class="fl-toolbar__info">{{ range() }}</span>
            <div class="fl-row">
              <button flButton size="sm" type="button" [disabled]="page() === 0" (click)="newer()">
                <fl-icon name="lucideChevronLeft" [size]="14" />
                Newer
              </button>
              <button flButton size="sm" type="button" [disabled]="!hasOlder()" (click)="older()">
                Older
                <fl-icon name="lucideChevronRight" [size]="14" />
              </button>
            </div>
          </div>
        }
      }
    </fl-panel>
  `,
})
export class ActivityTabComponent {
  private readonly audit = inject(AuditService);
  private readonly maskMode = inject(MaskModeService);

  protected readonly periods: AuditPeriod[] = ['24h', '7d', '30d'];
  protected readonly periodLabels = AUDIT_PERIOD_LABELS;

  readonly showInfo = signal(false);
  readonly email = signal('');
  readonly period = signal<AuditPeriod>('7d');
  readonly dataOnly = signal(false);
  readonly refusedOnly = signal(false);

  readonly events = signal<AuditEvent[]>([]);
  readonly hasOlder = signal(false);
  private readonly cursors = signal<(string | undefined)[]>([undefined]);
  readonly page = computed(() => this.cursors().length - 1);
  readonly range = computed(() => {
    const first = this.page() * PAGE_SIZE + 1;
    return `${first}–${first + this.events().length - 1}`;
  });
  readonly loading = signal(false);
  readonly error = signal(false);

  readonly emailInvalid = computed(() => {
    const e = this.email().trim();
    return e.length > 0 && !isAuditEmail(e);
  });

  readonly filter = computed<AuditFilter>(() => ({
    email: this.email().trim() || undefined,
    period: this.period(),
    dataAccessOnly: this.dataOnly(),
    refusedOnly: this.refusedOnly(),
  }));

  private sub?: Subscription;

  constructor() {
    effect(() => {
      const filter = this.filter();
      const invalid = this.emailInvalid();
      this.maskMode.enabled();
      untracked(() => {
        this.cursors.set([undefined]);
        if (!invalid) this.load(filter);
      });
    });
  }

  reload(): void {
    if (!this.emailInvalid()) this.load(this.filter());
  }

  older(): void {
    const last = this.events().at(-1);
    if (!last || !this.hasOlder()) return;
    this.cursors.update((c) => [...c, last.id]);
    this.load(this.filter());
  }

  newer(): void {
    if (this.page() === 0) return;
    this.cursors.update((c) => c.slice(0, -1));
    this.load(this.filter());
  }

  private load(filter: AuditFilter): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    const before = this.cursors().at(-1);
    this.sub = this.audit.list({ ...filter, before, limit: PAGE_SIZE + 1 }).subscribe({
      next: (rows) => {
        this.events.set(rows.slice(0, PAGE_SIZE));
        this.hasOlder.set(rows.length > PAGE_SIZE);
        this.loading.set(false);
      },
      error: () => {
        this.events.set([]);
        this.hasOlder.set(false);
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  periodValue(e: Event): AuditPeriod {
    return (e.target as HTMLSelectElement).value as AuditPeriod;
  }
}
