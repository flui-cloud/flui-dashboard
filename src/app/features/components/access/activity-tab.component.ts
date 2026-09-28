import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo, lucideRefreshCw } from '@ng-icons/lucide';
import {
  HlmCardDirective,
  HlmCardContentDirective,
} from '@spartan-ng/ui-card-helm';
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

const INPUT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

@Component({
  selector: 'app-activity-tab',
  standalone: true,
  imports: [
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    AuditEventListComponent,
  ],
  providers: [provideIcons({ lucideInfo, lucideRefreshCw })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div hlmCard>
      <div hlmCardContent class="pt-6 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <h3 class="text-sm font-semibold text-foreground">Activity</h3>
          <div class="flex items-center gap-2">
            <button type="button" (click)="reload()" title="Refresh"
              class="inline-flex items-center rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground">
              <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" />
            </button>
            <button type="button" (click)="showInfo.set(!showInfo())"
              class="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ng-icon name="lucideInfo" class="h-3.5 w-3.5" />
              What is recorded
            </button>
          </div>
        </div>
        @if (showInfo()) {
          <p class="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 p-3">
            Every change, every refused request and every read of application data, newest first.
            "data" marks what reached an application's data; "key" and "agent" mark actions made with an API key or by an agent.
          </p>
        }

        <div class="flex flex-col gap-3 md:flex-row md:items-end md:flex-wrap">
          <div class="md:w-64">
            <label for="act-person" class="block text-xs font-medium text-muted-foreground mb-1">Person</label>
            <input id="act-person" type="email" placeholder="name@example.com" [class]="inputClass"
              [value]="email()" (change)="email.set(value($event))" (keyup.enter)="email.set(value($event))" />
          </div>
          <div class="md:w-44">
            <label for="act-period" class="block text-xs font-medium text-muted-foreground mb-1">Period</label>
            <select id="act-period" [class]="inputClass + ' appearance-none'" (change)="period.set(periodValue($event))">
              @for (p of periods; track p) {
                <option [value]="p" [selected]="period() === p">{{ periodLabels[p] }}</option>
              }
            </select>
          </div>
          <label class="inline-flex items-center gap-2 text-sm text-foreground h-9">
            <input id="act-data" type="checkbox" [checked]="dataOnly()" (change)="dataOnly.set(checked($event))" />
            Only application data
          </label>
          <label class="inline-flex items-center gap-2 text-sm text-foreground h-9">
            <input id="act-refused" type="checkbox" [checked]="refusedOnly()" (change)="refusedOnly.set(checked($event))" />
            Only refused
          </label>
        </div>

        @if (emailInvalid()) {
          <p class="text-xs text-destructive">Enter a full email address.</p>
        } @else if (loading()) {
          <p class="text-sm text-muted-foreground py-4">Loading…</p>
        } @else if (error()) {
          <p class="text-sm text-muted-foreground py-4">The activity record could not be read.</p>
        } @else {
          <app-audit-event-list [events]="events()" emptyText="Nothing recorded for these filters." />
        }
      </div>
    </div>
  `,
})
export class ActivityTabComponent {
  private readonly audit = inject(AuditService);
  private readonly maskMode = inject(MaskModeService);

  protected readonly inputClass = INPUT_CLASS;
  protected readonly periods: AuditPeriod[] = ['24h', '7d', '30d'];
  protected readonly periodLabels = AUDIT_PERIOD_LABELS;

  readonly showInfo = signal(false);
  readonly email = signal('');
  readonly period = signal<AuditPeriod>('7d');
  readonly dataOnly = signal(false);
  readonly refusedOnly = signal(false);

  readonly events = signal<AuditEvent[]>([]);
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
    limit: 200,
  }));

  private sub?: Subscription;

  constructor() {
    effect(() => {
      const filter = this.filter();
      const invalid = this.emailInvalid();
      this.maskMode.enabled();
      untracked(() => {
        if (!invalid) this.load(filter);
      });
    });
  }

  reload(): void {
    if (!this.emailInvalid()) this.load(this.filter());
  }

  private load(filter: AuditFilter): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.sub = this.audit.list(filter).subscribe({
      next: (rows) => {
        this.events.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.events.set([]);
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
