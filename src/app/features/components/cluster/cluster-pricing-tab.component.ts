import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ClusterService } from '../../service/cluster.service';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { formatMoney } from '../../../shared/utils/money';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlMetric, FlMetricStrip } from '../../../ui/patterns/metric-strip';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { ClusterPricingMachines } from './cluster-pricing-machines';
import {
  Breakdown,
  ClusterBilling,
  NodeGroups,
  NodeMtd,
  billingDate,
  groupNodes,
  shown,
  vatLabel,
} from './cluster-pricing-view';

interface CostColumn {
  label: string;
  breakdown: Breakdown;
  totalGross: string;
  totalNet: string;
}

@Component({
  selector: 'cluster-pricing-tab',
  imports: [
    FlAlert,
    FlMetric,
    FlMetricStrip,
    FlPanel,
    FlLoadingState,
    FlTable,
    FlUsageBar,
    ClusterPricingMachines,
  ],
  host: { class: 'fl-stack' },
  template: `
    @if (isLoading()) {
      <fl-panel title="Cost this month">
        <fl-loading-state [rows]="4" />
      </fl-panel>
    }

    @if (error()) {
      <fl-alert tone="error" title="Could not load billing">{{ error() }}</fl-alert>
    }

    @if (billing(); as b) {
      <fl-panel title="Cost this month">
        <span panelActions class="text-fl-body-sm text-fl-ink-muted">{{ vatLabel(b) }}</span>
        <div class="flex flex-col gap-4">
          <fl-metric-strip>
            <fl-metric
              label="Spent so far"
              [value]="
                money(shown(b, { gross: b.monthToDate.totalGross, net: b.monthToDate.totalNet }))
              "
              [caption]="formatDate(b.billingPeriod.start) + ' to today, removed machines included'"
            />
            @if (b.forecast; as f) {
              <fl-metric
                label="Expected by month end"
                [value]="money(shown(b, { gross: f.totalGross, net: f.totalNet }))"
                [caption]="
                  'Spent so far, plus what runs now for the ' +
                  f.remainingHours +
                  'h left in the month'
                "
              />
            }
            <fl-metric
              label="Monthly cost of this setup"
              [value]="
                money(shown(b, { gross: b.runRate.monthlyGross, net: b.runRate.monthlyNet }))
              "
              [caption]="setupCaption(b)"
            />
          </fl-metric-strip>

          <fl-usage-bar
            [percent]="(b.billingPeriod.elapsedHours / b.billingPeriod.totalHours) * 100"
            label="Billing period elapsed"
            [aside]="
              formatDate(b.billingPeriod.start) +
              ' to ' +
              formatDate(b.billingPeriod.end) +
              ', ' +
              b.billingPeriod.elapsedHours +
              'h of ' +
              b.billingPeriod.totalHours +
              'h'
            "
            [warnAt]="101"
            [criticalAt]="101"
          />

          @if (b.billedAs || b.unpricedItems || b.listPricedItems) {
            <div class="flex flex-col gap-1 text-fl-body-sm text-fl-ink-muted">
              @if (b.billedAs) {
                <p class="m-0">{{ b.provider }}: {{ b.billedAs }}.</p>
              }
              @if (b.unpricedItems) {
                <p class="m-0">
                  {{ b.unpricedItems }} machine{{
                    b.unpricedItems !== 1 ? 's or volumes' : ' or volume'
                  }}
                  could not be priced and {{ b.unpricedItems !== 1 ? 'are' : 'is' }} left out of
                  these figures.
                </p>
              }
              @if (b.listPricedItems) {
                <p class="m-0">
                  {{ b.listPricedItems }} priced at today's list price: they started before Flui
                  recorded the price they started at.
                </p>
              }
            </div>
          }
        </div>
      </fl-panel>

      <fl-panel title="By resource" [flush]="true">
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Resource</th>
                @for (col of columns(); track col.label) {
                  <th scope="col" class="is-num">{{ col.label }}</th>
                }
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Machines</td>
                @for (col of columns(); track col.label) {
                  <td class="is-num">
                    {{
                      money(
                        shown(b, {
                          gross: col.breakdown.computeGross,
                          net: col.breakdown.computeNet,
                        })
                      )
                    }}
                  </td>
                }
              </tr>
              <tr>
                <td>Storage</td>
                @for (col of columns(); track col.label) {
                  <td class="is-num">
                    {{
                      money(
                        shown(b, {
                          gross: col.breakdown.storageGross,
                          net: col.breakdown.storageNet,
                        })
                      )
                    }}
                  </td>
                }
              </tr>
              <tr>
                <td class="font-semibold">Total</td>
                @for (col of columns(); track col.label) {
                  <td class="is-num font-semibold">
                    {{ money(shown(b, { gross: col.totalGross, net: col.totalNet })) }}
                  </td>
                }
              </tr>
              @if (b.vat?.included) {
                <tr>
                  <td class="text-fl-ink-muted">Total excl. VAT</td>
                  @for (col of columns(); track col.label) {
                    <td class="is-num text-fl-ink-muted">{{ money(col.totalNet) }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </fl-panel>

      @if (groups(); as g) {
        <app-cluster-pricing-machines [billing]="b" [groups]="g" />
      }

      <p class="m-0 text-right text-fl-caption text-fl-ink-muted">
        Calculated at {{ formatDateTime(b.calculatedAt) }}
      </p>
    }
  `,
})
export class ClusterPricingTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly clustersApi = inject(InfrastructureClustersService);

  billing = signal<ClusterBilling | null>(null);
  readonly groups = computed<NodeGroups | null>(() => {
    const b = this.billing();
    return b ? groupNodes(b.monthToDate.nodes as NodeMtd[]) : null;
  });
  readonly columns = computed<CostColumn[]>(() => {
    const b = this.billing();
    if (!b) return [];
    const columns: CostColumn[] = [
      {
        label: 'Spent so far',
        breakdown: b.monthToDate.breakdown,
        totalGross: b.monthToDate.totalGross,
        totalNet: b.monthToDate.totalNet,
      },
    ];
    if (b.forecast) {
      columns.push({
        label: 'Expected by month end',
        breakdown: b.forecast.breakdown,
        totalGross: b.forecast.totalGross,
        totalNet: b.forecast.totalNet,
      });
    }
    columns.push({
      label: 'Monthly cost',
      breakdown: b.runRate.breakdown,
      totalGross: b.runRate.monthlyGross,
      totalNet: b.runRate.monthlyNet,
    });
    return columns;
  });
  readonly shown = shown;
  readonly vatLabel = vatLabel;
  isLoading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    void this.loadBilling();
  }

  private async loadBilling(): Promise<void> {
    const clusterId = this.clusterService.cluster()?.id;
    if (!clusterId) return;
    try {
      this.isLoading.set(true);
      this.error.set(null);
      const response = await firstValueFrom(
        this.clustersApi.clustersControllerGetClusterBilling(clusterId),
      );
      this.billing.set(response as unknown as ClusterBilling);
    } catch (err: any) {
      console.error('Failed to load billing:', err);
      this.error.set(
        err?.status === 404
          ? 'Billing data not yet available for this cluster.'
          : 'Failed to load billing data.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  money(value: string | number | null | undefined): string {
    return formatMoney(value, this.billing()?.currency ?? 'EUR');
  }

  setupCaption(b: ClusterBilling): string {
    const nodes = b.runRate.activeNodes;
    const volumes = b.runRate.activeVolumes;
    return `${nodes} machine${nodes === 1 ? '' : 's'} and ${volumes} volume${volumes === 1 ? '' : 's'} as they are now, over a whole month`;
  }

  formatDate(isoString: string): string {
    return billingDate(isoString);
  }

  formatDateTime(isoString: string): string {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
