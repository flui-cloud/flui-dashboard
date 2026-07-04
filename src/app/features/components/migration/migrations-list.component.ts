import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideArrowRightLeft,
  lucideBan,
  lucideLoader,
  lucidePlus,
  lucideRefreshCw,
  lucideTrash2,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { ToastService } from '../../../shared/services/toast.service';
import { ClusterService } from '../../service/cluster.service';
import { MigrationRow, MigrationService } from '../../service/migration.service';
import { MigrationLaunchModalComponent } from './migration-launch-modal.component';

type PendingAction = { kind: 'abort' | 'destroy'; row: MigrationRow };

const ABORTABLE = new Set([
  'pending',
  'provisioning',
  'db_replicating',
  'app_staging',
  'ready',
  'synced',
]);

/**
 * Monitor + drive surface for cross-cluster migrations. Lists app / DB / full
 * migrations, colours them by status, and exposes the lifecycle drivers
 * (cutover / abort / destroy-source) as status-gated per-row actions.
 */
@Component({
  selector: 'app-migrations-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, ConfirmationDialogComponent, MigrationLaunchModalComponent],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideArrowRightLeft,
      lucideBan,
      lucideLoader,
      lucidePlus,
      lucideRefreshCw,
      lucideTrash2,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="space-y-4 p-6">
      <header class="flex items-start justify-between">
        <div>
          <h1 class="flex items-center gap-2 text-2xl font-semibold">
            <ng-icon name="lucideArrowRightLeft" class="h-6 w-6 text-muted-foreground" />
            Migrations
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Move workloads, managed databases, and full apps across clusters.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="reload()"
            [disabled]="loading()"
            class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-4 w-4"
              [class.animate-spin]="loading()"
            />
            Refresh
          </button>
          <button
            type="button"
            (click)="openLaunch()"
            class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <ng-icon name="lucidePlus" class="h-4 w-4" /> New migration
          </button>
        </div>
      </header>

      @if (error(); as e) {
        <div class="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <ng-icon name="lucideTriangleAlert" class="h-4 w-4" /> {{ e }}
        </div>
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground">Loading…</p>
      } @else if (migrations().length === 0) {
        <div class="rounded-lg border border-dashed border-border p-10 text-center">
          <p class="text-sm text-muted-foreground">No migrations yet.</p>
          <button
            type="button"
            (click)="openLaunch()"
            class="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <ng-icon name="lucidePlus" class="h-4 w-4" /> New migration
          </button>
        </div>
      } @else {
        <div class="overflow-x-auto rounded-lg border border-border bg-card">
          <table class="w-full text-sm">
            <thead class="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th class="px-4 py-2 text-left">Type</th>
                <th class="px-4 py-2 text-left">Status</th>
                <th class="px-4 py-2 text-left">Source → Target</th>
                <th class="px-4 py-2 text-left">Cutover</th>
                <th class="px-4 py-2 text-left">When</th>
                <th class="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (row of migrations(); track row.type + ':' + row.id) {
                <tr class="border-t border-border align-top hover:bg-muted/20">
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                      [class]="typeBadgeClass(row.type)"
                    >
                      {{ typeLabel(row.type) }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                      [class]="statusBadgeClass(row.status)"
                    >
                      {{ statusLabel(row.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-1.5 font-mono text-xs">
                      <span>{{ srcLabel(row) }}</span>
                      <ng-icon name="lucideArrowRight" class="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{{ dstLabel(row) }}</span>
                    </div>
                    @if (row.errorMessage) {
                      <p class="mt-1 flex items-center gap-1 text-xs text-destructive">
                        <ng-icon name="lucideTriangleAlert" class="h-3 w-3" />
                        {{ row.errorMessage }}
                      </p>
                    }
                  </td>
                  <td class="px-4 py-3 capitalize text-muted-foreground">{{ row.cutoverMode }}</td>
                  <td class="px-4 py-3 text-muted-foreground">{{ fmt(row.createdAt) }}</td>
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-end gap-1.5">
                      @if (canCutover(row)) {
                        <button
                          type="button"
                          (click)="onCutover(row)"
                          [disabled]="busyId() === row.id"
                          class="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          @if (busyId() === row.id) {
                            <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                          } @else {
                            <ng-icon name="lucideArrowRight" class="h-3.5 w-3.5" />
                          }
                          Cutover
                        </button>
                      }
                      @if (canAbort(row)) {
                        <button
                          type="button"
                          (click)="requestAbort(row)"
                          [disabled]="busyId() === row.id"
                          class="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-muted disabled:opacity-50"
                        >
                          <ng-icon name="lucideBan" class="h-3.5 w-3.5" /> Abort
                        </button>
                      }
                      @if (canDestroySource(row)) {
                        <button
                          type="button"
                          (click)="requestDestroy(row)"
                          [disabled]="busyId() === row.id"
                          class="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-muted disabled:opacity-50"
                        >
                          <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" /> Destroy source
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <app-migration-launch-modal (launched)="onLaunched()" />

    <app-confirmation-dialog
      variant="danger"
      [title]="confirmTitle()"
      [message]="confirmMessage()"
      [confirmText]="confirmButton()"
      (confirmed)="onConfirm()"
      (cancelled)="pending.set(null)"
    />
  `,
})
export class MigrationsListComponent implements OnInit {
  private readonly migrationService = inject(MigrationService);
  private readonly clusterService = inject(ClusterService);
  private readonly toast = inject(ToastService);

  private readonly launchModal = viewChild(MigrationLaunchModalComponent);
  private readonly confirmDialog = viewChild(ConfirmationDialogComponent);

  readonly migrations = signal<MigrationRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly pending = signal<PendingAction | null>(null);

  readonly confirmTitle = computed(() =>
    this.pending()?.kind === 'destroy' ? 'Destroy source' : 'Abort migration',
  );
  readonly confirmMessage = computed(() =>
    this.pending()?.kind === 'destroy'
      ? 'Destroy the drained source workload? This is irreversible.'
      : 'Abort this migration? The destination is torn down; the source is untouched.',
  );
  readonly confirmButton = computed(() =>
    this.pending()?.kind === 'destroy' ? 'Destroy' : 'Abort',
  );

  ngOnInit(): void {
    void this.clusterService.loadClusters().catch(() => undefined);
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.migrations.set(await this.migrationService.listAll());
    } catch (e) {
      this.error.set(this.msg(e));
    } finally {
      this.loading.set(false);
    }
  }

  openLaunch(): void {
    void this.launchModal()?.show();
  }

  onLaunched(): void {
    this.toast.showSuccess('Migration launched');
    void this.reload();
  }

  // ── Status gating ──────────────────────────────────────────────────────────
  canCutover(row: MigrationRow): boolean {
    const s = row.status.toLowerCase();
    return row.type === 'db' ? s === 'synced' : s === 'ready';
  }

  canAbort(row: MigrationRow): boolean {
    return ABORTABLE.has(row.status.toLowerCase());
  }

  canDestroySource(row: MigrationRow): boolean {
    return (
      row.status.toLowerCase() === 'completed' &&
      (row.type === 'app' || row.type === 'full')
    );
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async onCutover(row: MigrationRow): Promise<void> {
    this.busyId.set(row.id);
    try {
      await this.migrationService.cutover(row.type, row.id);
      this.toast.showSuccess('Cutover started');
      await this.reload();
    } catch (e) {
      this.toast.showError(this.msg(e));
    } finally {
      this.busyId.set(null);
    }
  }

  requestAbort(row: MigrationRow): void {
    this.pending.set({ kind: 'abort', row });
    this.confirmDialog()?.open();
  }

  requestDestroy(row: MigrationRow): void {
    this.pending.set({ kind: 'destroy', row });
    this.confirmDialog()?.open();
  }

  async onConfirm(): Promise<void> {
    const action = this.pending();
    if (!action) return;
    const row = action.row;
    const dialog = this.confirmDialog();
    dialog?.setProcessing(true);
    this.busyId.set(row.id);
    try {
      if (action.kind === 'abort') {
        await this.migrationService.abort(row.type, row.id);
        this.toast.showSuccess('Migration aborted');
      } else if (row.type === 'app' || row.type === 'full') {
        await this.migrationService.destroySource(row.type, row.id);
        this.toast.showSuccess('Source workload destroyed');
      }
      await this.reload();
    } catch (e) {
      this.toast.showError(this.msg(e));
    } finally {
      this.busyId.set(null);
      dialog?.setProcessing(false);
      dialog?.close();
      this.pending.set(null);
    }
  }

  // ── Rendering helpers ────────────────────────────────────────────────────────
  typeLabel(type: MigrationRow['type']): string {
    return { app: 'App', db: 'Database', full: 'Full' }[type];
  }

  typeBadgeClass(type: MigrationRow['type']): string {
    switch (type) {
      case 'app':
        return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'db':
        return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300';
      case 'full':
        return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300';
    }
  }

  statusLabel(status: string): string {
    return status.replaceAll('_', ' ');
  }

  statusBadgeClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'completed') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400';
    }
    if (s === 'failed' || s === 'failed_forward' || s === 'aborted') {
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400';
    }
    if (
      s === 'ready' ||
      s === 'synced' ||
      s === 'pending' ||
      s === 'provisioning' ||
      s === 'db_replicating' ||
      s === 'app_staging' ||
      s === 'cutover'
    ) {
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
    }
    return 'border-border bg-muted text-muted-foreground';
  }

  srcLabel(row: MigrationRow): string {
    switch (row.type) {
      case 'app':
      case 'db':
        return this.short(row.srcAppId);
      case 'full':
        return this.short(row.appId);
    }
  }

  dstLabel(row: MigrationRow): string {
    const cluster = this.clusterName(row.targetClusterId);
    if (row.type === 'db' && row.displayName) {
      return `${cluster} · ${row.displayName}`;
    }
    return cluster;
  }

  fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  }

  private clusterName(id: string): string {
    return this.clusterService.clusters().find((c) => c.id === id)?.name ?? this.short(id);
  }

  private short(id: string | null | undefined): string {
    return id ? id.slice(0, 8) : '—';
  }

  private msg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message ?? err?.message ?? 'Request failed';
  }
}
