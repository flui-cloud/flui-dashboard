import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
} from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';

import { ClusterService } from '../../service/cluster.service';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';

interface BillingPeriod {
  start: string;
  end: string;
  totalHours: number;
  elapsedHours: number;
}

interface Breakdown {
  computeGross: string;
  computeNet: string;
  storageGross: string;
  storageNet: string;
  trafficGross: string;
  trafficNet: string;
}

interface NodeSegment {
  serverType: string;
  startedAt: string;
  endedAt: string | null;
  hours: number;
  costGross: string;
  costNet: string;
}

interface NodeMtd {
  nodeId: string;
  serverName: string;
  nodeType: string;
  currentServerType: string;
  providerResourceId: string | null;
  status: 'active' | 'terminated';
  billableHours: number;
  costGross: string;
  costNet: string;
  segments: NodeSegment[];
}

interface VolumeMtd {
  volumeProviderId: string;
  kind: string;
  currentSizeGb: number;
  status: 'active' | 'terminated';
  costGross: string;
  costNet: string;
}

interface TrafficInfo {
  outgoingBytes: number;
  ingoingBytes: number;
  includedBytes: number;
  overageBytes: number;
  overageCostGross: string;
  overageCostNet: string;
}

interface MonthToDate {
  totalGross: string;
  totalNet: string;
  breakdown: Breakdown;
  nodes: NodeMtd[];
  volumes: VolumeMtd[];
  traffic: TrafficInfo;
}

interface RunRate {
  monthlyGross: string;
  monthlyNet: string;
  breakdown: Breakdown;
  activeNodes: number;
  activeVolumes: number;
}

interface ClusterBilling {
  clusterId: string;
  clusterName: string;
  provider: string;
  region: string;
  currency: string;
  billingPeriod: BillingPeriod;
  monthToDate: MonthToDate;
  runRate: RunRate;
  calculatedAt: string;
}

@Component({
  selector: 'cluster-pricing-tab',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
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
    }),
  ],
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

        <!-- Spent this month + Run rate -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="card-surface p-5">
            <div class="flex items-center gap-2 mb-3">
              <ng-icon
                name="lucideCreditCard"
                class="h-4 w-4 text-green-600 dark:text-green-400"
              />
              <span class="text-label">Spent this month</span>
            </div>
            <p class="text-2xl font-bold text-value">
              {{ b.currency }} {{ formatCost(b.monthToDate.totalGross) }}
            </p>
            <p class="text-xs text-sub mt-1">
              Net: {{ b.currency }} {{ formatCost(b.monthToDate.totalNet) }}
            </p>
            <p class="text-xs text-sub mt-2">
              From {{ formatDate(b.billingPeriod.start) }} to today — includes
              already-terminated nodes
            </p>
            <div class="mt-3 pt-3 border-t border-border space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-sub">Compute</span>
                <span class="text-value font-medium"
                  >{{ b.currency }}
                  {{ formatCost(b.monthToDate.breakdown.computeGross) }}</span
                >
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-sub">Storage</span>
                <span class="text-value font-medium"
                  >{{ b.currency }}
                  {{ formatCost(b.monthToDate.breakdown.storageGross) }}</span
                >
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-sub">Traffic</span>
                <span class="text-value font-medium"
                  >{{ b.currency }}
                  {{ formatCost(b.monthToDate.breakdown.trafficGross) }}</span
                >
              </div>
            </div>
          </div>

          <div class="card-surface p-5">
            <div class="flex items-center gap-2 mb-3">
              <ng-icon
                name="lucideGauge"
                class="h-4 w-4 text-purple-600 dark:text-purple-400"
              />
              <span class="text-label">Run rate</span>
            </div>
            <p class="text-2xl font-bold text-value">
              {{ b.currency }} {{ formatCost(b.runRate.monthlyGross) }}
            </p>
            <p class="text-xs text-sub mt-1">
              Net: {{ b.currency }} {{ formatCost(b.runRate.monthlyNet) }}
            </p>
            <p class="text-xs text-sub mt-2">
              {{ b.runRate.activeNodes }} node{{
                b.runRate.activeNodes !== 1 ? 's' : ''
              }}
              + {{ b.runRate.activeVolumes }} volume{{
                b.runRate.activeVolumes !== 1 ? 's' : ''
              }}
              at the current rate, for a full month
            </p>
            <div class="mt-3 pt-3 border-t border-border space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-sub">Compute</span>
                <span class="text-value font-medium"
                  >{{ b.currency }}
                  {{ formatCost(b.runRate.breakdown.computeGross) }}</span
                >
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-sub">Storage</span>
                <span class="text-value font-medium"
                  >{{ b.currency }}
                  {{ formatCost(b.runRate.breakdown.storageGross) }}</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Nodes -->
        <div class="card-surface">
          <div class="p-4 border-b border-border">
            <div class="flex items-center gap-2">
              <ng-icon
                name="lucideServer"
                class="h-4 w-4 text-muted-foreground"
              />
              <h3 class="text-sm font-medium text-foreground">
                Nodes ({{ b.monthToDate.nodes.length }})
              </h3>
            </div>
          </div>
          <div class="divide-y divide-border">
            @for (node of b.monthToDate.nodes; track node.nodeId) {
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
                      <span class="text-xs text-sub">{{
                        node.currentServerType
                      }}</span>
                      <span
                        class="text-xs px-1.5 py-0.5 rounded"
                        [class]="
                          node.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        "
                      >
                        {{
                          node.status === 'active' ? 'active' : 'terminated'
                        }}
                      </span>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-semibold text-value">
                      {{ b.currency }} {{ formatCost(node.costGross) }}
                    </p>
                    <p class="text-xs text-sub">
                      {{ node.billableHours }}h billed
                    </p>
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
                          {{ seg.serverType }} · {{ seg.hours }}h ({{
                            formatDate(seg.startedAt)
                          }}
                          —
                          {{ seg.endedAt ? formatDate(seg.endedAt) : 'now' }})
                        </span>
                        <span class="text-value font-medium"
                          >{{ b.currency }} {{ formatCost(seg.costGross) }}</span
                        >
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>

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
                      ID: {{ vol.volumeProviderId }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-semibold text-value">
                      {{ b.currency }} {{ formatCost(vol.costGross) }}
                    </p>
                    <p class="text-xs text-sub">
                      {{ vol.status === 'active' ? 'active' : 'terminated' }}
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

  formatCost(value: string, decimals = 2): string {
    return Number.parseFloat(value || '0').toFixed(decimals);
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
