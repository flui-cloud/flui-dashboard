import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideZap,
  lucideRefreshCw,
  lucideChevronDown,
  lucideChevronUp,
  lucideCircleAlert,
  lucideCircleCheck,
  lucideInfo,
  lucidePlus,
  lucideMinus,
} from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { AutoscaleWarningBannerComponent } from './autoscale-warning-banner.component';
import { AttachVNetDialogComponent } from './attach-vnet-dialog.component';
import { AddWorkerDialogComponent } from './add-worker-dialog.component';
import { RemoveWorkerDialogComponent } from './remove-worker-dialog.component';
import { UpdateClusterAutoscalePayload } from '../../model/autoscale.models';
import { InstanceWithLabels, getClusterInfo, getClusterNodeId } from '../../model/instance.models';

@Component({
  selector: 'cluster-autoscaling-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIcon,
    AutoscaleWarningBannerComponent,
    AttachVNetDialogComponent,
    AddWorkerDialogComponent,
    RemoveWorkerDialogComponent,
  ],
  providers: [
    provideIcons({
      lucideZap,
      lucideRefreshCw,
      lucideChevronDown,
      lucideChevronUp,
      lucideCircleAlert,
      lucideCircleCheck,
      lucideInfo,
      lucidePlus,
      lucideMinus,
    }),
  ],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-semibold text-foreground flex items-center gap-2">
            <ng-icon name="lucideZap" class="h-6 w-6 text-blue-500" />
            Scaling
          </h2>
          <p class="text-sm text-sub mt-1">
            Add or remove workers manually, and configure the autoscaling intent and
            thresholds for when the auto loop ships.
          </p>
        </div>
        <button
          type="button"
          (click)="refresh()"
          [disabled]="loading()"
          class="inline-flex items-center p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="loading()" />
        </button>
      </div>

      @if (loading() && !status()) {
        <div class="animate-pulse space-y-3">
          <div class="skeleton h-20 rounded-lg"></div>
          <div class="skeleton h-40 rounded-lg"></div>
        </div>
      }

      @if (status(); as s) {
        <app-autoscale-warning-banner
          [status]="s"
          (configure)="scrollToConfig()"
          (addWorker)="openAddWorker()"
        />

        <!-- Live status -->
        <div class="card-surface p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p class="text-xs text-sub">Status</p>
            <p class="text-sm font-medium text-foreground mt-1 flex items-center gap-1.5">
              @if (s.autoscalingEnabled) {
                <ng-icon name="lucideCircleCheck" class="h-4 w-4 text-green-500" />
                Enabled
              } @else {
                <span class="inline-block h-2 w-2 rounded-full bg-gray-400"></span>
                Disabled
              }
            </p>
          </div>
          <div>
            <p class="text-xs text-sub">Current nodes</p>
            <div class="mt-1 flex items-center gap-2">
              <button
                type="button"
                (click)="onRemoveWorker()"
                [disabled]="!canRemoveWorker()"
                [title]="removeTooltip()"
                class="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:hover:border-border"
              >
                <ng-icon name="lucideMinus" class="h-3.5 w-3.5" />
              </button>
              <span class="text-lg font-semibold text-foreground tabular-nums min-w-[1.5rem] text-center">
                {{ s.currentNodes }}
              </span>
              <button
                type="button"
                (click)="openAddWorker()"
                [disabled]="!canAddWorker()"
                [title]="addTooltip()"
                class="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:hover:border-border"
              >
                <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div>
            <p class="text-xs text-sub">Memory</p>
            <p class="text-lg font-semibold text-foreground">
              {{ s.metrics.memoryPct == null ? '—' : (s.metrics.memoryPct | number: '1.0-1') + '%' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-sub">CPU</p>
            <p class="text-lg font-semibold text-foreground">
              {{ s.metrics.cpuPct == null ? '—' : (s.metrics.cpuPct | number: '1.0-1') + '%' }}
            </p>
          </div>
        </div>

        <!-- Configuration form -->
        <div class="card-surface p-6 space-y-6" id="autoscale-config">
          <div class="flex items-start gap-3">
            <input
              type="checkbox"
              id="autoscale-enabled"
              [(ngModel)]="form.autoscalingEnabled"
              class="h-4 w-4 mt-1 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div class="flex-1">
              <label for="autoscale-enabled" class="text-sm font-medium text-foreground">
                Autoscaling intent
              </label>
              <p class="text-xs text-sub mt-1">
                When enabled, the cluster surfaces warnings as soon as memory or CPU cross
                the configured thresholds. Automatic scale-up is not active yet — use the
                <strong>+</strong> control above (or the Nodes tab) to scale manually.
              </p>
            </div>
          </div>

          @if (form.autoscalingEnabled) {
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium block mb-2">Minimum nodes</label>
                <input
                  type="number"
                  [min]="1"
                  [max]="form.maxNodes ?? 20"
                  [(ngModel)]="form.minNodes"
                  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label class="text-sm font-medium block mb-2">Maximum nodes</label>
                <input
                  type="number"
                  [min]="form.minNodes ?? 1"
                  [max]="20"
                  [(ngModel)]="form.maxNodes"
                  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="button"
                (click)="advancedOpen.set(!advancedOpen())"
                class="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-blue-600"
              >
                <ng-icon
                  [name]="advancedOpen() ? 'lucideChevronUp' : 'lucideChevronDown'"
                  class="h-4 w-4"
                />
                Advanced thresholds
              </button>

              @if (advancedOpen()) {
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                  <div>
                    <label class="text-xs font-medium text-sub block mb-1.5">
                      Scale-up memory %
                    </label>
                    <input
                      type="number"
                      [min]="50"
                      [max]="95"
                      [(ngModel)]="form.scaleUpMemoryPct"
                      [placeholder]="defaults()?.scaleUpMemoryPct?.toString() || '80'"
                      class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                    <p class="text-xs text-sub mt-1">
                      Default: {{ defaults()?.scaleUpMemoryPct ?? 80 }}%
                    </p>
                  </div>
                  <div>
                    <label class="text-xs font-medium text-sub block mb-1.5">
                      Scale-up CPU %
                    </label>
                    <input
                      type="number"
                      [min]="50"
                      [max]="95"
                      [(ngModel)]="form.scaleUpCpuPct"
                      [placeholder]="defaults()?.scaleUpCpuPct?.toString() || '75'"
                      class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                    <p class="text-xs text-sub mt-1">
                      Default: {{ defaults()?.scaleUpCpuPct ?? 75 }}%
                    </p>
                  </div>
                  <div>
                    <label class="text-xs font-medium text-sub block mb-1.5">
                      Cooldown (seconds)
                    </label>
                    <input
                      type="number"
                      [min]="60"
                      [max]="3600"
                      [(ngModel)]="form.cooldownSeconds"
                      [placeholder]="defaults()?.cooldownSeconds?.toString() || '300'"
                      class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                    <p class="text-xs text-sub mt-1">
                      Default: {{ defaults()?.cooldownSeconds ?? 300 }}s
                    </p>
                  </div>
                </div>
              }
            </div>
          }

          @if (lastError(); as err) {
            <div class="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-3 flex items-start gap-2">
              <ng-icon name="lucideCircleAlert" class="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-red-900 dark:text-red-200">
                  @if (err.kind === 'vnet-required') {
                    A VNet is required to enable autoscaling
                  } @else {
                    Failed to update autoscale configuration
                  }
                </p>
                <p class="text-xs text-red-800 dark:text-red-300 mt-0.5">{{ err.message }}</p>
                @if (err.kind === 'vnet-required') {
                  <div class="flex gap-3 mt-2">
                    <button
                      type="button"
                      (click)="openAttachVNet()"
                      class="text-xs font-medium underline text-red-700 dark:text-red-300"
                    >
                      Attach existing VNet
                    </button>
                    <button
                      type="button"
                      (click)="goToCreateVNet()"
                      class="text-xs font-medium underline text-red-700 dark:text-red-300"
                    >
                      Create a VNet
                    </button>
                  </div>
                }
              </div>
            </div>
          }

          <div class="flex items-center justify-end gap-3 pt-2 border-t border-border">
            @if (saveSuccess()) {
              <span class="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                <ng-icon name="lucideCircleCheck" class="h-4 w-4" />
                Saved
              </span>
            }
            <button
              type="button"
              (click)="resetForm()"
              [disabled]="!isDirty() || saving()"
              class="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reset
            </button>
            <button
              type="button"
              (click)="save()"
              [disabled]="!isDirty() || saving() || !isValid()"
              class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              @if (saving()) {
                <ng-icon name="lucideRefreshCw" class="h-4 w-4 animate-spin" />
              }
              Save changes
            </button>
          </div>
        </div>

        <div class="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-3 flex items-start gap-2">
          <ng-icon name="lucideInfo" class="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p class="text-xs text-blue-900 dark:text-blue-200">
            Automatic scale-up is rolling out gradually. For now, when warnings appear,
            use the <strong>+</strong> control above to add a worker. The cluster needs a
            VNet attached to be eligible for autoscaling.
          </p>
        </div>
      }

      @if (showAttachDialog() && clusterIdForDialog(); as cid) {
        <app-attach-vnet-dialog
          [clusterId]="cid"
          [provider]="providerForDialog()"
          (closed)="showAttachDialog.set(false)"
          (attached)="onVNetAttached()"
        />
      }

      @if (showAddWorkerDialog() && clusterIdForDialog(); as cid) {
        <app-add-worker-dialog
          [clusterId]="cid"
          [currentNodes]="status()?.currentNodes ?? 0"
          [maxNodes]="status()?.maxNodes ?? null"
          (closed)="showAddWorkerDialog.set(false)"
        />
      }

      @if (removeTarget(); as target) {
        <app-remove-worker-dialog
          [clusterId]="clusterIdForDialog()!"
          [nodeId]="resolveNodeId(target)"
          [workerName]="target.displayName || target.name || target.id || ''"
          (closed)="removeTarget.set(null)"
        />
      }
    </div>
  `,
})
export class ClusterAutoscalingTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly autoscaleService = inject(ClusterAutoscaleService);
  private readonly router = inject(Router);

  readonly status = this.autoscaleService.status;
  readonly defaults = this.autoscaleService.defaults;
  readonly loading = this.autoscaleService.loading;
  readonly saving = this.autoscaleService.saving;
  readonly lastError = this.autoscaleService.lastError;

  advancedOpen = signal<boolean>(false);
  saveSuccess = signal<boolean>(false);
  showAttachDialog = signal<boolean>(false);
  showAddWorkerDialog = signal<boolean>(false);
  removeTarget = signal<InstanceWithLabels | null>(null);

  readonly clusterIdForDialog = computed(() => this.clusterService.cluster()?.id ?? null);
  readonly providerForDialog = computed(() => this.clusterService.cluster()?.provider ?? '');

  readonly workerNodes = computed(() =>
    this.clusterService.nodes().filter(n => getClusterInfo(n)?.nodeType !== 'master')
  );
  readonly workerCount = computed(() => this.workerNodes().length);

  readonly canAddWorker = computed(() => {
    const s = this.status();
    if (!s) return false;
    const max = s.maxNodes;
    if (max != null && s.currentNodes >= max) return false;
    return true;
  });

  readonly addTooltip = computed(() => {
    const s = this.status();
    if (!s) return 'Add worker';
    const max = s.maxNodes;
    if (max != null && s.currentNodes >= max) {
      return `maxNodes=${max} reached: raise the limit below first.`;
    }
    return 'Add a new worker to this cluster.';
  });

  readonly canRemoveWorker = computed(() => {
    const s = this.status();
    if (!s) return false;
    const workers = this.workerNodes();
    if (workers.length === 0) return false;
    const min = s.minNodes;
    if (min != null && workers.length <= min) return false;
    // Skip if the only candidate worker is busy
    const candidate = this.removalCandidate();
    return candidate != null;
  });

  readonly removalCandidate = computed<InstanceWithLabels | null>(() => {
    for (let i = this.workerNodes().length - 1; i >= 0; i--) {
      const node = this.workerNodes()[i];
      const status = (node.status || '').toString().toLowerCase();
      if (status !== 'deleting' && status !== 'error') return node;
    }
    return null;
  });

  readonly removeTooltip = computed(() => {
    const s = this.status();
    if (!s) return 'Remove worker';
    const workers = this.workerNodes();
    if (workers.length === 0) return 'No workers to remove.';
    const min = s.minNodes;
    if (min != null && workers.length <= min) {
      return `Removing this worker would violate minNodes=${min}.`;
    }
    if (!this.removalCandidate()) return 'No removable worker (all are busy).';
    return `Remove worker '${this.removalCandidate()?.displayName ?? this.removalCandidate()?.name ?? ''}'.`;
  });

  form: {
    autoscalingEnabled: boolean;
    minNodes: number | null;
    maxNodes: number | null;
    scaleUpMemoryPct: number | null;
    scaleUpCpuPct: number | null;
    cooldownSeconds: number | null;
  } = {
    autoscalingEnabled: false,
    minNodes: null,
    maxNodes: null,
    scaleUpMemoryPct: null,
    scaleUpCpuPct: null,
    cooldownSeconds: null,
  };

  private snapshot: typeof this.form = { ...this.form };

  readonly isDirty = computed(() => {
    const s = this.status();
    if (!s) return false;
    return JSON.stringify(this.form) !== JSON.stringify(this.snapshot);
  });

  ngOnInit(): void {
    void this.autoscaleService.loadDefaults().catch(err =>
      console.warn('failed to load autoscale defaults', err)
    );
    const id = this.clusterService.cluster()?.id;
    if (id) {
      this.autoscaleService.startStatusPolling(id);
      void this.autoscaleService.getStatus(id).then(() => this.hydrateForm());
      // Need the node list to identify a removal candidate for the −  button.
      if (this.clusterService.nodes().length === 0) {
        void this.clusterService.loadClusterNodes(id).catch(() => undefined);
      }
    }
  }

  refresh(): void {
    const id = this.clusterService.cluster()?.id;
    if (id) {
      void this.autoscaleService.getStatus(id).then(() => this.hydrateForm());
    }
  }

  isValid(): boolean {
    if (!this.form.autoscalingEnabled) return true;
    const min = this.form.minNodes;
    const max = this.form.maxNodes;
    if (min == null || max == null) return false;
    if (min < 1 || max > 20 || min > max) return false;
    const pcts: Array<number | null> = [this.form.scaleUpMemoryPct, this.form.scaleUpCpuPct];
    for (const p of pcts) {
      if (p != null && (p < 50 || p > 95)) return false;
    }
    const cd = this.form.cooldownSeconds;
    if (cd != null && (cd < 60 || cd > 3600)) return false;
    return true;
  }

  resetForm(): void {
    this.form = { ...this.snapshot };
    this.autoscaleService.clearError();
  }

  async save(): Promise<void> {
    const id = this.clusterService.cluster()?.id;
    if (!id) return;
    const payload: UpdateClusterAutoscalePayload = {};
    if (this.form.autoscalingEnabled !== this.snapshot.autoscalingEnabled) {
      payload.autoscalingEnabled = this.form.autoscalingEnabled;
    }
    if (this.form.autoscalingEnabled) {
      // Per backend doc: when enabling, always send min/max even if unchanged
      if (payload.autoscalingEnabled === true || this.form.minNodes !== this.snapshot.minNodes) {
        payload.minNodes = this.form.minNodes ?? undefined;
      }
      if (payload.autoscalingEnabled === true || this.form.maxNodes !== this.snapshot.maxNodes) {
        payload.maxNodes = this.form.maxNodes ?? undefined;
      }
    }
    if (this.form.scaleUpMemoryPct != null && this.form.scaleUpMemoryPct !== this.snapshot.scaleUpMemoryPct) {
      payload.scaleUpMemoryPct = this.form.scaleUpMemoryPct;
    }
    if (this.form.scaleUpCpuPct != null && this.form.scaleUpCpuPct !== this.snapshot.scaleUpCpuPct) {
      payload.scaleUpCpuPct = this.form.scaleUpCpuPct;
    }
    if (this.form.cooldownSeconds != null && this.form.cooldownSeconds !== this.snapshot.cooldownSeconds) {
      payload.cooldownSeconds = this.form.cooldownSeconds;
    }

    try {
      await this.autoscaleService.updateAutoscale(id, payload);
      this.hydrateForm();
      this.saveSuccess.set(true);
      setTimeout(() => this.saveSuccess.set(false), 3000);
    } catch {
      // error already in lastError signal
    }
  }

  scrollToConfig(): void {
    document.getElementById('autoscale-config')?.scrollIntoView({ behavior: 'smooth' });
  }

  goToNodes(): void {
    const id = this.clusterService.cluster()?.id;
    if (id) this.router.navigate(['/cluster', id, 'nodes']);
  }

  openAddWorker(): void {
    if (this.canAddWorker()) this.showAddWorkerDialog.set(true);
  }

  onRemoveWorker(): void {
    if (!this.canRemoveWorker()) return;
    const candidate = this.removalCandidate();
    if (candidate) this.removeTarget.set(candidate);
  }

  resolveNodeId(node: InstanceWithLabels): string {
    return getClusterNodeId(node) ?? '';
  }

  goToCreateVNet(): void {
    this.router.navigate(['/infrastructure/vnet/new']);
  }

  openAttachVNet(): void {
    this.showAttachDialog.set(true);
  }

  onVNetAttached(): void {
    this.showAttachDialog.set(false);
    this.autoscaleService.clearError();
    const id = this.clusterService.cluster()?.id;
    if (id) {
      void this.autoscaleService.getStatus(id).then(() => this.hydrateForm());
    }
  }

  private hydrateForm(): void {
    const s = this.status();
    const d = this.defaults();
    if (!s) return;
    this.form = {
      autoscalingEnabled: s.autoscalingEnabled,
      minNodes: s.minNodes ?? d?.defaultMinNodes ?? 1,
      maxNodes: s.maxNodes ?? d?.defaultMaxNodes ?? 3,
      scaleUpMemoryPct: s.effectiveThresholds.scaleUpMemoryPct,
      scaleUpCpuPct: s.effectiveThresholds.scaleUpCpuPct,
      cooldownSeconds: s.effectiveThresholds.cooldownSeconds,
    };
    this.snapshot = { ...this.form };
  }
}
