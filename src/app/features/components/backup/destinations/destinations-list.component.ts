import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideSearch } from '@ng-icons/lucide';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlPageHeader } from '../../../../ui/patterns/page-header';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { FlTable } from '../../../../ui/patterns/table';
import { FlActionsMenu, MenuAction } from '../../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../../ui/overlays/confirm';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlStatus } from '../../../../ui/primitives/status';
import { BackupService } from '../../../service/backup.service';
import {
  BackupDestination,
  formatBytes,
  providerLabel,
  type StorageBackendProvider,
} from '../../../model/backup.models';
import { destinationReachability } from '../shared/backup-tones';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import {
  DestinationsListSurfaceInput,
  DestinationsListSurfaceRevision,
  buildDestinationsListSurface,
  presentedContent,
} from './destinations-list-surface';

@Component({
  selector: 'app-destinations-list',
  imports: [
    ReadOnlySectionDirective,
    FormsModule,
    RouterLink,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlTable,
    FlActionsMenu,
    FlButton,
    FlIcon,
    FlStatus,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideSearch })],
  template: `
    <div class="fl-page">
      <fl-page-header
        [title]="'Backup destinations (' + backup.destinations().length + ')'"
        [breadcrumb]="breadcrumb"
      >
        <span headerMeta>S3-compatible storage shared by your backup policies.</span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            [disabled]="backup.loading()"
            (click)="reload()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
          <a
            flButton="primary"
            appReadOnlySection="backup"
            routerLink="/management/backup/destinations/new"
            >Add external S3</a
          >
        </ng-container>
      </fl-page-header>

      <fl-alert tone="info" title="One-click Scaleway backups">
        Pick a cluster and Flui provisions the destination, protects every app on it and takes the
        first backups, with your existing Scaleway credentials. Most setups need no destination
        added by hand.
        <a
          alertActions
          flButton
          size="sm"
          appReadOnlySection="backup"
          routerLink="/management/backup"
          >Enable backups</a
        >
      </fl-alert>

      @if (backup.error()) {
        <fl-alert tone="error" title="Could not load destinations">{{ backup.error() }}</fl-alert>
      }

      <fl-panel [flush]="true">
        <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
          <div class="fl-toolbar__group">
            <label class="fl-input">
              <fl-icon name="lucideSearch" [size]="14" />
              <span class="fl-sr">Search</span>
              <input
                type="search"
                placeholder="Search by name, bucket or region"
                aria-label="Search destinations"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
              />
            </label>
          </div>
          <div class="fl-toolbar__group">
            <span class="fl-toolbar__info"
              >{{ rows().length }} {{ rows().length === 1 ? 'item' : 'items' }}</span
            >
          </div>
        </div>
        @if (backup.loading() && backup.destinations().length === 0) {
          <fl-loading-state [rows]="4" />
        } @else if (backup.destinations().length === 0) {
          <fl-empty-state
            title="No destinations yet"
            body="Use one-click Scaleway backups, or add an external S3 bucket by hand."
          />
        } @else if (rows().length === 0) {
          <fl-empty-state title="No destinations" body="Nothing matches this search.">
            <button flButton size="sm" type="button" (click)="search.set('')">Clear search</button>
          </fl-empty-state>
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Region</th>
                  <th scope="col">Bucket</th>
                  <th scope="col">Reachability</th>
                  <th scope="col" class="is-num">Usage</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (d of rows(); track d.id) {
                  <tr>
                    <td class="fl-cell-name">
                      <a class="fl-link" [routerLink]="['/management/backup/destinations', d.id]">{{
                        d.name
                      }}</a>
                    </td>
                    <td class="text-fl-ink-muted">{{ providerLabel(d.provider) }}</td>
                    <td class="fl-mono">{{ d.region }}</td>
                    <td>
                      <span class="fl-mono fl-cell-clip" [title]="d.bucket">{{ d.bucket }}</span>
                    </td>
                    <td>
                      <fl-status
                        [tone]="reachability(d.healthStatus).tone"
                        [label]="reachability(d.healthStatus).label"
                      />
                    </td>
                    <td class="is-num">{{ formatBytes(d.usageBytes) }}</td>
                    <td class="is-fit">
                      <fl-actions-menu
                        [compact]="true"
                        [label]="'Actions for ' + d.name"
                        [items]="actionsFor(d)"
                        (action)="onAction(d, $event)"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    </div>
  `,
})
export class DestinationsListComponent implements OnInit, OnDestroy {
  protected readonly backup = inject(BackupService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  private readonly confirm = inject(ConfirmService);

  protected readonly breadcrumb = [
    { label: 'Backups', link: '/management/backup' },
    { label: 'Destinations' },
  ];
  protected readonly busy = signal<Set<string>>(new Set());
  protected readonly search = signal('');
  protected readonly reachability = destinationReachability;

  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const all = this.backup.destinations();
    if (!q) return all;
    return all.filter((d) =>
      [d.name, d.bucket, d.region, d.endpoint].some((v) => (v ?? '').toLowerCase().includes(q)),
    );
  });
  protected readonly providerLabel = (p: StorageBackendProvider): string =>
    providerLabel(p, this.backup.presets());
  protected readonly formatBytes = formatBytes;

  private readonly surfaceRevision = new DestinationsListSurfaceRevision();

  readonly surface = computed(() => {
    const input: DestinationsListSurfaceInput = {
      destinations: this.backup.destinations(),
      loading: this.backup.loading(),
      hasLoadError: !!this.backup.error(),
      presets: this.backup.presets(),
    };
    return buildDestinationsListSurface(input, {
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
    void (async () => {
      await Promise.all([this.backup.loadPresets(), this.backup.loadDestinations()]);
    })();
  }

  protected reload(): void {
    void this.backup.loadDestinations();
  }

  protected actionsFor(d: BackupDestination): readonly MenuAction[] {
    const busy = this.busy().has(d.id);
    return [
      { id: 'test', label: 'Test connection', disabled: busy },
      { id: 'refresh', label: 'Refresh usage', disabled: busy },
      { id: 'delete', label: 'Delete', danger: true, separatorBefore: true },
    ];
  }

  protected onAction(d: BackupDestination, action: string): void {
    if (action === 'test') void this.onTest(d.id);
    else if (action === 'refresh') void this.onRefresh(d.id);
    else if (action === 'delete') void this.onDelete(d.id);
  }

  async onTest(id: string): Promise<void> {
    this.markBusy(id, true);
    await this.backup.testDestination(id);
    this.markBusy(id, false);
  }

  async onRefresh(id: string): Promise<void> {
    this.markBusy(id, true);
    await this.backup.refreshUsage(id);
    this.markBusy(id, false);
  }

  async onDelete(id: string): Promise<void> {
    const name = this.backup.destinations().find((d) => d.id === id)?.name ?? id;
    const ok = await this.confirm.confirm({
      title: `Delete ${name}?`,
      body: 'Flui stops using this storage. Policies that write to it must be removed first.',
      confirmLabel: 'Delete destination',
      destructive: true,
      typeToConfirm: name,
    });
    if (!ok) return;
    await this.backup.deleteDestination(id);
  }

  private markBusy(id: string, on: boolean): void {
    const set = new Set(this.busy());
    if (on) set.add(id);
    else set.delete(id);
    this.busy.set(set);
  }
}
