import { Component, computed, input } from '@angular/core';
import { CostProvider } from '../../model/costs.models';
import { formatMoney } from '../../../shared/utils/money';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlTag } from '../../../ui/primitives/tag';
import { clusterRows, providerTitle, vatNote } from './costs-view';

@Component({
  selector: 'app-costs-provider-panel',
  imports: [FlPanel, FlTable, FlTag],
  template: `
    <fl-panel
      [title]="title()"
      [flush]="true"
      [attr.data-testid]="'costs-provider-' + provider().provider"
    >
      <p class="border-b border-fl-border px-4 py-3 text-fl-caption text-fl-ink-muted">
        @if (provider().priced) {
          {{ provider().billedAs }} · {{ vat() }}
        } @else {
          {{ provider().note }}
        }
      </p>
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Cluster</th>
              <th scope="col" class="is-num">This month</th>
              <th scope="col" class="is-num">Expected</th>
              <th scope="col" class="is-num">Last month</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.clusterId) {
              <tr>
                <td class="fl-cell-name">
                  <span class="fl-row">
                    <span class="font-medium">{{ row.name }}</span>
                    @if (row.removed) {
                      <fl-tag>deleted</fl-tag>
                    }
                    @if (row.unpriced) {
                      <span class="text-fl-ink-muted">{{ row.unpriced }} not priced</span>
                    }
                  </span>
                </td>
                <td class="is-num">{{ money(row.spent) }}</td>
                <td class="is-num">{{ money(row.forecast) }}</td>
                <td class="is-num">{{ money(row.lastMonth) }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="text-fl-ink-muted">No cost in these months.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (provider().priced && (provider().listPriced || provider().unpriced)) {
        <div
          class="flex flex-col gap-1 border-t border-fl-border px-4 py-3 text-fl-caption text-fl-ink-muted"
        >
          @if (provider().listPriced) {
            <p>
              {{ provider().listPriced }} priced at today's list price: they started before Flui
              recorded the price they started at.
            </p>
          }
          @if (provider().unpriced) {
            <p>
              {{ provider().unpriced }} could not be priced and
              {{ provider().unpriced === 1 ? 'is' : 'are' }} left out.
            </p>
          }
        </div>
      }
    </fl-panel>
  `,
})
export class CostsProviderPanel {
  readonly provider = input.required<CostProvider>();
  readonly currency = input('EUR');

  protected readonly title = computed(() => providerTitle(this.provider().provider));
  protected readonly vat = computed(() => vatNote(this.provider()));
  protected readonly rows = computed(() => clusterRows(this.provider()));

  protected money(value: number | null | undefined): string {
    return formatMoney(value, this.currency());
  }
}
