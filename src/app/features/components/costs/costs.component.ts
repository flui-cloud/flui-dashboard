import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { CostsService } from '../../service/costs.service';
import { formatMoney } from '../../../shared/utils/money';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlMetric, FlMetricStrip } from '../../../ui/patterns/metric-strip';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { headline, monthCell, monthLabel, providerTitle } from './costs-view';
import { CostsProviderPanel } from './costs-provider-panel';

@Component({
  selector: 'app-costs',
  imports: [
    DatePipe,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlMetricStrip,
    FlMetric,
    FlTable,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    CostsProviderPanel,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  template: `
    <div class="fl-page">
      <fl-page-header title="Costs">
        <span headerMeta
          >What the machines and volumes of your clusters cost, month by month, deleted clusters
          included</span
        >
        <ng-container headerActions>
          <span class="fl-select-wrap">
            <select
              id="cost-months"
              class="fl-select fl-select--sm"
              aria-label="Months"
              [value]="months()"
              (change)="setMonths($any($event.target).value)"
            >
              @for (option of monthOptions; track option) {
                <option [value]="option">Last {{ option }} months</option>
              }
            </select>
          </span>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            title="Refresh"
            [disabled]="costs.loading()"
            (click)="reload()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </fl-page-header>

      @if (costs.error(); as error) {
        <fl-alert tone="error" title="Could not load the costs" data-testid="costs-error">{{
          error
        }}</fl-alert>
      }

      @if (costs.loading() && !costs.costs()) {
        <fl-panel [flush]="true"><fl-loading-state [rows]="5" /></fl-panel>
      }

      @if (costs.costs(); as c) {
        @if (!c.providers.length) {
          <fl-panel [flush]="true">
            <fl-empty-state
              data-testid="costs-empty"
              title="Nothing recorded yet"
              body="Costs start with the first machine Flui creates for a cluster."
            />
          </fl-panel>
        } @else {
          @if (summary(); as h) {
            <fl-metric-strip>
              <fl-metric
                label="Spent this month"
                [value]="money(h.spent)"
                [caption]="
                  h.spentGross !== null
                    ? 'excl. VAT · ' + money(h.spentGross) + ' incl. VAT'
                    : 'excl. VAT'
                "
              />
              <fl-metric
                label="Expected by month end"
                [value]="money(h.forecast)"
                caption="excl. VAT · if what runs now keeps running"
              />
              <fl-metric
                [label]="h.lastMonthLabel ?? 'Last month'"
                [value]="money(h.lastMonth)"
                caption="excl. VAT"
              />
            </fl-metric-strip>
          }

          <fl-panel title="By month" [flush]="true">
            <div class="fl-table-wrap">
              <table flTable density="dense" data-testid="costs-months">
                <thead>
                  <tr>
                    <th scope="col">Provider</th>
                    @for (key of c.months; track key) {
                      <th scope="col" class="is-num">{{ label(key) }}</th>
                    }
                    <th scope="col" class="is-num">Expected</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of c.providers; track p.provider) {
                    <tr>
                      <td class="font-medium">{{ title(p.provider) }}</td>
                      @if (p.priced) {
                        @for (key of c.months; track key; let i = $index) {
                          <td class="is-num">{{ money(cell(p.months[i]).spent) }}</td>
                        }
                        <td class="is-num">{{ money(currentForecast(p.months)) }}</td>
                      } @else {
                        <td
                          class="text-right text-fl-ink-muted"
                          [attr.colspan]="c.months.length + 1"
                        >
                          not priced
                        </td>
                      }
                    </tr>
                  }
                  <tr class="font-semibold">
                    <td>All providers</td>
                    @for (key of c.months; track key; let i = $index) {
                      <td class="is-num">{{ money(cell(c.totals[i]).spent) }}</td>
                    }
                    <td class="is-num">{{ money(currentForecast(c.totals)) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="border-t border-fl-border px-4 py-3 text-fl-caption text-fl-ink-muted">
              Excluding VAT. The running month shows what was spent so far; Expected is its
              forecast.
            </p>
          </fl-panel>

          @for (p of c.providers; track p.provider) {
            <app-costs-provider-panel [provider]="p" [currency]="c.currency" />
          }

          <div class="flex flex-col gap-1 text-fl-caption text-fl-ink-muted">
            @for (note of c.notes; track note) {
              <p>{{ note }}</p>
            }
            @if (c.recordedSince) {
              <p>
                Recorded since {{ c.recordedSince | date: 'mediumDate' }}; nothing earlier is known.
              </p>
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
  readonly title = providerTitle;

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
