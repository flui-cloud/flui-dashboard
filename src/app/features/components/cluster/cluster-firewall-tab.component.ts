import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideShield,
  lucideCalendar,
  lucideExternalLink,
  lucideLoader,
} from '@ng-icons/lucide';

import { ClusterService } from '../../service/cluster.service';
import { FirewallV2Service } from '../../service/firewall-v2.service';
import { FirewallResponseDto } from '../../../core/api/model/models';
import { ReconciliationStatusBadgeComponent } from '../firewall/reconciliation-status-badge.component';
import { DriftIndicatorComponent } from '../firewall/drift-indicator.component';

@Component({
  selector: 'cluster-firewall-tab',
  standalone: true,
  imports: [
    CommonModule,
    NgIconComponent,
    ReconciliationStatusBadgeComponent,
    DriftIndicatorComponent,
  ],
  providers: [
    provideIcons({
      lucideShield,
      lucideCalendar,
      lucideExternalLink,
      lucideLoader,
    }),
  ],
  template: `
    <div class="card-surface p-6">
      <div class="flex items-center justify-end mb-6">
        <button
          (click)="navigateToFirewallManagement()"
          [disabled]="!clusterFirewall()"
          class="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
        >
          <span>View & Manage Rules</span>
          <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
        </button>
      </div>

      @if (isLoading()) {
        <div class="animate-pulse space-y-4">
          <!-- Status & Last Reconciled skeleton -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="card-inner p-4 space-y-3">
              <div class="skeleton h-3 w-16"></div>
              <div class="skeleton h-6 w-24"></div>
            </div>
            <div class="card-inner p-4 space-y-3">
              <div class="skeleton h-3 w-28"></div>
              <div class="skeleton h-7 w-32"></div>
            </div>
          </div>
          <!-- Rules table skeleton -->
          <div class="rounded-lg border border-border overflow-hidden">
            <div class="skeleton h-9 border-b border-border"></div>
            @for (i of [1,2,3,4,5]; track i) {
              <div class="flex items-center gap-3 px-3 py-2.5 border-b border-border">
                <div class="skeleton h-4 flex-1"></div>
                <div class="skeleton h-5 w-12"></div>
                <div class="skeleton h-4 w-12"></div>
                <div class="skeleton h-4 w-10"></div>
                <div class="skeleton h-4 w-28"></div>
              </div>
            }
          </div>
        </div>
      } @else if (clusterFirewall()) {
        <div class="space-y-4">
          <!-- Status & Last Reconciled -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Reconciliation Status -->
            <div class="card-inner p-4">
              <div class="flex items-center gap-2 mb-2">
                <ng-icon name="lucideShield" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span class="text-label">Status</span>
              </div>
              <div class="flex items-center gap-2">
                <app-reconciliation-status-badge [status]="clusterFirewall()!.reconciliationStatus!" />
                @if (clusterFirewall()!.reconciliationStatus === 'DRIFT' || clusterFirewall()!.reconciliationStatus === 'PENDING') {
                  <button
                    (click)="refreshFirewall()"
                    class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Reconcile
                  </button>
                }
              </div>
            </div>

            <!-- Last Reconciled -->
            <div class="card-inner p-4">
              <div class="flex items-center gap-2 mb-2">
                <ng-icon name="lucideCalendar" class="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span class="text-label">Last Reconciled</span>
              </div>
              <p class="text-lg font-bold text-value">
                {{ getTimeSinceReconciliation(clusterFirewall()!.lastReconciliationAt) }}
              </p>
            </div>
          </div>

          <!-- Drift Indicator -->
          @if (clusterFirewall()!.reconciliationStatus) {
            <app-drift-indicator
              [hasDrift]="clusterFirewall()!.hasDrift"
              [status]="clusterFirewall()!.reconciliationStatus!"
              [desiredHash]="clusterFirewall()!.desiredHash"
              [lastAppliedHash]="clusterFirewall()!.lastAppliedHash"
            />
          }

          <!-- Applied Rules Summary -->
          @if (clusterFirewall()!.lastAppliedRules && clusterFirewall()!.lastAppliedRules!.length > 0) {
            <div class="mt-4">
              <h3 class="text-sm font-semibold text-foreground mb-3">
                Applied Rules ({{ clusterFirewall()!.lastAppliedRules!.length }})
              </h3>
              <div class="card-inner rounded-lg overflow-hidden">
                <table class="w-full text-sm">
                  <thead class="bg-muted border-b border-border">
                    <tr>
                      <th class="px-3 py-2 text-left text-label">Description</th>
                      <th class="px-3 py-2 text-center text-label">Direction</th>
                      <th class="px-3 py-2 text-left text-label">Protocol</th>
                      <th class="px-3 py-2 text-left text-label">Port</th>
                      <th class="px-3 py-2 text-left text-label">IPs</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    @for (rule of clusterFirewall()!.lastAppliedRules; track $index) {
                      <tr class="hover:bg-muted/50 transition-colors">
                        <td class="px-3 py-2 text-value font-medium">{{ $any(rule).description }}</td>
                        <td class="px-3 py-2 text-center">
                          <span class="text-xs px-2 py-1 rounded-full {{ $any(rule).direction === 'in' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' }}">
                            {{ $any(rule).direction === 'in' ? '→ In' : '← Out' }}
                          </span>
                        </td>
                        <td class="px-3 py-2 text-foreground font-mono">{{ $any(rule).protocol?.toUpperCase() }}</td>
                        <td class="px-3 py-2 text-foreground font-mono">{{ $any(rule).port || '-' }}</td>
                        <td class="px-3 py-2 text-sub text-xs font-mono">
                          @if ($any(rule).direction === 'in' && $any(rule).sourceIps) {
                            <span>{{ $any(rule).sourceIps.slice(0, 2).join(', ') }}{{ $any(rule).sourceIps.length > 2 ? '...' : '' }}</span>
                          } @else if ($any(rule).direction === 'out' && $any(rule).destinationIps) {
                            <span>{{ $any(rule).destinationIps.slice(0, 2).join(', ') }}{{ $any(rule).destinationIps.length > 2 ? '...' : '' }}</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          } @else {
            <div class="text-center py-6 card-inner rounded-lg">
              <p class="text-sm text-sub">No firewall rules configured</p>
            </div>
          }
        </div>
      } @else {
        <div class="text-center py-8">
          <ng-icon name="lucideShield" class="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p class="text-sm text-sub">No firewall configuration found for this cluster.</p>
        </div>
      }
    </div>
  `,
})
export class ClusterFirewallTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly firewallV2Service = inject(FirewallV2Service);
  private readonly router = inject(Router);

  clusterFirewall = signal<FirewallResponseDto | null>(null);
  isLoading = signal<boolean>(false);

  ngOnInit(): void {
    void (async () => {
      const cluster = this.clusterService.cluster();
      if (cluster?.id) {
        await this.loadClusterFirewall(cluster.id);
      }
    })();
  }

  async loadClusterFirewall(clusterId: string) {
    this.isLoading.set(true);
    try {
      const firewall = await this.firewallV2Service.getFirewallByCluster(clusterId);
      this.clusterFirewall.set(firewall || null);
    } catch (error) {
      console.error('Failed to load cluster firewall:', error);
      this.clusterFirewall.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshFirewall() {
    const cluster = this.clusterService.cluster();
    if (cluster?.id) {
      await this.loadClusterFirewall(cluster.id);
    }
  }

  navigateToFirewallManagement() {
    const firewall = this.clusterFirewall();
    if (firewall?.id) {
      this.router.navigate(['/infrastructure/firewall', firewall.id]);
    }
  }

  getTimeSinceReconciliation(timestamp?: string): string {
    if (!timestamp) return 'Never';
    const now = new Date();
    const reconciled = new Date(timestamp);
    const diffInMs = now.getTime() - reconciled.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes === 1) return '1 minute ago';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return '1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    return `${diffInDays} days ago`;
  }
}
