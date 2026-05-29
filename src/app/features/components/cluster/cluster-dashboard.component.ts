import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideRefreshCw,
  lucideCircleAlert,
  lucideLoader,
  lucideLayoutDashboard,
  lucideChartArea,
  lucideNetwork,
  lucideHardDrive,
  lucideServer,
  lucideShield,
  lucideCreditCard,
  lucidePause,
  lucidePlay,
  lucideTrash2,
  lucideCircleCheck,
  lucideX,
  lucideSquare,
  lucideGlobe,
  lucideKey,
  lucideCopy,
  lucideCheck,
  lucideZap,
} from '@ng-icons/lucide';

import { ClusterService } from '../../service/cluster.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { ClusterStatus, ClusterType } from '../../model/cluster.models';

interface TabItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'cluster-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NgIconComponent,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideRefreshCw,
      lucideCircleAlert,
      lucideLoader,
      lucideLayoutDashboard,
      lucideChartArea,
      lucideNetwork,
      lucideHardDrive,
      lucideServer,
      lucideShield,
      lucideCreditCard,
      lucidePause,
      lucidePlay,
      lucideTrash2,
      lucideCircleCheck,
      lucideX,
      lucideSquare,
      lucideGlobe,
      lucideKey,
      lucideCopy,
      lucideCheck,
      lucideZap,
    }),
  ],
  template: `
    <div class="space-y-6 p-6">
      <!-- Skeleton Loader -->
      @if (isLoading() && !cluster()) {
        <div class="animate-pulse space-y-6">
          <!-- Header skeleton -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="skeleton h-8 w-8 rounded-lg"></div>
              <div class="skeleton h-6 w-48 rounded"></div>
            </div>
            <div class="flex gap-2">
              <div class="skeleton h-7 w-16 rounded"></div>
              <div class="skeleton h-7 w-16 rounded"></div>
              <div class="skeleton h-7 w-16 rounded"></div>
            </div>
          </div>
          <!-- Tab bar skeleton -->
          <div class="border-b border-border flex gap-1">
            @for (i of [1,2,3,4,5,6,7,8,9]; track i) {
              <div class="skeleton h-10 w-20 rounded-t"></div>
            }
          </div>
          <!-- Health bar skeleton -->
          <div class="skeleton h-10 rounded-lg"></div>
          <!-- 4 cards skeleton -->
          <div class="grid grid-cols-4 gap-3">
            @for (i of [1,2,3,4]; track i) {
              <div class="skeleton h-28 rounded-lg"></div>
            }
          </div>
          <!-- Info block skeleton -->
          <div class="skeleton h-24 rounded-lg"></div>
        </div>
      }

      <!-- Error State -->
      @if (errorMessage() && !isLoading()) {
        <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div class="flex items-center gap-3">
            <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-red-600 dark:text-red-400" />
            <div class="flex-1">
              <p class="text-sm font-medium text-red-900 dark:text-red-200">Failed to load cluster</p>
            <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ errorMessage() }}</p>
            </div>
          </div>
        </div>
      }

      <!-- Cluster Shell -->
      @if (cluster(); as clusterData) {
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button
              (click)="backToList()"
              class="p-1.5 border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
            </button>
            <div>
              <h2 class="text-lg font-semibold text-foreground">
                {{ clusterData.name }}
              </h2>
              @if (clusterData.id) {
                <div class="flex items-center gap-1 mt-0.5">
                  <span class="font-mono text-xs text-muted-foreground">{{ clusterData.id }}</span>
                  <button
                    (click)="copyId(clusterData.id); $event.stopPropagation()"
                    class="p-0.5 rounded hover:bg-muted transition-colors"
                    [title]="copiedId() ? 'Copied!' : 'Copy ID'"
                  >
                    @if (copiedId()) {
                      <ng-icon name="lucideCheck" class="h-3 w-3 text-green-500" />
                    } @else {
                      <ng-icon name="lucideCopy" class="h-3 w-3 text-muted-foreground" />
                    }
                  </button>
                </div>
              }
            </div>
          </div>

          <!-- Actions toolbar -->
          <div class="flex items-center gap-1">
            <button
              (click)="refreshCluster()"
              [disabled]="isLoading()"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-foreground hover:bg-muted rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Refresh"
            >
              <ng-icon
                name="lucideRefreshCw"
                class="h-3.5 w-3.5"
                [class.animate-spin]="isLoading()"
              />
              Refresh
            </button>
            @if (clusterData.status === ClusterStatus.ACTIVE || clusterData.status === ClusterStatus.STOPPING) {
              <button
                (click)="stopCluster()"
                [disabled]="clusterData.status !== ClusterStatus.ACTIVE || isControlCluster(clusterData.clusterType)"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-foreground hover:bg-muted rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                [title]="isControlCluster(clusterData.clusterType) ? 'Control cluster can only be managed via CLI' : 'Stop cluster'"
              >
                <ng-icon name="lucideSquare" class="h-3.5 w-3.5" />
                Stop
              </button>
            }
            @if (clusterData.status === ClusterStatus.STOPPED || clusterData.status === ClusterStatus.STARTING) {
              <button
                (click)="startCluster()"
                [disabled]="clusterData.status !== ClusterStatus.STOPPED || isControlCluster(clusterData.clusterType)"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-foreground hover:bg-muted rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                [title]="isControlCluster(clusterData.clusterType) ? 'Control cluster can only be managed via CLI' : 'Start cluster'"
              >
                <ng-icon name="lucidePlay" class="h-3.5 w-3.5" />
                Start
              </button>
            }
            <div class="w-px h-4 bg-border mx-1"></div>
            <button
              (click)="confirmDelete()"
              [disabled]="clusterData.status === ClusterStatus.DELETING || isControlCluster(clusterData.clusterType)"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              [title]="isControlCluster(clusterData.clusterType) ? 'Control cluster can only be managed via CLI' : 'Delete cluster'"
            >
              <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>

        <!-- Power alert inline -->
        @if (powerAlert()) {
          <div class="flex items-center gap-2 px-4 py-2 rounded-lg text-xs"
            [class]="powerAlert()!.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300'
              : powerAlert()!.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300'
                : 'bg-yellow-50 dark:bg-yellow-900/10 text-yellow-700 dark:text-yellow-300'"
          >
            <ng-icon
              [name]="powerAlert()!.type === 'error' ? 'lucideCircleAlert' : 'lucideCircleCheck'"
              class="h-3.5 w-3.5 flex-shrink-0"
            />
            <span class="flex-1">{{ powerAlert()!.message }}</span>
            <button (click)="dismissPowerAlert()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <ng-icon name="lucideX" class="h-3 w-3" />
            </button>
          </div>
        }

        <!-- Tab Navigation -->
        <div class="border-b border-border relative">
          <nav class="flex -mb-px gap-1 overflow-x-auto scrollbar-none pr-8">
            @for (tab of tabs; track tab.route) {
              <a
                [routerLink]="[tab.route]"
                routerLinkActive #rla="routerLinkActive"
                [routerLinkActiveOptions]="{ exact: true }"
                [title]="tab.label"
                class="inline-flex items-center gap-1.5 px-3 md:px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0"
                [class]="rla.isActive
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
              >
                <ng-icon [name]="tab.icon" class="h-4 w-4 flex-shrink-0" />
                <span class="hidden md:inline">{{ tab.label }}</span>
              </a>
            }
          </nav>
          <div class="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background to-transparent"></div>
        </div>

        <!-- Tab Content -->
        <div class="mt-6">
          <router-outlet />
        </div>
      }
    </div>

    <!-- Delete Confirmation Modal -->
    @if (showDeleteModal()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="card-surface rounded-lg max-w-md w-full p-6 shadow-xl">
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0">
              <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <ng-icon name="lucideCircleAlert" class="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-foreground mb-2">Delete Cluster</h3>
              <p class="text-sm text-sub mb-4">
                Are you sure you want to delete <strong>{{ cluster()?.name }}</strong>?
                This action cannot be undone.
              </p>
              <label class="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  [(ngModel)]="forceDelete"
                  class="rounded border-border text-blue-600 focus:ring-blue-500"
                />
                <span class="text-sm text-foreground">Force delete (skip cleanup)</span>
              </label>
              <div class="flex items-center gap-3">
                <button
                  (click)="cancelDelete()"
                  [disabled]="isDeleting()"
                  class="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  (click)="executeDelete()"
                  [disabled]="isDeleting()"
                  class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  @if (isDeleting()) {
                    <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                    Deleting...
                  } @else {
                    <ng-icon name="lucideTrash2" class="h-4 w-4" />
                    Delete
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ClusterDashboardComponent implements OnInit, OnDestroy {
  copiedId = signal(false);
  private readonly clusterService = inject(ClusterService);
  private readonly autoscaleService = inject(ClusterAutoscaleService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ClusterStatus = ClusterStatus;

  tabs: TabItem[] = [
    { label: 'Overview', route: 'overview', icon: 'lucideLayoutDashboard' },
    { label: 'Monitoring', route: 'monitoring', icon: 'lucideChartArea' },
    { label: 'Network', route: 'network', icon: 'lucideNetwork' },
    { label: 'Storage', route: 'storage', icon: 'lucideHardDrive' },
    { label: 'Nodes', route: 'nodes', icon: 'lucideServer' },
    { label: 'Autoscaling', route: 'autoscaling', icon: 'lucideZap' },
    { label: 'Firewall', route: 'firewall', icon: 'lucideShield' },
    { label: 'DNS', route: 'dns', icon: 'lucideGlobe' },
    { label: 'Variables', route: 'variables', icon: 'lucideKey' },
    { label: 'Pricing', route: 'pricing', icon: 'lucideCreditCard' },
  ];

  private readonly clusterId = signal<string | null>(null);

  cluster = this.clusterService.cluster;
  isLoading = this.clusterService.loading;
  errorMessage = this.clusterService.errorMessage;

  powerAlert = signal<{ type: 'error' | 'success' | 'warning'; message: string } | null>(null);
  showDeleteModal = signal(false);
  isDeleting = signal(false);
  forceDelete = false;

  ngOnInit(): void {
    void (async () => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.clusterId.set(id);
        await this.loadClusterData(id);
        this.autoscaleService.startStatusPolling(id);
        void this.autoscaleService.loadDefaults().catch(() => undefined);
      }
    })();
  }

  ngOnDestroy(): void {
    this.autoscaleService.stopStatusPolling();
    this.autoscaleService.resetState();
  }

  async loadClusterData(clusterId: string) {
    try {
      await this.clusterService.selectCluster(clusterId);
    } catch (error) {
      console.error('Failed to load cluster:', error);
    }
  }

  async refreshCluster() {
    const id = this.clusterId();
    if (id) {
      await this.loadClusterData(id);
    }
  }

  backToList() {
    this.router.navigate(['/cluster']);
  }

  isControlCluster(type?: ClusterType): boolean {
    return type === ClusterType.CONTROL || type === ClusterType.OBSERVABILITY;
  }

  async stopCluster() {
    const c = this.cluster();
    if (!c?.id) return;
    try {
      this.powerAlert.set(null);
      await this.clusterService.stopCluster(c.id);
      this.powerAlert.set({ type: 'success', message: 'Cluster stop operation initiated successfully' });
      setTimeout(() => { if (this.powerAlert()?.type === 'success') this.powerAlert.set(null); }, 5000);
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Unknown error';
      this.powerAlert.set({ type: 'error', message: `Failed to stop cluster: ${msg}` });
    }
  }

  async startCluster() {
    const c = this.cluster();
    if (!c?.id) return;
    try {
      this.powerAlert.set(null);
      await this.clusterService.startCluster(c.id);
      this.powerAlert.set({ type: 'success', message: 'Cluster start operation initiated successfully' });
      setTimeout(() => { if (this.powerAlert()?.type === 'success') this.powerAlert.set(null); }, 5000);
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Unknown error';
      this.powerAlert.set({ type: 'error', message: `Failed to start cluster: ${msg}` });
    }
  }

  dismissPowerAlert() {
    this.powerAlert.set(null);
  }

  confirmDelete() {
    this.showDeleteModal.set(true);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.forceDelete = false;
  }

  async executeDelete() {
    const c = this.cluster();
    if (!c?.id) return;
    this.isDeleting.set(true);
    try {
      await this.clusterService.deleteCluster(c.id, this.forceDelete);
      this.showDeleteModal.set(false);
      this.forceDelete = false;
      setTimeout(() => this.router.navigate(['/cluster']), 1000);
    } catch (error) {
      console.error('Failed to delete cluster:', error);
    } finally {
      this.isDeleting.set(false);
    }
  }

  copyId(id: string): void {
    navigator.clipboard.writeText(id);
    this.copiedId.set(true);
    setTimeout(() => this.copiedId.set(false), 2000);
  }
}
