import { Component, computed, effect, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { AuthzInstallService } from '../../service/authz-install.service';
import { AuthzInstallResponseDto } from '../../../core/api/model/authzInstallResponseDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

const STATUS = AuthzInstallResponseDto.StatusEnum;

@Component({
  selector: 'app-infrastructure-auth-proxy',
  imports: [
    FormsModule,
    FlPanel,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlUsageBar,
    FlEmptyState,
    FlLoadingState,
    FlActionsMenu,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Internal app protection" [flush]="true">
      <ng-container panelActions>
        @if (selectedClusterId()) {
          @if (showInstallButton()) {
            <button
              flButton="primary"
              size="sm"
              type="button"
              [disabled]="authzService.installing() || authzService.loading()"
              (click)="onInstall()"
            >
              @if (authzService.installing()) {
                <fl-spinner label="Installing" />
                Installing…
              } @else {
                Install
              }
            </button>
          }
          @if (showRetryButton()) {
            <button
              flButton="primary"
              size="sm"
              type="button"
              [disabled]="authzService.installing()"
              (click)="onInstall()"
            >
              @if (authzService.installing()) {
                <fl-spinner label="Retrying" />
                Retrying…
              } @else {
                Retry
              }
            </button>
          }
          @if (showUninstallButton()) {
            <fl-actions-menu
              label="Auth Proxy actions"
              size="sm"
              [compact]="true"
              [items]="menuItems()"
              (action)="confirmUninstall()"
            />
          }
        }
      </ng-container>

      @if (!clustersLoading() && workloadClusters().length > 0) {
        <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Cluster">
          <div class="fl-toolbar__group">
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Cluster"
                [ngModel]="selectedClusterId()"
                (ngModelChange)="onClusterChange($event)"
              >
                <option value="">Select a cluster</option>
                @for (c of workloadClusters(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </span>
          </div>
          @if (selectedClusterId()) {
            <div class="fl-toolbar__group">
              <button
                flButton="ghost"
                size="sm"
                type="button"
                [iconOnly]="true"
                aria-label="Refresh"
                title="Refresh"
                [disabled]="authzService.loading()"
                (click)="refresh()"
              >
                <fl-icon name="lucideRefreshCw" [size]="14" />
              </button>
            </div>
          }
        </div>
      }

      <div class="flex flex-col gap-4 p-4">
        <p class="text-fl-body-sm text-fl-ink-muted">
          Auth Proxy checks the Flui sign-in for internal apps and routes that require one, so only
          team members with access reach them. Install it once on each cluster other than the
          control. It needs no extra configuration.
        </p>

        @if (clustersLoading()) {
          <fl-loading-state [rows]="2" />
        } @else if (workloadClusters().length === 0) {
          <fl-empty-state
            [compact]="true"
            title="No clusters yet"
            body="Create a cluster first, then install Auth Proxy on it."
          />
        } @else if (!selectedClusterId()) {
          <p class="text-fl-ink-muted">Select a cluster to see its Auth Proxy status.</p>
        } @else if (authzService.loading() && !authzService.install()) {
          <fl-loading-state [rows]="2" />
        } @else {
          <fl-key-value>
            <fl-kv-item key="Status">
              <fl-status [tone]="statusTone()" [label]="statusLabel()" />
            </fl-kv-item>
            <fl-kv-item key="Cluster">{{ selectedClusterName() }}</fl-kv-item>
            @if (authzService.install()?.installedAt; as installedAt) {
              <fl-kv-item key="Installed">{{ formatDate(installedAt) }}</fl-kv-item>
            }
          </fl-key-value>

          @if (authzService.installing()) {
            <fl-usage-bar
              label="Install progress"
              [percent]="authzService.progress()"
              [aside]="authzService.progressStep() || 'Working…'"
              [warnAt]="101"
              [criticalAt]="101"
            />
          }

          @if (authzService.error()) {
            <fl-alert tone="error" title="Auth Proxy request failed">{{
              authzService.error()
            }}</fl-alert>
          }
          @if (
            authzService.install()?.status === 'FAILED' && authzService.install()?.errorMessage
          ) {
            <fl-alert tone="error" title="Install failed">{{
              authzService.install()!.errorMessage
            }}</fl-alert>
          }
        }
      </div>
    </fl-panel>
  `,
})
export class InfrastructureAuthProxyComponent implements OnInit {
  protected readonly authzService = inject(AuthzInstallService);
  private readonly clusterService = inject(ClusterService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected clustersLoading = signal(false);
  protected selectedClusterId = signal('');

  protected workloadClusters = computed(() => this.clusterService.clusters());

  protected selectedClusterName = computed(() => {
    const id = this.selectedClusterId();
    return this.workloadClusters().find((c) => c.id === id)?.name ?? id;
  });

  protected statusLabel = computed(() => {
    const s = this.authzService.install()?.status;
    if (!s || s === STATUS.Uninstalled) return 'Not installed';
    if (s === STATUS.Pending || s === STATUS.Installing) return 'Installing';
    if (s === STATUS.Running) return 'Active';
    if (s === STATUS.Failed) return 'Failed';
    return 'Unknown';
  });

  protected statusTone = computed<StatusTone>(() => {
    const s = this.authzService.install()?.status;
    if (s === STATUS.Running) return 'success';
    if (s === STATUS.Failed) return 'error';
    if (s === STATUS.Pending || s === STATUS.Installing) return 'progress';
    return 'neutral';
  });

  protected showInstallButton = computed(() => {
    const s = this.authzService.install()?.status;
    return !s || s === STATUS.Uninstalled;
  });

  protected showRetryButton = computed(() => this.authzService.install()?.status === STATUS.Failed);

  protected showUninstallButton = computed(() => {
    const s = this.authzService.install()?.status;
    return s === STATUS.Running || s === STATUS.Failed;
  });

  protected menuItems = computed<MenuAction[]>(() => [
    {
      id: 'uninstall',
      label: 'Uninstall',
      danger: true,
      disabled: this.authzService.installing(),
    },
  ]);

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
      if (queryId && list.some((c) => c.id === queryId)) {
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

  protected async confirmUninstall(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Remove Auth Proxy',
      body: 'Remove flui-authz from this cluster? Internal apps fall back to the legacy external ForwardAuth proxy. No data is lost.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) await this.onUninstall();
  }

  async onUninstall(): Promise<void> {
    const install = this.authzService.install();
    if (!install) return;
    await this.authzService.uninstallAuthz(install.id);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
