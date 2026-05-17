import { Component, computed, effect, inject, signal, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideShieldPlus,
  lucideInfo,
  lucideLoader,
  lucideAlertTriangle,
  lucideCircleCheck,
  lucideCircle,
  lucideAlertCircle,
  lucideRefreshCw,
  lucideServer,
} from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { AuthzInstallService } from '../../service/authz-install.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { AuthzInstallResponseDto } from '../../../core/api/model/authzInstallResponseDto';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';

@Component({
  selector: 'app-infrastructure-auth-proxy',
  standalone: true,
  imports: [NgIconComponent, FormsModule, ConfirmationDialogComponent],
  providers: [
    provideIcons({
      lucideShieldPlus, lucideInfo, lucideLoader, lucideAlertTriangle,
      lucideCircleCheck, lucideCircle, lucideAlertCircle, lucideRefreshCw, lucideServer,
    }),
  ],
  template: `
    <div class="space-y-4">

      <div class="flex items-start gap-2 text-sm text-muted-foreground">
        <ng-icon name="lucideInfo" class="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500 dark:text-blue-400" />
        <p>
          Auth Proxy protects internal apps so only logged-in team members can reach them. Install once per cluster — no extra config.
        </p>
      </div>

      @if (!isOidc) {
        <div class="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-md text-sm">
          <ng-icon name="lucideAlertTriangle" class="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p class="font-medium text-amber-900 dark:text-amber-100">Auth Proxy requires OIDC login.</p>
            <p class="text-amber-700 dark:text-amber-300 mt-0.5 text-xs">Configure OIDC in the platform settings before installing.</p>
          </div>
        </div>
      }

      @if (clustersLoading()) {
        <div class="h-9 w-full max-w-sm animate-pulse rounded bg-muted"></div>
      } @else if (workloadClusters().length === 0) {
        <div class="flex items-start gap-3 p-3 bg-muted/40 border border-border rounded-md text-sm">
          <ng-icon name="lucideInfo" class="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p class="text-muted-foreground">No clusters available. Create a cluster first.</p>
        </div>
      } @else {
        <!-- Cluster picker row -->
        <div class="flex flex-wrap items-center gap-2">
          <label class="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <ng-icon name="lucideServer" class="h-4 w-4" />
            Cluster
          </label>
          <select
            [ngModel]="selectedClusterId()"
            (ngModelChange)="onClusterChange($event)"
            class="px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-[16rem]"
          >
            <option value="">Select a cluster...</option>
            @for (c of workloadClusters(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
          @if (selectedClusterId()) {
            <button
              type="button"
              (click)="refresh()"
              [disabled]="authzService.loading()"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-sm rounded-md hover:bg-muted text-foreground transition-colors disabled:opacity-50 ml-auto"
            >
              <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="authzService.loading()" />
              Refresh
            </button>
          }
        </div>

        <!-- Status card (full width) -->
        @if (!selectedClusterId()) {
          <p class="text-sm text-muted-foreground">Select a cluster to view its Auth Proxy status.</p>
        } @else if (authzService.loading() && !authzService.install()) {
          <div class="border border-border rounded-md p-4 flex items-center gap-2 text-sm text-muted-foreground">
            <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
            Loading status...
          </div>
        } @else {
          <div class="border border-border rounded-md p-4 space-y-4">

            <!-- Header row: title + status + actions -->
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex items-center gap-2 min-w-0">
                <ng-icon name="lucideShieldPlus" class="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span class="text-sm font-semibold text-foreground truncate">Internal app protection</span>
              </div>
              <span class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" [class]="statusBadgeClass()">
                <span class="w-1.5 h-1.5 rounded-full" [class]="statusDotClass()"></span>
                {{ statusLabel() }}
              </span>

              <div class="flex items-center gap-2 ml-auto">
                @if (showInstallButton()) {
                  <button
                    (click)="onInstall()"
                    [disabled]="authzService.installing() || authzService.loading() || !isOidc"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    @if (authzService.installing()) {
                      <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                      Installing...
                    } @else { Install }
                  </button>
                }
                @if (showRetryButton()) {
                  <button
                    (click)="onInstall()"
                    [disabled]="authzService.installing() || !isOidc"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    @if (authzService.installing()) {
                      <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                      Retrying...
                    } @else { Retry }
                  </button>
                }
                @if (showUninstallButton()) {
                  <button
                    (click)="uninstallDialog.open()"
                    [disabled]="authzService.installing()"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-red-300 dark:border-red-700/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Uninstall
                  </button>
                }
              </div>
            </div>

            @if (authzService.install()?.installedAt) {
              <p class="text-xs text-muted-foreground">
                Installed {{ formatDate(authzService.install()!.installedAt!) }}
              </p>
            }

            <!-- Progress bar -->
            @if (authzService.installing()) {
              <div class="space-y-1.5">
                <div class="flex justify-between text-xs text-muted-foreground">
                  <span>{{ authzService.progressStep() || 'Working...' }}</span>
                  <span>{{ authzService.progress() }}%</span>
                </div>
                <div class="w-full bg-muted rounded-full h-1.5">
                  <div class="bg-blue-600 h-1.5 rounded-full transition-all duration-500" [style.width.%]="authzService.progress()"></div>
                </div>
              </div>
            }

            <!-- Errors -->
            @if (authzService.error()) {
              <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded text-sm text-red-700 dark:text-red-400">
                <ng-icon name="lucideAlertCircle" class="h-4 w-4 mt-0.5 flex-shrink-0" />
                {{ authzService.error() }}
              </div>
            }
            @if (authzService.install()?.status === 'FAILED' && authzService.install()?.errorMessage) {
              <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded text-sm text-red-700 dark:text-red-400">
                <ng-icon name="lucideAlertCircle" class="h-4 w-4 mt-0.5 flex-shrink-0" />
                {{ authzService.install()!.errorMessage }}
              </div>
            }
          </div>
        }
      }

    </div>

    <app-confirmation-dialog
      #uninstallDialog
      title="Remove Auth Proxy"
      message="Remove flui-authz from this cluster? Internal apps will fall back to the legacy external ForwardAuth proxy. No data is lost."
      confirmText="Remove"
      variant="danger"
      (confirmed)="onUninstall()"
    />
  `,
})
export class InfrastructureAuthProxyComponent implements OnInit {
  protected readonly authzService = inject(AuthzInstallService);
  private readonly clusterService = inject(ClusterService);
  private readonly cfg = inject(AppConfigService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected isOidc = this.cfg.get().authMode === 'oidc';
  protected clustersLoading = signal(false);
  protected selectedClusterId = signal('');

  private readonly Status = AuthzInstallResponseDto.StatusEnum;

  protected workloadClusters = computed(() => this.clusterService.clusters());

  protected statusLabel = computed(() => {
    const s = this.authzService.install()?.status;
    if (!s || s === this.Status.Uninstalled) return 'Not installed';
    if (s === this.Status.Pending || s === this.Status.Installing) return 'Installing...';
    if (s === this.Status.Running) return 'Active';
    if (s === this.Status.Failed) return 'Failed';
    return 'Unknown';
  });

  protected statusBadgeClass = computed(() => {
    const s = this.authzService.install()?.status;
    if (s === this.Status.Running) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    if (s === this.Status.Failed) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    if (s === this.Status.Pending || s === this.Status.Installing)
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
    return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  });

  protected statusDotClass = computed(() => {
    const s = this.authzService.install()?.status;
    if (s === this.Status.Running) return 'bg-green-500';
    if (s === this.Status.Failed) return 'bg-red-500';
    if (s === this.Status.Pending || s === this.Status.Installing) return 'bg-amber-500';
    return 'bg-gray-400';
  });

  protected showInstallButton = computed(() => {
    const s = this.authzService.install()?.status;
    return !s || s === this.Status.Uninstalled;
  });

  protected showRetryButton = computed(() => this.authzService.install()?.status === this.Status.Failed);
  protected showUninstallButton = computed(() => {
    const s = this.authzService.install()?.status;
    return s === this.Status.Running || s === this.Status.Failed;
  });

  @ViewChild('uninstallDialog') protected uninstallDialog!: ConfirmationDialogComponent;

  constructor() {
    effect(() => {
      const id = this.selectedClusterId();
      if (id) void this.authzService.loadForCluster(id);
    });
  }

  ngOnInit(): void {
    void (async () => {
      this.clustersLoading.set(true);
      await this.clusterService.loadClusters();
      this.clustersLoading.set(false);
  
      const queryId = this.route.snapshot.queryParamMap.get('clusterId');
      const list = this.workloadClusters();
      if (queryId && list.some(c => c.id === queryId)) {
        this.selectedClusterId.set(queryId);
      } else if (list.length === 1 && list[0].id) {
        this.selectedClusterId.set(list[0].id);
      }
    })();
  }

  onClusterChange(id: string): void {
    this.selectedClusterId.set(id);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: id ? { clusterId: id } : {},
      replaceUrl: true,
    });
  }

  refresh(): void {
    const id = this.selectedClusterId();
    if (id) void this.authzService.loadForCluster(id);
  }

  async onInstall(): Promise<void> {
    const id = this.selectedClusterId();
    if (id) await this.authzService.installAuthz(id);
  }

  async onUninstall(): Promise<void> {
    const install = this.authzService.install();
    if (!install) return;
    this.uninstallDialog.setProcessing(true);
    await this.authzService.uninstallAuthz(install.id);
    this.uninstallDialog.close();
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
