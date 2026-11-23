import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';

import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlCopyId } from '../../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlPageHeader } from '../../../../ui/patterns/page-header';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../../ui/overlays/confirm';
import { FlButton } from '../../../../ui/primitives/button';
import { FlStatus } from '../../../../ui/primitives/status';
import { BackupService } from '../../../service/backup.service';
import {
  BackupDestination,
  costEstimateMonthlyEur,
  formatBytes,
  providerLabel,
} from '../../../model/backup.models';
import { destinationReachability } from '../shared/backup-tones';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import {
  DestinationDetailSurfaceInput,
  DestinationDetailSurfaceRevision,
  buildDestinationDetailSurface,
  presentedContent,
} from './destination-detail-surface';

const DELETE_ACTIONS: readonly MenuAction[] = [
  { id: 'delete', label: 'Delete destination', danger: true },
];

@Component({
  selector: 'app-destination-detail',
  imports: [
    DatePipe,
    ReadOnlySectionDirective,
    RouterLink,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlCopyId,
    FlKeyValue,
    FlKvItem,
    FlEmptyState,
    FlLoadingState,
    FlActionsMenu,
    FlButton,
    FlStatus,
  ],
  template: `
    <div class="fl-page">
      @if (dest(); as d) {
        <fl-page-header [title]="d.name" [breadcrumb]="breadcrumb()">
          <fl-status
            headerStatus
            [tone]="reachability(d.healthStatus).tone"
            [label]="reachability(d.healthStatus).label"
          />
          <span headerMeta>{{ providerLabel(d.provider) }}</span>
          <fl-copy-id headerMeta [value]="d.id" label="destination ID" />
          <ng-container headerActions>
            <button flButton type="button" appReadOnlySection="backup" (click)="onTest()">
              Test connection
            </button>
            <button flButton type="button" appReadOnlySection="backup" (click)="onRefresh()">
              Refresh usage
            </button>
            <fl-actions-menu
              appReadOnlySection="backup"
              [items]="deleteActions"
              (action)="onDelete(d)"
            />
          </ng-container>
        </fl-page-header>

        @if (d.lastHealthError) {
          <fl-alert tone="error" title="Last check failed">{{ d.lastHealthError }}</fl-alert>
        }

        <div class="fl-stack">
          <fl-panel title="Storage">
            <fl-key-value>
              <fl-kv-item key="Endpoint" [mono]="true">{{ d.endpoint }}</fl-kv-item>
              <fl-kv-item key="Region" [mono]="true">{{ d.region }}</fl-kv-item>
              <fl-kv-item key="Bucket" [mono]="true">{{ d.bucket }}</fl-kv-item>
              <fl-kv-item key="Path prefix" [mono]="!!d.pathPrefix">{{
                d.pathPrefix || '—'
              }}</fl-kv-item>
              <fl-kv-item key="Encryption">{{ encryptionLabel(d.encryptionMode) }}</fl-kv-item>
              <fl-kv-item key="Last health check">{{
                d.lastHealthCheckAt ? (d.lastHealthCheckAt | date: 'd MMM y, HH:mm') : '—'
              }}</fl-kv-item>
            </fl-key-value>
          </fl-panel>

          <fl-panel title="Usage and cost">
            <fl-key-value>
              <fl-kv-item key="Usage">{{ formatBytes(d.usageBytes) }}</fl-kv-item>
              <fl-kv-item key="Estimated cost per month">{{ estimatedCost(d) }}</fl-kv-item>
              <fl-kv-item key="Price per GB per month">
                @if (editingCost()) {
                  <span class="fl-row">
                    <span class="fl-input w-24">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        [value]="d.costPerGbMonthCents ?? ''"
                        (input)="costDraft.set($any($event.target).value)"
                        aria-label="Cents per GB per month"
                      />
                    </span>
                    <span class="text-fl-ink-muted">cents</span>
                    <button flButton size="sm" type="button" (click)="saveCost()">Save</button>
                    <button flButton="ghost" size="sm" type="button" (click)="saveCost(true)">
                      List price
                    </button>
                  </span>
                  @if (costError()) {
                    <span class="mt-2 block">
                      <fl-alert tone="error" title="Price not saved">{{ costError() }}</fl-alert>
                    </span>
                  }
                } @else {
                  <span class="fl-row">
                    {{
                      d.costPerGbMonthCents == null ? 'Not set' : d.costPerGbMonthCents + ' cents'
                    }}
                    @if (d.metadata?.['costSource'] === 'list-price') {
                      <span class="text-fl-ink-muted">(list price)</span>
                    }
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      (click)="editingCost.set(true)"
                    >
                      Change
                    </button>
                  </span>
                }
              </fl-kv-item>
            </fl-key-value>
          </fl-panel>
        </div>
      } @else if (loading()) {
        <fl-page-header title="Destination" [breadcrumb]="breadcrumb()" />
        <fl-panel><fl-loading-state [rows]="4" /></fl-panel>
      } @else {
        <fl-page-header title="Destination" [breadcrumb]="breadcrumb()" />
        <fl-panel>
          <fl-empty-state title="Destination not found">
            <a flButton size="sm" routerLink="/management/backup/destinations"
              >Back to destinations</a
            >
          </fl-empty-state>
        </fl-panel>
      }
    </div>
  `,
})
export class DestinationDetailComponent implements OnInit, OnDestroy {
  private readonly backup = inject(BackupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly dest = signal<BackupDestination | null>(null);
  protected readonly loading = signal(false);
  protected readonly editingCost = signal(false);
  protected readonly costDraft = signal('');
  protected readonly costError = signal<string | null>(null);
  private readonly confirm = inject(ConfirmService);
  protected readonly deleteActions = DELETE_ACTIONS;
  protected readonly reachability = destinationReachability;
  protected readonly breadcrumb = computed(() => [
    { label: 'Backups', link: '/management/backup' },
    { label: 'Destinations', link: '/management/backup/destinations' },
    { label: this.dest()?.name ?? 'Destination' },
  ]);

  async saveCost(listPrice = false): Promise<void> {
    const d = this.dest();
    if (!d) return;
    const raw = this.costDraft().trim();
    const typed = raw === '' ? d.costPerGbMonthCents : raw;
    const cents = listPrice ? null : Number(typed);
    if (cents !== null && (!Number.isFinite(cents) || cents < 0)) {
      this.costError.set('Use cents per GB per month, e.g. 1.606');
      return;
    }
    const failed = await this.backup.setDestinationCost(d.id, cents);
    this.costError.set(failed);
    if (!failed) {
      this.editingCost.set(false);
      this.costDraft.set('');
      this.dest.set(await this.backup.getDestination(d.id));
    }
  }
  protected readonly providerLabel = providerLabel;
  protected encryptionLabel(mode: string | undefined): string {
    if (mode === 'flui_managed') return 'Flui-managed';
    if (mode === 'byo_passphrase') return 'Your own passphrase';
    if (mode === 'none') return 'None';
    return mode || '—';
  }
  protected readonly formatBytes = formatBytes;

  private readonly surfaceRevision = new DestinationDetailSurfaceRevision();

  readonly surface = computed(() => {
    const input: DestinationDetailSurfaceInput = { destination: this.dest() };
    const content = presentedContent(input);
    if (!content) return null;
    return buildDestinationDetailSurface(input, {
      revision: this.surfaceRevision.next(content),
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
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) return;
      this.loading.set(true);
      const d = await this.backup.getDestination(id);
      this.dest.set(d);
      this.loading.set(false);
    })();
  }

  estimatedCost(d: BackupDestination): string {
    const v = costEstimateMonthlyEur(d.usageBytes, d.costPerGbMonthCents);
    return v == null ? '—' : `€${v.toFixed(2)}`;
  }

  async onTest(): Promise<void> {
    const id = this.dest()?.id;
    if (!id) return;
    await this.backup.testDestination(id);
    this.dest.set(await this.backup.getDestination(id));
  }

  async onRefresh(): Promise<void> {
    const id = this.dest()?.id;
    if (!id) return;
    await this.backup.refreshUsage(id);
    this.dest.set(await this.backup.getDestination(id));
  }

  async onDelete(d: BackupDestination): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `Delete ${d.name}?`,
      body: 'Flui stops using this storage. Policies that write to it must be removed first.',
      confirmLabel: 'Delete destination',
      destructive: true,
      typeToConfirm: d.name,
    });
    if (!confirmed) return;
    const ok = await this.backup.deleteDestination(d.id);
    if (ok) this.router.navigate(['/management/backup/destinations']);
  }
}
