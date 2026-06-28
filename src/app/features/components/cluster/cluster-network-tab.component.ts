import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideNetwork,
  lucideGlobe,
  lucideExternalLink,
  lucideLoader,
  lucidePlus,
  lucideInfo,
  lucideShieldCheck,
} from '@ng-icons/lucide';

import { ClusterService } from '../../service/cluster.service';
import { VNetService } from '../../service/vnet.service';
import { VNetInfo } from '../../model/vnet.models';
import { AttachVNetDialogComponent } from './attach-vnet-dialog.component';

@Component({
  selector: 'cluster-network-tab',
  standalone: true,
  imports: [CommonModule, NgIconComponent, AttachVNetDialogComponent],
  providers: [
    provideIcons({
      lucideNetwork,
      lucideGlobe,
      lucideExternalLink,
      lucideLoader,
      lucidePlus,
      lucideInfo,
      lucideShieldCheck,
    }),
  ],
  template: `
    <div class="card-surface p-6">
      <div class="flex items-center justify-end mb-6">
        @if (!isByos()) {
          <button
            (click)="navigateToVNetManagement()"
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors"
          >
            <span>Manage VNets</span>
            <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
          </button>
        }
      </div>

      @if (isByos() && clusterVNet()) {
        <div class="card-inner border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 mb-4 flex items-start gap-2.5">
          <ng-icon name="lucideShieldCheck" class="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <span class="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              Registered (self-hosted)
            </span>
            <p class="text-sm text-sub mt-1">
              Flui doesn't provision this network — it's the private network your nodes
              already share. Flui registers its CIDR (the host firewall opens it for
              node-to-node traffic) and validates that each node belongs to it.
            </p>
          </div>
        </div>
      }

      @if (isLoading()) {
        <div class="animate-pulse space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (i of [1,2]; track i) {
              <div class="card-inner p-4 space-y-3">
                <div class="flex items-center gap-2">
                  <div class="skeleton h-4 w-4"></div>
                  <div class="skeleton h-3 w-20"></div>
                </div>
                <div class="skeleton h-7 w-40"></div>
              </div>
            }
          </div>
          <div class="space-y-2">
            <div class="skeleton h-4 w-16"></div>
            @for (i of [1,2]; track i) {
              <div class="skeleton h-12 rounded-lg"></div>
            }
          </div>
        </div>
      } @else if (clusterVNet()) {
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="card-inner p-4">
              <div class="flex items-center gap-2 mb-2">
                <ng-icon name="lucideNetwork" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span class="text-label">VNet Name</span>
              </div>
              <p class="text-lg font-bold text-value">{{ clusterVNet()!.name }}</p>
            </div>

            <div class="card-inner p-4">
              <div class="flex items-center gap-2 mb-2">
                <ng-icon name="lucideGlobe" class="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span class="text-label">IP Range</span>
              </div>
              <p class="text-lg font-mono font-bold text-value">{{ clusterVNet()!.ipRange }}</p>
            </div>
          </div>

          @if (clusterVNet()!.subnets && clusterVNet()!.subnets.length > 0) {
            <div class="mt-4">
              <h3 class="text-sm font-semibold text-foreground mb-3">Subnets</h3>
              <div class="space-y-2">
                @for (subnet of clusterVNet()!.subnets; track subnet.id) {
                  <div class="card-inner p-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <span class="font-mono text-sm text-value">{{ subnet.ipRange }}</span>
                      </div>
                      @if (subnet.attachedServerIds.length > 0) {
                        <span class="text-xs text-sub">
                          {{ subnet.attachedServerIds.length }} server(s) attached
                        </span>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      } @else if (isByos()) {
        <div class="text-center py-8">
          <ng-icon name="lucideNetwork" class="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p class="text-sm text-sub">No private network registered yet.</p>
          <p class="text-xs text-sub mt-1 max-w-md mx-auto">
            Flui registers the private network your nodes share (it isn't provisioned).
            Register it to open the host firewall for node-to-node traffic and enable
            multi-node scaling.
          </p>
          <button
            (click)="registerByosNetwork()"
            [disabled]="registering()"
            class="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (registering()) {
              <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
            } @else {
              <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
            }
            <span>Register private network</span>
          </button>
          @if (registerError()) {
            <p class="text-xs status-error mt-2">{{ registerError() }}</p>
          }
        </div>
      } @else {
        <div class="text-center py-8">
          <ng-icon name="lucideNetwork" class="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p class="text-sm text-sub">No network configuration found for this cluster.</p>
          @if (canAttach()) {
            <p class="text-xs text-sub mt-1">
              Attach a VNet to enable private networking and autoscaling.
            </p>
            <button
              (click)="openAttachVNet()"
              class="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
              <span>Attach VNet</span>
            </button>
          }
        </div>
      }
    </div>

    @if (showAttachDialog() && clusterId(); as cid) {
      <app-attach-vnet-dialog
        [clusterId]="cid"
        [provider]="clusterProvider()"
        (closed)="showAttachDialog.set(false)"
        (attached)="onVNetAttached()"
      />
    }
  `,
})
export class ClusterNetworkTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly vnetService = inject(VNetService);
  private readonly router = inject(Router);

  clusterVNet = signal<VNetInfo | null>(null);
  isLoading = signal<boolean>(false);
  showAttachDialog = signal<boolean>(false);
  registering = signal<boolean>(false);
  registerError = signal<string | null>(null);

  clusterId = (): string | null => this.clusterService.cluster()?.id ?? null;
  clusterProvider = (): string => this.clusterService.cluster()?.provider ?? '';
  isByos = (): boolean => this.clusterService.isByosCluster();
  canAttach = (): boolean =>
    !this.isByos() && !!this.clusterId() && !!this.clusterProvider();

  async registerByosNetwork(): Promise<void> {
    const clusterId = this.clusterId();
    if (!clusterId) return;
    this.registering.set(true);
    this.registerError.set(null);
    try {
      await this.clusterService.ensureByosVNet(clusterId);
      await this.loadClusterVNet('byos', clusterId);
    } catch (e: any) {
      this.registerError.set(
        e?.error?.message || e?.message || 'Failed to register the private network',
      );
    } finally {
      this.registering.set(false);
    }
  }

  openAttachVNet(): void {
    this.showAttachDialog.set(true);
  }

  async onVNetAttached(): Promise<void> {
    this.showAttachDialog.set(false);
    const cluster = this.clusterService.cluster();
    if (cluster?.provider && cluster?.id) {
      await this.loadClusterVNet(cluster.provider, cluster.id);
    }
  }

  ngOnInit(): void {
    void (async () => {
      const cluster = this.clusterService.cluster();
      if (cluster?.provider && cluster?.id) {
        await this.loadClusterVNet(cluster.provider, cluster.id);
      }
    })();
  }

  async loadClusterVNet(provider: string, clusterId: string) {
    this.isLoading.set(true);
    try {
      await this.vnetService.loadVNets(provider, clusterId);
      const vnets = this.vnetService.vnets();
      this.clusterVNet.set(vnets.length > 0 ? vnets[0] : null);
    } catch (error) {
      console.error('Failed to load cluster VNet:', error);
      this.clusterVNet.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  navigateToVNetManagement() {
    this.router.navigate(['/infrastructure/vnet']);
  }
}
