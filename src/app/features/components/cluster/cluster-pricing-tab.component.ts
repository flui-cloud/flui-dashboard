import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCreditCard,
  lucideServer,
  lucideGauge,
  lucideCalendar,
  lucideArrowUpDown,
  lucideLoader,
  lucideCircleAlert,
  lucideHardDrive,
  lucideTrendingUp,
  lucideChevronDown,
} from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ClusterService } from '../../service/cluster.service';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { formatMoney } from '../../../shared/utils/money';
import {
  ClusterBilling,
  NodeGroups,
  NodeMtd,
  groupNodes,
  shown,
  vatLabel,
} from './cluster-pricing-view';

@Component({
  selector: 'cluster-pricing-tab',
  standalone: true,
  imports: [MaskIdPipe, NgIconComponent, NgTemplateOutlet, RouterLink],
  providers: [
    provideIcons({
      lucideCreditCard,
      lucideServer,
      lucideGauge,
      lucideCalendar,
      lucideArrowUpDown,
      lucideLoader,
      lucideCircleAlert,
      lucideHardDrive,
      lucideTrendingUp,
      lucideChevronDown,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (isLoading()) {
      <div class="animate-pulse space-y-6">
        <div class="card-surface p-4">
          <div class="skeleton h-5 w-48"></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (i of [1, 2]; track i) {
            <div class="card-surface p-5 space-y-3">
              <div class="skeleton h-4 w-32"></div>
              <div class="skeleton h-8 w-28"></div>
              <div class="skeleton h-3 w-40"></div>
            </div>
          }
        </div>
        <div class="card-surface overflow-hidden">
          <div class="p-4 border-b border-border">
            <div class="skeleton h-4 w-36"></div>
          </div>
          @for (i of [1, 2]; track i) {
            <div class="p-4 border-b border-border space-y-3">
              <div class="skeleton h-4 w-40"></div>
              <div class="skeleton h-3 w-60"></div>
            </div>
          }
        </div>
      </div>
    }

    @if (error()) {
      <div
        class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
      >
        <div class="flex items-center gap-2">
          <ng-icon
            name="lucideCircleAlert"
            class="h-4 w-4 text-red-600 dark:text-red-400"
          />
          <p class="text-sm text-red-700 dark:text-red-400">{{ error() }}</p>
        </div>
      </div>
    }

    @if (billing(); as b) {
      <div class="space-y-6">
        <!-- Period -->
        <div class="card-surface p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <ng-icon
                name="lucideCalendar"
                class="h-5 w-5 text-muted-foreground"
              />
              <div>
                <h3 class="text-sm font-medium text-foreground">
                  Billing period
                </h3>
                <p class="text-xs text-sub">
                  {{ formatDate(b.billingPeriod.start) }} —
                  {{ formatDate(b.billingPeriod.end) }}
                </p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-xs text-sub">
                {{ b.billingPeriod.elapsedHours }}h /
                {{ b.billingPeriod.totalHours }}h elapsed
              </p>
              <div class="mt-1 w-32 bg-muted rounded-full h-1.5">
                <div
                  class="bg-blue-600 h-1.5 rounded-full transition-all"
                  [style.width.%]="
                    (b.billingPeriod.elapsedHours /
                      b.billingPeriod.totalHours) *
                    100
                  "
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="card-surface p-5">
            <div class="flex items-center gap-2 mb-3">
              <ng-icon
                name="lucideCreditCard"
                class="h-4 w-4 text-green-600 dark:text-green-400"
              />
              <span class="text-label">Spent so far</span>
            </div>
            <p class="text-2xl font-bold text-value">
              {{ money(shown(b, { gross: b.monthToDate.totalGross, net: b.monthToDate.totalNet })) }}
            </p>
            <p class="text-xs text-sub mt-1">
              {{ vatLabel(b) }}
              @if (b.vat?.included) {
                · {{ money(b.monthToDate.totalNet) }} excl. VAT
              }
            </p>
            <p class="text-xs text-sub mt-2">
              {{ formatDate(b.billingPeriod.start) }} to today, removed machines included
            </p>
            <div class="mt-3 pt-3 border-t border-border space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-sub">Machines</span>
                <span class="text-value font-medium">{{
                  money(shown(b, { gross: b.monthToDate.breakdown.computeGross, net: b.monthToDate.breakdown.computeNet }))
                }}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-sub">Storage</span>
                <span class="text-value font-medium">{{
                  money(shown(b, { gross: b.monthToDate.breakdown.storageGross, net: b.monthToDate.breakdown.storageNet }))
                }}</span>
              </div>
            </div>
          </div>

          @if (b.forecast; as f) {
            <div class="card-surface p-5">
              <div class="flex items-center gap-2 mb-3">
                <ng-icon
                  name="lucideTrendingUp"
                  class="h-4 w-4 text-blue-600 dark:text-blue-400"
                />
                <span class="text-label">Expected by month end</span>
              </div>
              <p class="text-2xl font-bold text-value">
                {{ money(shown(b, { gross: f.totalGross, net: f.totalNet })) }}
              </p>
              <p class="text-xs text-sub mt-1">
                {{ vatLabel(b) }}
                @if (b.vat?.included) {
                  · {{ money(f.totalNet) }} excl. VAT
                }
              </p>
              <p class="text-xs text-sub mt-2">
                Spent so far, plus what runs now for the {{ f.remainingHours }}h left in the month
              </p>
              <div class="mt-3 pt-3 border-t border-border space-y-1">
                <div class="flex justify-between text-xs">
                  <span class="text-sub">Machines</span>
                  <span class="text-value font-medium">{{
                    money(shown(b, { gross: f.breakdown.computeGross, net: f.breakdown.computeNet }))
                  }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-sub">Storage</span>
                  <span class="text-value font-medium">{{
                    money(shown(b, { gross: f.breakdown.storageGross, net: f.breakdown.storageNet }))
                  }}</span>
                </div>
              </div>
            </div>
          }

          <div class="card-surface p-5">
            <div class="flex items-center gap-2 mb-3">
              <ng-icon
                name="lucideGauge"
                class="h-4 w-4 text-purple-600 dark:text-purple-400"
              />
              <span class="text-label">Monthly cost of this setup</span>
            </div>
            <p class="text-2xl font-bold text-value">
              {{ money(shown(b, { gross: b.runRate.monthlyGross, net: b.runRate.monthlyNet })) }}
            </p>
            <p class="text-xs text-sub mt-1">{{ vatLabel(b) }}</p>
            <p class="text-xs text-sub mt-2">
              {{ b.runRate.activeNodes }} machine{{ b.runRate.activeNodes !== 1 ? 's' : '' }}
              and {{ b.runRate.activeVolumes }} volume{{ b.runRate.activeVolumes !== 1 ? 's' : '' }}
              as they are now, over a whole month
            </p>
            <div class="mt-3 pt-3 border-t border-border space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-sub">Machines</span>
                <span class="text-value font-medium">{{
                  money(shown(b, { gross: b.runRate.breakdown.computeGross, net: b.runRate.breakdown.computeNet }))
                }}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-sub">Storage</span>
                <span class="text-value font-medium">{{
                  money(shown(b, { gross: b.runRate.breakdown.storageGross, net: b.runRate.breakdown.storageNet }))
                }}</span>
              </div>
            </div>
          </div>
        </div>

        @if (b.billedAs || b.unpricedItems || b.listPricedItems) {
          <div class="text-xs text-sub space-y-1">
            @if (b.billedAs) {
              <p>{{ b.provider }}: {{ b.billedAs }}.</p>
            }
            @if (b.unpricedItems) {
              <p>
                {{ b.unpricedItems }} machine{{ b.unpricedItems !== 1 ? 's or volumes' : ' or volume' }}
                could not be priced and {{ b.unpricedItems !== 1 ? 'are' : 'is' }} left out of these figures.
              </p>
            }
            @if (b.listPricedItems) {
              <p>
                {{ b.listPricedItems }} priced at today's list price: they started before Flui kept the price they were bought at.
              </p>
            }
          </div>
        }

        @if (groups(); as g) {
          <div class="card-surface">
            <div class="p-4 border-b border-border flex items-center justify-between">
              <div class="flex items-center gap-2">
                <ng-icon
                  name="lucideServer"
                  class="h-4 w-4 text-muted-foreground"
                />
                <h3 class="text-sm font-medium text-foreground">
                  Machines ({{ g.active.length }})
                </h3>
              </div>
              <a routerLink="/infrastructure/costs" class="text-xs text-primary hover:underline">All costs</a>
            </div>
            <div class="divide-y divide-border">
              @for (node of g.active; track node.nodeId) {
                <ng-container *ngTemplateOutlet="nodeRow; context: { $implicit: node, b: b }" />
              }
              @if (g.removed.length) {
                <button
                  type="button"
                  class="w-full p-4 flex items-center justify-between text-left hover:bg-muted/40"
                  (click)="showRemoved.set(!showRemoved())"
                >
                  <span class="text-sm text-sub">
                    {{ g.removed.length }} removed this month
                  </span>
                  <span class="flex items-center gap-2 text-sm font-semibold text-value">
                    {{ money(b.vat?.included ? g.removedGross : g.removedNet) }}
                    <ng-icon
                      name="lucideChevronDown"
                      class="h-4 w-4 text-muted-foreground transition-transform"
                      [class.rotate-180]="showRemoved()"
                    />
                  </span>
                </button>
                @if (showRemoved()) {
                  @for (node of g.removed; track node.nodeId) {
                    <ng-container *ngTemplateOutlet="nodeRow; context: { $implicit: node, b: b }" />
                  }
                }
              }
            </div>
          </div>
        }

        <ng-template #nodeRow let-node let-b="b">
          <div class="p-4">
            <div class="flex items-start justify-between mb-2">
              <div>
                <p class="text-sm font-medium text-value">
                  {{ node.serverName }}
                </p>
                <div class="flex items-center gap-2 mt-0.5">
                  <span
                    class="text-xs px-1.5 py-0.5 rounded font-medium"
                    [class]="
                      node.nodeType === 'master'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-muted text-muted-foreground'
                    "
                  >
                    {{ node.nodeType }}
                  </span>
                  <span class="text-xs text-sub">{{ node.currentServerType }}</span>
                  <span
                    class="text-xs px-1.5 py-0.5 rounded"
                    [class]="
                      node.status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    "
                  >
                    {{ node.status === 'active' ? 'running' : 'removed' }}
                  </span>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-semibold text-value">
                  {{ money(shown(b, { gross: node.costGross, net: node.costNet })) }}
                </p>
                <p class="text-xs text-sub">{{ node.billableHours }}h billed</p>
              </div>
            </div>

            @if (node.segments.length > 1) {
              <div class="mt-3 pt-3 border-t border-border space-y-1">
                <p class="text-xs text-sub font-medium mb-1">
                  Server type changes this month:
                </p>
                @for (seg of node.segments; track $index) {
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-sub">
                      {{ seg.serverType }} · {{ seg.hours }}h ({{ formatDate(seg.startedAt) }}
                      —
                      {{ seg.endedAt ? formatDate(seg.endedAt) : 'now' }})
                    </span>
                    <span class="text-value font-medium">{{
                      money(shown(b, { gross: seg.costGross, net: seg.costNet }))
                    }}</span>
                  </div>
                }
              </div>
            }
          </div>
        </ng-template>

        <!-- Volumes -->
        @if (b.monthToDate.volumes.length > 0) {
          <div class="card-surface">
            <div class="p-4 border-b border-border">
              <div class="flex items-center gap-2">
                <ng-icon
                  name="lucideHardDrive"
                  class="h-4 w-4 text-muted-foreground"
                />
                <h3 class="text-sm font-medium text-foreground">
                  Volumes ({{ b.monthToDate.volumes.length }})
                </h3>
              </div>
            </div>
            <div class="divide-y divide-border">
              @for (
                vol of b.monthToDate.volumes;
                track vol.volumeProviderId
              ) {
                <div
                  class="p-4 flex items-start justify-between"
                >
                  <div>
                    <p class="text-sm font-medium text-value">
                      {{ vol.kind }} · {{ vol.currentSizeGb }} GB
                    </p>
                    <p class="text-xs text-sub mt-0.5">
                      ID: {{ vol.volumeProviderId | maskId }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-semibold text-value">
                      {{ money(shown(b, { gross: vol.costGross, net: vol.costNet })) }}
                    </p>
                    <p class="text-xs text-sub">
                      {{ vol.status === 'active' ? 'in use' : 'removed' }}
                    </p>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <p class="text-xs text-muted-foreground text-right">
          Calculated at {{ formatDateTime(b.calculatedAt) }}
        </p>
      </div>
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
  readonly showRemoved = signal(false);
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

  formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
