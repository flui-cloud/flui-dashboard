import { LookOnlyDirective } from '../../../shared/directives/look-only.directive';
import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute, RouterOutlet, NavigationEnd } from '@angular/router';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';

import { ClusterService } from '../../service/cluster.service';
import { SandboxService, isSandboxRefusalCode } from '../../../core/services/sandbox.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { ClusterStatus, ClusterType, isControlClusterType } from '../../model/cluster.models';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  ClusterSurfaceInput,
  ClusterSurfaceRevision,
  buildClusterSurface,
  presentedContent,
} from './cluster-surface';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlResourceNav } from '../../../ui/frame/resource-nav';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { CLUSTER_STATUS, statusToneOf } from '../dashboard/home-state';
import { CLUSTER_SECTIONS, clusterDetailNav } from './cluster-detail-sections';
import { ClusterDeleteDialog } from './cluster-delete-dialog';

const LOOK_ONLY_TABS = new Set([
  'storage',
  'scaling',
  'firewall',
  'dns',
  'variables',
  'pricing',
  'security',
]);

@Component({
  selector: 'cluster-dashboard',
  imports: [
    MaskIdPipe,
    LookOnlyDirective,
    RouterOutlet,
    FlPageHeader,
    FlAlert,
    FlCopyId,
    FlPanel,
    FlLoadingState,
    FlResourceNav,
    FlActionsMenu,
    FlStatus,
    FlTag,
    FlButton,
    FlIcon,
    ClusterDeleteDialog,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  template: `
    <div class="fl-page">
      @if (isLoading() && !cluster()) {
        <fl-panel><fl-loading-state [rows]="6" /></fl-panel>
      }

      @if (errorMessage() && !isLoading() && !refusedBySandbox()) {
        <fl-alert tone="error" title="Could not load the cluster">{{ errorMessage() }}</fl-alert>
      }

      @if (cluster(); as clusterData) {
        @let control = isControlCluster(clusterData.clusterType);
        <fl-page-header [title]="clusterData.name ?? 'Cluster'" [breadcrumb]="breadcrumb()">
          <fl-status headerStatus [tone]="status().tone" [label]="status().label" />
          @if (control) {
            <fl-tag headerStatus>control</fl-tag>
          }
          @if (clusterData.id) {
            <fl-copy-id
              headerMeta
              [value]="clusterData.id"
              [display]="clusterData.id | maskId"
              label="cluster ID"
            />
          }
          @if (meta()) {
            <span headerMeta>{{ meta() }}</span>
          }
          <ng-container headerActions>
            <button
              flButton
              type="button"
              [iconOnly]="true"
              [disabled]="isLoading()"
              title="Refresh"
              aria-label="Refresh"
              (click)="refreshCluster()"
            >
              <fl-icon name="lucideRefreshCw" />
            </button>
            @if (!readOnly()) {
              @if (
                clusterData.status === ClusterStatus.ACTIVE ||
                clusterData.status === ClusterStatus.STOPPING
              ) {
                <button
                  flButton
                  type="button"
                  [disabled]="clusterData.status !== ClusterStatus.ACTIVE || control"
                  [title]="control ? 'The control cluster is managed from the CLI' : 'Stop cluster'"
                  (click)="stopCluster()"
                >
                  Stop
                </button>
              }
              @if (
                clusterData.status === ClusterStatus.STOPPED ||
                clusterData.status === ClusterStatus.STARTING
              ) {
                <button
                  flButton
                  type="button"
                  [disabled]="clusterData.status !== ClusterStatus.STOPPED || control"
                  [title]="
                    control ? 'The control cluster is managed from the CLI' : 'Start cluster'
                  "
                  (click)="startCluster()"
                >
                  Start
                </button>
              }
              @if (perms.can('cluster:destroy')) {
                <fl-actions-menu
                  label="Actions"
                  [items]="moreActions()"
                  [attr.title]="control ? 'The control cluster is managed from the CLI' : null"
                  data-testid="cluster-more-actions"
                  (action)="confirmDelete()"
                />
              }
            }
          </ng-container>
        </fl-page-header>

        @if (powerAlert(); as alert) {
          <fl-alert
            [tone]="
              alert.type === 'error' ? 'error' : alert.type === 'success' ? 'info' : 'warning'
            "
            [title]="alert.type === 'error' ? 'Action failed' : 'Action started'"
          >
            {{ alert.message }}
            <button
              alertActions
              flButton="ghost"
              size="sm"
              type="button"
              (click)="dismissPowerAlert()"
            >
              Dismiss
            </button>
          </fl-alert>
        }

        <div class="fl-resource">
          <fl-resource-nav label="Cluster sections" [groups]="sections()" />
          <div class="min-w-0" [appLookOnly]="lookOnly()">
            <router-outlet />
          </div>
        </div>
      }
    </div>

    @if (showDeleteModal()) {
      <app-cluster-delete-dialog
        [name]="cluster()?.name ?? 'cluster'"
        [deleting]="isDeleting()"
        [(force)]="forceDelete"
        (cancelled)="cancelDelete()"
        (confirmed)="executeDelete()"
      />
    }
  `,
})
export class ClusterDashboardComponent implements OnInit, OnDestroy {
  private readonly clusterService = inject(ClusterService);
  private readonly autoscaleService = inject(ClusterAutoscaleService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  ClusterStatus = ClusterStatus;

  private readonly tabs = CLUSTER_SECTIONS;

  protected readonly visibleTabs = computed(() => {
    const id = this.clusterId() ?? '';
    return this.tabs.filter(
      (tab) => !tab.reads || this.sandbox.allows('GET', tab.reads.replace(':id', id)),
    );
  });

  private readonly clusterId = signal<string | null>(null);

  cluster = this.clusterService.cluster;
  isLoading = this.clusterService.loading;
  errorMessage = this.clusterService.errorMessage;

  private readonly sandbox = inject(SandboxService);
  protected readonly perms = inject(PermissionService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly readOnly = computed(() => this.sandbox.levelOf('cluster') !== 'full');

  protected readonly refusedBySandbox = computed(() =>
    isSandboxRefusalCode(this.clusterService.lastErrorCode()),
  );

  protected readonly sections = computed(() => clusterDetailNav(this.visibleTabs()));

  protected readonly breadcrumb = computed<Crumb[]>(() => [
    { label: 'Clusters', link: '/cluster' },
    { label: this.cluster()?.name ?? 'Cluster' },
  ]);

  protected readonly status = computed(() => {
    const c = this.cluster();
    const s = c ? CLUSTER_STATUS[c.status] : undefined;
    return {
      label: s?.label ?? c?.status ?? '',
      tone: statusToneOf(s?.tone ?? 'muted'),
    };
  });

  protected readonly meta = computed(() => {
    const c = this.cluster();
    const provider = c?.provider ? this.clusterService.getProviderDisplayName(c.provider) : null;
    return [provider, c?.region].filter(Boolean).join(' · ');
  });

  protected readonly moreActions = computed<MenuAction[]>(() => {
    const c = this.cluster();
    return [
      {
        id: 'delete',
        label: 'Delete cluster',
        danger: true,
        disabled: !c || c.status === ClusterStatus.DELETING || isControlClusterType(c.clusterType),
      },
    ];
  });

  powerAlert = signal<{ type: 'error' | 'success' | 'warning'; message: string } | null>(null);
  showDeleteModal = signal(false);
  isDeleting = signal(false);
  protected readonly forceDelete = signal(false);

  // The Semantic Surface's tab scope reads this — the same source the routerLinkActive
  // bindings in the template read from, not a second notion of "which tab is open".
  // Same technique application-detail.component.ts already uses (§5 of the playbook).
  private readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.route.snapshot.firstChild?.routeConfig?.path ?? null),
    ),
    { initialValue: this.route.snapshot.firstChild?.routeConfig?.path ?? null },
  );

  private readonly surfaceRevision = new ClusterSurfaceRevision();

  readonly surface = computed(() => {
    const input: ClusterSurfaceInput = {
      cluster: this.cluster(),
      activeTab: this.activeTab(),
      readOnly: this.readOnly(),
      isControlCluster: isControlClusterType(this.cluster()?.clusterType),
    };
    const content = presentedContent(input);
    if (!content) return null;
    return buildClusterSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  /** A guest is shown these tabs and operates none of them: the levers on them are the instance's. */
  protected readonly lookOnly = computed(
    () => this.sandbox.inSandbox() && LOOK_ONLY_TABS.has(this.activeTab() ?? ''),
  );

  constructor() {
    // A tab a demo guest may not open, reached by its address, lands on the overview.
    effect(() => {
      const tab = this.activeTab();
      const known = this.tabs.some((t) => t.route === tab);
      if (tab && known && !this.visibleTabs().some((t) => t.route === tab)) {
        void this.router.navigate(['overview'], { relativeTo: this.route, replaceUrl: true });
      }
    });
    // Publish this page's own Semantic Surface snapshot into the shared registry
    // whenever it changes. ngOnDestroy clears it, so the snapshot never outlives this
    // page — same discipline as ApplicationDetailComponent.
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnInit(): void {
    // Angular reuses this component when only :id changes, so ngOnInit runs once
    // across a cluster-to-cluster navigation. Follow the parameter instead of
    // reading it a single time, or the page keeps serving the cluster we left.
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        filter((id): id is string => !!id),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => this.openCluster(id));
  }

  ngOnDestroy(): void {
    this.autoscaleService.stopStatusPolling();
    this.autoscaleService.resetState();
    this.currentSurface.set(null);
  }

  private openCluster(clusterId: string): void {
    void (async () => {
      this.autoscaleService.stopStatusPolling();
      this.autoscaleService.resetState();
      this.clusterId.set(clusterId);
      await this.loadClusterData(clusterId);
      this.autoscaleService.startStatusPolling(clusterId);
      void this.autoscaleService.loadDefaults().catch(() => undefined);
    })();
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
    return isControlClusterType(type);
  }

  async stopCluster() {
    const c = this.cluster();
    if (!c?.id) return;
    try {
      this.powerAlert.set(null);
      await this.clusterService.stopCluster(c.id);
      this.powerAlert.set({
        type: 'success',
        message: 'Cluster stop operation initiated successfully',
      });
      setTimeout(() => {
        if (this.powerAlert()?.type === 'success') this.powerAlert.set(null);
      }, 5000);
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
      this.powerAlert.set({
        type: 'success',
        message: 'Cluster start operation initiated successfully',
      });
      setTimeout(() => {
        if (this.powerAlert()?.type === 'success') this.powerAlert.set(null);
      }, 5000);
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
    this.forceDelete.set(false);
  }

  async executeDelete() {
    const c = this.cluster();
    if (!c?.id) return;
    this.isDeleting.set(true);
    try {
      await this.clusterService.deleteCluster(c.id, this.forceDelete());
      this.showDeleteModal.set(false);
      this.forceDelete.set(false);
      setTimeout(() => this.router.navigate(['/cluster']), 1000);
    } catch (error) {
      console.error('Failed to delete cluster:', error);
    } finally {
      this.isDeleting.set(false);
    }
  }
}
