import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
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
import {
  bridgeLine,
  canAbort,
  canCutover,
  canDestroySource,
  cutoverLabel,
  destroyConfirmation,
  pendingConfirmation,
  type PendingMigrationAction,
} from './migration-bridge';
import { kindLabel, measuresLine, nextStepsOf, poolerLine } from './migration-measures';
import {
  formatWhen,
  shortId,
  sourceLabel,
  statusBadgeClass,
  statusLabel,
  typeBadgeClass,
  typeLabel,
} from './migration-row-view';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  MigrationsListSurfaceInput,
  MigrationsListSurfaceRevision,
  buildMigrationsListSurface,
  presentedContent,
} from './migrations-list-surface';

/**
 * Monitor + drive surface for cross-cluster migrations. Lists app / DB / full
 * migrations, colours them by status, and exposes the lifecycle drivers
 * (cutover / abort / destroy-source) as status-gated per-row actions.
 */
@Component({
  selector: 'app-migrations-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReadOnlySectionDirective, NgIcon, ConfirmationDialogComponent, MigrationLaunchModalComponent],
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
            appReadOnlySection="backup"
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
            appReadOnlySection="backup"
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
                    @if (kindLabel(row); as kind) {
                      <p class="mt-1 text-xs text-muted-foreground">{{ kind }}</p>
                    }
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                      [class]="statusBadgeClass(row.status)"
                    >
                      {{ statusLabel(row.status) }}
                    </span>
                    @if (bridgeLine(row); as line) {
                      <p class="mt-1 max-w-xs text-xs text-muted-foreground">{{ line }}</p>
                    }
                    @if (measuresLine(row); as measures) {
                      <p class="mt-1 max-w-xs text-xs text-muted-foreground">{{ measures }}</p>
                    }
                    @if (poolerLine(row); as pooler) {
                      <p class="mt-1 max-w-xs text-xs text-muted-foreground">{{ pooler }}</p>
                    }
                    @if (nextStepsOf(row).length) {
                      <button
                        type="button"
                        (click)="toggleSteps(row)"
                        [attr.aria-expanded]="stepsOpen() === rowKey(row)"
                        class="mt-1 text-xs font-medium text-primary hover:underline"
                      >
                        Next steps ({{ nextStepsOf(row).length }})
                      </button>
                      @if (stepsOpen() === rowKey(row)) {
                        <ul class="mt-1 max-w-xs list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                          @for (step of nextStepsOf(row); track step.key) {
                            <li>{{ step.text }}</li>
                          }
                        </ul>
                      }
                    }
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
                          {{ cutoverLabel(row) }}
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
export class MigrationsListComponent implements OnInit, OnDestroy {
  private readonly migrationService = inject(MigrationService);
  private readonly clusterService = inject(ClusterService);
  private readonly toast = inject(ToastService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  private readonly launchModal = viewChild(MigrationLaunchModalComponent);
  private readonly confirmDialog = viewChild(ConfirmationDialogComponent);

  readonly migrations = signal<MigrationRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly pending = signal<PendingMigrationAction | null>(null);

  private readonly surfaceRevision = new MigrationsListSurfaceRevision();

  readonly surface = computed(() => {
    const input: MigrationsListSurfaceInput = {
      migrations: this.migrations(),
      loading: this.loading(),
      hasLoadError: !!this.error(),
    };
    return buildMigrationsListSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  readonly confirmTitle = computed(() => pendingConfirmation(this.pending()).title);
  readonly confirmMessage = computed(() => pendingConfirmation(this.pending()).message);
  readonly confirmButton = computed(() => pendingConfirmation(this.pending()).confirmText);

  readonly bridgeLine = bridgeLine;
  readonly cutoverLabel = cutoverLabel;
  readonly kindLabel = kindLabel;
  readonly measuresLine = measuresLine;
  readonly poolerLine = poolerLine;
  readonly nextStepsOf = nextStepsOf;
  readonly stepsOpen = signal<string | null>(null);

  rowKey(row: MigrationRow): string {
    return `${row.type}:${row.id}`;
  }

  toggleSteps(row: MigrationRow): void {
    const key = this.rowKey(row);
    this.stepsOpen.set(this.stepsOpen() === key ? null : key);
  }

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
  readonly canCutover = canCutover;
  readonly canAbort = canAbort;

  canDestroySource(row: MigrationRow): boolean {
    return canDestroySource(row);
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
        await this.migrationService.destroySource(row.type, row.id, {
          closeBridge: destroyConfirmation(row).closeBridge,
        });
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
  readonly typeLabel = typeLabel;
  readonly typeBadgeClass = typeBadgeClass;
  readonly statusLabel = statusLabel;
  readonly statusBadgeClass = statusBadgeClass;
  readonly fmt = formatWhen;

  readonly srcLabel = sourceLabel;

  dstLabel(row: MigrationRow): string {
    const cluster = this.clusterName(row.targetClusterId);
    if (row.type === 'db' && row.displayName) {
      return `${cluster} · ${row.displayName}`;
    }
    return cluster;
  }

  private clusterName(id: string): string {
    return this.clusterService.clusters().find((c) => c.id === id)?.name ?? shortId(id);
  }

  private msg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message ?? err?.message ?? 'Request failed';
  }
}
