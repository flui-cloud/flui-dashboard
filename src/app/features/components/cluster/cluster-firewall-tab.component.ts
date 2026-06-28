import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideShield,
  lucideCalendar,
  lucideExternalLink,
  lucideLoader,
  lucideSettings,
  lucideCheck,
} from '@ng-icons/lucide';

import { ClusterService } from '../../service/cluster.service';
import { ProvidersService } from '../../service/providers.service';
import { FirewallV2Service } from '../../service/firewall-v2.service';
import { FirewallResponseDto } from '../../../core/api/model/models';
import { ReconciliationStatusBadgeComponent } from '../firewall/reconciliation-status-badge.component';
import { DriftIndicatorComponent } from '../firewall/drift-indicator.component';

@Component({
  selector: 'cluster-firewall-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
      lucideSettings,
      lucideCheck,
    }),
  ],
  template: `
    <div class="card-surface p-6">
      <div class="flex items-center justify-end mb-6">
        @if (clusterFirewall()) {
          <button
            (click)="navigateToFirewallManagement()"
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            <span>View & Manage Rules</span>
            <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
          </button>
        } @else if (isHostFirewall() && !isLoading()) {
          <button
            (click)="enableHostFirewall()"
            [disabled]="enabling()"
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            @if (enabling()) {
              <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
              <span>Enabling…</span>
            } @else {
              <ng-icon name="lucideShield" class="h-3.5 w-3.5" />
              <span>Enable host firewall</span>
            }
          </button>
        }
      </div>

      @if (isHostFirewall()) {
        <div class="card-inner p-4 mb-4">
          <button
            type="button"
            (click)="showSshSettings.set(!showSshSettings())"
            class="flex items-center gap-2 w-full text-left"
          >
            <ng-icon name="lucideSettings" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span class="text-label">SSH connection</span>
            <span class="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline">
              {{ showSshSettings() ? 'Hide' : 'Configure' }}
            </span>
          </button>
          @if (showSshSettings()) {
            <div class="mt-3 space-y-3">
              <p class="text-sm text-sub">
                Flui applies this host's firewall over SSH. Set how to reach the node.
                Leave <span class="font-mono">Host</span> empty to use the node's IP address.
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label class="block">
                  <span class="text-xs text-sub">Host (optional)</span>
                  <input
                    [(ngModel)]="sshHost"
                    placeholder="node IP / hostname"
                    class="mt-1 w-full text-sm bg-background border border-border rounded-md px-2 py-1.5 font-mono"
                  />
                </label>
                <label class="block">
                  <span class="text-xs text-sub">Port</span>
                  <input
                    [(ngModel)]="sshPort"
                    type="number"
                    min="1"
                    max="65535"
                    class="mt-1 w-full text-sm bg-background border border-border rounded-md px-2 py-1.5 font-mono"
                  />
                </label>
                <label class="block">
                  <span class="text-xs text-sub">User</span>
                  <input
                    [(ngModel)]="sshUser"
                    placeholder="root"
                    class="mt-1 w-full text-sm bg-background border border-border rounded-md px-2 py-1.5 font-mono"
                  />
                </label>
              </div>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  (click)="saveSshTarget()"
                  [disabled]="savingSsh()"
                  class="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                >
                  @if (savingSsh()) {
                    <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                    <span>Saving…</span>
                  } @else {
                    <span>Save & apply</span>
                  }
                </button>
                @if (sshSaved()) {
                  <span class="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <ng-icon name="lucideCheck" class="h-3.5 w-3.5" /> Saved
                  </span>
                }
                @if (sshError()) {
                  <span class="text-xs text-red-600 dark:text-red-400">{{ sshError() }}</span>
                }
              </div>
            </div>
          }
        </div>
      }

      @if (isLoading()) {
        <div class="animate-pulse space-y-4">
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
          @if (isHostFirewall()) {
            <p class="text-xs text-sub">
              Host firewall (nftables over SSH). SSH :22 stays always-open (CA-protected);
              ports 80 &amp; 443 are required and can't be removed (only IP-allowlisted);
              outbound traffic is not restricted.
            </p>
          }
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="card-inner p-4">
              <div class="flex items-center gap-2 mb-2">
                <ng-icon name="lucideShield" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span class="text-label">Status</span>
              </div>
              <div class="flex items-center gap-2">
                <app-reconciliation-status-badge [status]="clusterFirewall()!.reconciliationStatus!" />
                @if (clusterFirewall()!.reconciliationStatus === 'DRIFT' || clusterFirewall()!.reconciliationStatus === 'PENDING' || clusterFirewall()!.reconciliationStatus === 'ERROR') {
                  <button
                    (click)="reconcileFirewall()"
                    [disabled]="reconciling()"
                    class="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  >
                    {{ reconciling() ? 'Reconciling…' : 'Reconcile' }}
                  </button>
                }
              </div>
            </div>

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

          @if (clusterFirewall()!.reconciliationStatus) {
            <app-drift-indicator
              [hasDrift]="clusterFirewall()!.hasDrift"
              [status]="clusterFirewall()!.reconciliationStatus!"
              [desiredHash]="clusterFirewall()!.desiredHash"
              [lastAppliedHash]="clusterFirewall()!.lastAppliedHash"
            />
          }

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
      } @else if (isHostFirewall()) {
        <div class="card-inner p-4 space-y-2">
          <div class="flex items-center gap-2">
            <ng-icon name="lucideShield" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span class="text-label">Host firewall (nftables)</span>
          </div>
          <p class="text-sm text-sub">
            This server's firewall is enforced on the host with nftables over SSH —
            there is no cloud-edge firewall to manage here. Enabling generates a
            default ruleset and applies it on the node; you can then edit the rules.
          </p>
          @if (firewallCap()?.supportsSshAllowlist === false) {
            <p class="text-sm text-sub">
              SSH (port 22) stays open and is protected by short-lived CA certificates.
              IP-allowlisting port 22 is disabled to avoid locking yourself out (there is
              no out-of-band recovery channel). Allowlisting still applies to other ports.
            </p>
          }
          <p class="text-sm text-sub">
            Ports 80 and 443 must stay open (HTTPS ingress + ACME cert renewal) and
            can't be removed — only IP-allowlisted. Outbound traffic is not restricted
            (egress stays open).
          </p>
          @if (enableError()) {
            <p class="text-sm text-red-600 dark:text-red-400">{{ enableError() }}</p>
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
  private readonly providersService = inject(ProvidersService);
  private readonly router = inject(Router);

  clusterFirewall = signal<FirewallResponseDto | null>(null);
  isLoading = signal<boolean>(false);
  enabling = signal<boolean>(false);
  enableError = signal<string | null>(null);
  reconciling = signal<boolean>(false);

  showSshSettings = signal<boolean>(false);
  sshHost = '';
  sshPort = '22';
  sshUser = 'root';
  savingSsh = signal<boolean>(false);
  sshSaved = signal<boolean>(false);
  sshError = signal<string | null>(null);

  readonly firewallCap = computed(() => {
    const provider = this.clusterService.cluster()?.provider;
    return provider
      ? this.providersService.getProviderDefinition(provider)?.capabilities
          ?.firewall
      : undefined;
  });
  readonly isHostFirewall = computed(
    () => this.firewallCap()?.backend === 'host-nftables',
  );

  ngOnInit(): void {
    void (async () => {
      const cluster = this.clusterService.cluster();
      if (cluster?.provider) {
        this.providersService.loadProviderDefinition(cluster.provider);
      }
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

  async reconcileFirewall() {
    const firewall = this.clusterFirewall();
    if (!firewall?.id) return;
    this.reconciling.set(true);
    try {
      const updated = await this.firewallV2Service.reconcile(firewall.id);
      if (updated) this.clusterFirewall.set(updated);
    } finally {
      this.reconciling.set(false);
    }
  }

  async saveSshTarget() {
    const cluster = this.clusterService.cluster();
    if (!cluster?.id) return;
    this.savingSsh.set(true);
    this.sshSaved.set(false);
    this.sshError.set(null);
    try {
      const port = Number(this.sshPort) || 22;
      await this.clusterService.updateSshTarget(cluster.id, {
        host: this.sshHost.trim() || undefined,
        port,
        user: this.sshUser.trim() || 'root',
      });
      this.sshSaved.set(true);
      if (this.clusterFirewall()?.id) {
        await this.reconcileFirewall();
      }
    } catch (error: any) {
      this.sshError.set(error?.message || 'Failed to save SSH settings');
    } finally {
      this.savingSsh.set(false);
    }
  }

  async enableHostFirewall() {
    const cluster = this.clusterService.cluster();
    if (!cluster?.id) return;
    this.enabling.set(true);
    this.enableError.set(null);
    try {
      const firewall = await this.firewallV2Service.enableForCluster(cluster.id);
      if (firewall) {
        this.clusterFirewall.set(firewall);
      } else {
        this.enableError.set(
          this.firewallV2Service.error() || 'Failed to enable firewall',
        );
      }
    } catch (error) {
      console.error('Failed to enable host firewall:', error);
      this.enableError.set('Failed to enable firewall');
    } finally {
      this.enabling.set(false);
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
