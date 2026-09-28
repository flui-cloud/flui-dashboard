import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideCreditCard,
  lucideRefreshCw,
  lucideTrendingUp,
  lucideCalendar,
} from '@ng-icons/lucide';
import { CostsService } from '../../service/costs.service';
import { formatMoney } from '../../../shared/utils/money';
import { clusterRows, headline, monthCell, monthLabel, vatNote } from './costs-view';

@Component({
  selector: 'app-costs',
  standalone: true,
  imports: [DatePipe, NgIcon],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideCreditCard,
      lucideRefreshCw,
      lucideTrendingUp,
      lucideCalendar,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4 p-4 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">Costs</h1>
          <p class="text-sm text-muted-foreground mt-0.5">
            What the machines and volumes of your clusters cost, month by month, deleted clusters included.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-muted-foreground" for="cost-months">Months</label>
          <select
            id="cost-months"
            class="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            [value]="months()"
            (change)="setMonths($any($event.target).value)"
          >
            @for (option of monthOptions; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
          <button
            type="button"
            (click)="reload()"
            [disabled]="costs.loading()"
            class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="costs.loading()" />
            Refresh
          </button>
        </div>
      </div>

      @if (costs.error(); as error) {
        <div class="card-surface p-4 flex items-center gap-2 text-sm" data-testid="costs-error">
          <ng-icon name="lucideCircleAlert" class="h-4 w-4 text-red-600 dark:text-red-400" />
          {{ error }}
        </div>
      }

      @if (costs.loading() && !costs.costs()) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          @for (i of [1, 2, 3]; track i) {
            <div class="card-surface p-5 space-y-3">
              <div class="skeleton h-4 w-32"></div>
              <div class="skeleton h-8 w-28"></div>
            </div>
          }
        </div>
      }

      @if (costs.costs(); as c) {
        @if (!c.providers.length) {
          <div class="card-surface p-8 text-center" data-testid="costs-empty">
            <p class="text-sm font-medium">Nothing recorded yet</p>
            <p class="text-sm text-muted-foreground mt-1">
              Costs start with the first machine Flui creates for a cluster.
            </p>
          </div>
        } @else {
          @if (summary(); as h) {
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="card-surface p-5">
                <div class="flex items-center gap-2 mb-3">
                  <ng-icon name="lucideCreditCard" class="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span class="text-label">Spent this month</span>
                </div>
                <p class="text-2xl font-bold text-value">{{ money(h.spent) }}</p>
                <p class="text-xs text-sub mt-1">
                  excl. VAT
                  @if (h.spentGross !== null) {
                    · {{ money(h.spentGross) }} incl. VAT
                  }
                </p>
              </div>
              <div class="card-surface p-5">
                <div class="flex items-center gap-2 mb-3">
                  <ng-icon name="lucideTrendingUp" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span class="text-label">Expected by month end</span>
                </div>
                <p class="text-2xl font-bold text-value">{{ money(h.forecast) }}</p>
                <p class="text-xs text-sub mt-1">
                  excl. VAT · if what runs now keeps running
                </p>
              </div>
              <div class="card-surface p-5">
                <div class="flex items-center gap-2 mb-3">
                  <ng-icon name="lucideCalendar" class="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span class="text-label">{{ h.lastMonthLabel ?? 'Last month' }}</span>
                </div>
                <p class="text-2xl font-bold text-value">{{ money(h.lastMonth) }}</p>
                <p class="text-xs text-sub mt-1">excl. VAT</p>
              </div>
            </div>
          }

          <div class="card-surface overflow-x-auto">
            <table class="w-full text-sm" data-testid="costs-months">
              <thead>
                <tr class="border-b border-border text-xs text-muted-foreground">
                  <th class="text-left font-medium p-3">Provider</th>
                  @for (key of c.months; track key) {
                    <th class="text-right font-medium p-3 whitespace-nowrap">{{ label(key) }}</th>
                  }
                  <th class="text-right font-medium p-3 whitespace-nowrap">Expected</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                @for (p of c.providers; track p.provider) {
                  <tr>
                    <td class="p-3 font-medium capitalize">{{ p.provider }}</td>
                    @if (p.priced) {
                      @for (key of c.months; track key; let i = $index) {
                        <td class="p-3 text-right tabular-nums">{{ money(cell(p.months[i]).spent) }}</td>
                      }
                      <td class="p-3 text-right tabular-nums">{{ money(currentForecast(p.months)) }}</td>
                    } @else {
                      <td class="p-3 text-right text-muted-foreground" [attr.colspan]="c.months.length + 1">not priced</td>
                    }
                  </tr>
                }
                <tr class="font-semibold">
                  <td class="p-3">All providers</td>
                  @for (key of c.months; track key; let i = $index) {
                    <td class="p-3 text-right tabular-nums">{{ money(cell(c.totals[i]).spent) }}</td>
                  }
                  <td class="p-3 text-right tabular-nums">{{ money(currentForecast(c.totals)) }}</td>
                </tr>
              </tbody>
            </table>
            <p class="px-3 pb-3 text-xs text-muted-foreground">
              Excluding VAT. The running month shows what was spent so far; "Expected" is its forecast.
            </p>
          </div>

          @for (p of c.providers; track p.provider) {
            <div class="card-surface" [attr.data-testid]="'costs-provider-' + p.provider">
              <div class="p-4 border-b border-border">
                <h3 class="text-sm font-medium capitalize">{{ p.provider }}</h3>
                <p class="text-xs text-sub mt-0.5">
                  @if (p.priced) {
                    {{ p.billedAs }} · {{ vat(p) }}
                  } @else {
                    {{ p.note }}
                  }
                </p>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-border text-xs text-muted-foreground">
                      <th class="text-left font-medium p-3">Cluster</th>
                      <th class="text-right font-medium p-3">This month</th>
                      <th class="text-right font-medium p-3">Expected</th>
                      <th class="text-right font-medium p-3">Last month</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    @for (row of rows(p); track row.clusterId) {
                      <tr>
                        <td class="p-3">
                          <span class="font-medium">{{ row.name }}</span>
                          @if (row.removed) {
                            <span class="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">deleted</span>
                          }
                          @if (row.unpriced) {
                            <span class="ml-2 text-xs text-muted-foreground">{{ row.unpriced }} not priced</span>
                          }
                        </td>
                        <td class="p-3 text-right tabular-nums">{{ money(row.spent) }}</td>
                        <td class="p-3 text-right tabular-nums">{{ money(row.forecast) }}</td>
                        <td class="p-3 text-right tabular-nums">{{ money(row.lastMonth) }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="4" class="p-3 text-xs text-muted-foreground">No cost in these months.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (p.priced && (p.listPriced || p.unpriced)) {
                <div class="px-4 pb-3 pt-1 text-xs text-sub space-y-0.5">
                  @if (p.listPriced) {
                    <p>{{ p.listPriced }} priced at today's list price: they started before Flui kept the price they were bought at.</p>
                  }
                  @if (p.unpriced) {
                    <p>{{ p.unpriced }} could not be priced and {{ p.unpriced === 1 ? 'is' : 'are' }} left out.</p>
                  }
                </div>
              }
            </div>
          }

          <div class="text-xs text-muted-foreground space-y-0.5">
            @for (note of c.notes; track note) {
              <p>{{ note }}</p>
            }
            @if (c.recordedSince) {
              <p>Recorded since {{ c.recordedSince | date: 'mediumDate' }}; nothing earlier is known.</p>
            }
          </div>
        }
      }
    </div>
  `,
})
export class CostsComponent implements OnInit {
  readonly costs = inject(CostsService);
  readonly monthOptions = [3, 6, 12, 24];
  readonly months = signal(6);
  readonly summary = computed(() => {
    const c = this.costs.costs();
    return c ? headline(c) : null;
  });
  readonly label = monthLabel;
  readonly cell = monthCell;
  readonly rows = clusterRows;
  readonly vat = vatNote;

  ngOnInit(): void {
    void this.costs.load(this.months());
  }

  setMonths(value: string): void {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;
    this.months.set(parsed);
    void this.costs.load(parsed);
  }

  reload(): void {
    void this.costs.load(this.months());
  }

  money(value: number | null | undefined): string {
    return formatMoney(value, this.costs.costs()?.currency ?? 'EUR');
  }

  currentForecast(months: { current: boolean; forecastNet: number | null }[]): number | null {
    return months.find((m) => m.current)?.forecastNet ?? null;
  }
}
