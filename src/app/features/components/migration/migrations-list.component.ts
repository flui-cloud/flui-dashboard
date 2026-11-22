import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRefreshCw } from '@ng-icons/lucide';
import { ToastService } from '../../../shared/services/toast.service';
import { ClusterService } from '../../service/cluster.service';
import { MigrationRow, MigrationService } from '../../service/migration.service';
import { MigrationLaunchModalComponent } from './migration-launch-modal.component';
import {
  destroyConfirmation,
  pendingConfirmation,
  type PendingMigrationAction,
} from './migration-bridge';
import { shortId, sourceLabel } from './migration-row-view';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import {
  MigrationsListSurfaceInput,
  MigrationsListSurfaceRevision,
  buildMigrationsListSurface,
  presentedContent,
} from './migrations-list-surface';
import { MigrationsTableComponent } from './migrations-table';

/**
 * Monitor + drive surface for cross-cluster migrations. Lists app / DB / full
 * migrations, colours them by status, and exposes the lifecycle drivers
 * (cutover / abort / destroy-source) as status-gated per-row actions.
 */
@Component({
  selector: 'app-migrations-list',
  imports: [
    ReadOnlySectionDirective,
    MigrationLaunchModalComponent,
    MigrationsTableComponent,
    FlAlert,
    FlButton,
    FlEmptyState,
    FlIcon,
    FlLoadingState,
    FlPageHeader,
    FlPanel,
  ],
  providers: [provideIcons({ lucidePlus, lucideRefreshCw })],
  template: `
    <div class="fl-page">
      <fl-page-header [title]="'Migrations (' + migrations().length + ')'">
        <span headerMeta>Move workloads, managed databases and full apps across clusters.</span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            [disabled]="loading()"
            (click)="reload()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
          <button
            flButton="primary"
            type="button"
            appReadOnlySection="backup"
            (click)="openLaunch()"
          >
            <fl-icon name="lucidePlus" />
            New migration
          </button>
        </ng-container>
      </fl-page-header>

      @if (error(); as e) {
        <fl-alert tone="error" title="Could not load migrations">{{ e }}</fl-alert>
      }

      <fl-panel [flush]="true">
        @if (loading()) {
          <fl-loading-state [rows]="5" />
        } @else if (migrations().length === 0) {
          <fl-empty-state
            title="No migrations yet"
            body="Move an application, a managed database or both to another cluster."
          >
            <button
              flButton
              size="sm"
              type="button"
              appReadOnlySection="backup"
              (click)="openLaunch()"
            >
              New migration
            </button>
          </fl-empty-state>
        } @else {
          <app-migrations-table
            [rows]="migrations()"
            [busyId]="busyId()"
            [targetLabel]="dstLabel"
            (cutover)="onCutover($event)"
            (action)="request($event)"
          />
        }
      </fl-panel>
    </div>

    <app-migration-launch-modal (launched)="onLaunched()" />
  `,
})
export class MigrationsListComponent implements OnInit, OnDestroy {
  private readonly migrationService = inject(MigrationService);
  private readonly clusterService = inject(ClusterService);
  private readonly toast = inject(ToastService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  private readonly confirmService = inject(ConfirmService);

  private readonly launchModal = viewChild(MigrationLaunchModalComponent);

  readonly migrations = signal<MigrationRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

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

  async request(action: PendingMigrationAction): Promise<void> {
    const copy = pendingConfirmation(action);
    const ok = await this.confirmService.confirm({
      title: copy.title,
      body: copy.message,
      confirmLabel: copy.confirmText,
      destructive: true,
      typeToConfirm: action.kind === 'destroy' ? sourceLabel(action.row) : undefined,
    });
    if (ok) await this.run(action);
  }

  private async run(action: PendingMigrationAction): Promise<void> {
    const row = action.row;
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
    }
  }

  readonly dstLabel = (row: MigrationRow): string => {
    const cluster = this.clusterName(row.targetClusterId);
    if (row.type === 'db' && row.displayName) {
      return `${cluster} · ${row.displayName}`;
    }
    return cluster;
  };

  private clusterName(id: string): string {
    return this.clusterService.clusters().find((c) => c.id === id)?.name ?? shortId(id);
  }

  private msg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message ?? err?.message ?? 'Request failed';
  }
}
