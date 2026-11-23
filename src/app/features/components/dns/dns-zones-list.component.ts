import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideGlobe,
  lucidePlus,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { DnsZonesService, ZoneClusterAssignment } from '../../service/dns-zones.service';
import { DnsRefreshService } from '../../service/dns-refresh.service';
import { DnsReplicaService, DnsZone } from '../../service/dns-replica.service';
import { DnsZoneResponseDto } from '../../../core/api/model/dnsZoneResponseDto';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { ZoneReplicasComponent } from './zone-replicas.component';
import {
  DnsZonesListSurfaceInput,
  DnsZonesListSurfaceRevision,
  buildDnsZonesListSurface,
  presentedContent,
} from './dns-zones-list-surface';

@Component({
  selector: 'app-dns-zones-list',
  imports: [
    ReadOnlySectionDirective,
    RouterLink,
    ZoneReplicasComponent,
    FlPanel,
    FlAlert,
    FlTable,
    FlEmptyState,
    FlLoadingState,
    FlActionsMenu,
    FlStatus,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideGlobe,
      lucidePlus,
      lucideRefreshCw,
    }),
  ],
  host: { class: 'fl-stack' },
  template: `
    @if (dnsZonesService.error()) {
      <fl-alert tone="error" title="DNS zones request failed">{{
        dnsZonesService.error()
      }}</fl-alert>
    }

    <fl-panel
      title="Registered zones"
      [count]="dnsZonesService.loading() && !zones().length ? null : zones().length"
      [flush]="true"
    >
      <ng-container panelActions>
        <button
          flButton
          size="sm"
          type="button"
          [iconOnly]="true"
          aria-label="Refresh"
          title="Refresh"
          [disabled]="dnsZonesService.loading()"
          (click)="refresh()"
        >
          <fl-icon name="lucideRefreshCw" [size]="14" />
        </button>
        <a
          flButton="primary"
          size="sm"
          appReadOnlySection="infrastructure"
          routerLink="/infrastructure/domains/register"
        >
          <fl-icon name="lucidePlus" [size]="14" />
          Register zone
        </a>
      </ng-container>

      @if (dnsZonesService.loading() && zones().length === 0) {
        <fl-loading-state [rows]="3" />
      } @else if (zones().length === 0) {
        <fl-empty-state
          icon="lucideGlobe"
          title="No DNS zones registered"
          body="Register a DNS zone from your provider to assign it to clusters."
        />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col" class="is-fit"><span class="fl-sr">Redundancy details</span></th>
                <th scope="col">Zone</th>
                <th scope="col">Provider</th>
                <th scope="col">Redundancy</th>
                <th scope="col" class="is-num">TTL</th>
                <th scope="col">Used by</th>
                <th scope="col">Description</th>
                <th scope="col" class="is-num">Registered</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (zone of zones(); track zone.id) {
                @let clusters = assignmentsMap()[zone.id] ?? [];
                @let open = expandedZoneId() === zone.id;
                @let providers = providerCountFor(zone.id);
                <tr [class.is-selected]="open">
                  <td class="is-fit">
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [iconOnly]="true"
                      [attr.aria-expanded]="open"
                      [attr.aria-label]="
                        (open ? 'Hide redundancy for ' : 'Show redundancy for ') + zone.zoneName
                      "
                      (click)="toggleReplicas(zone.id)"
                    >
                      <fl-icon [name]="open ? 'lucideChevronDown' : 'lucideChevronRight'" />
                    </button>
                  </td>
                  <td class="fl-cell-name fl-mono">{{ zone.zoneName }}</td>
                  <td>{{ zone.dnsProvider }}</td>
                  <td>
                    <fl-status
                      [tone]="providers > 1 ? 'success' : 'neutral'"
                      [label]="providerCountLabel(zone.id)"
                      [attr.title]="
                        providers > 1
                          ? 'Published on multiple DNS providers'
                          : 'Single DNS provider'
                      "
                    />
                  </td>
                  <td class="is-num" title="Record TTL. A low value speeds up failover.">
                    {{ ttlFor(zone.id) ? ttlFor(zone.id) + ' s' : '—' }}
                  </td>
                  <td class="whitespace-normal">
                    @if (loadingAssignments()) {
                      <span class="fl-row text-fl-ink-muted">
                        <fl-spinner label="Loading cluster assignments" />
                        Loading
                      </span>
                    } @else if (clusters.length > 0) {
                      <span class="fl-row">
                        @for (c of clusters; track c.clusterId) {
                          <a class="fl-link" [routerLink]="['/cluster', c.clusterId, 'dns']">{{
                            c.clusterName
                          }}</a>
                        }
                      </span>
                    } @else {
                      <span class="text-fl-ink-muted">Not assigned</span>
                    }
                  </td>
                  <td class="text-fl-ink-secondary">{{ zone.description || '—' }}</td>
                  <td class="is-num">{{ formatDate(zone.createdAt) }}</td>
                  <td class="is-fit">
                    <fl-actions-menu
                      appReadOnlySection
                      label="Zone actions"
                      [compact]="true"
                      [items]="zoneActions()[zone.id] ?? []"
                      [attr.title]="
                        clusters.length > 0 ? 'Remove cluster assignments before deleting' : null
                      "
                      (action)="confirmDeleteZone(zone)"
                    />
                  </td>
                </tr>
                @if (open) {
                  <tr>
                    <td colspan="9" class="whitespace-normal">
                      @if (enrichedFor(zone.id); as enriched) {
                        <app-zone-replicas [zone]="enriched" (changed)="loadEnriched()" />
                      } @else {
                        <span class="fl-row py-2 text-fl-ink-muted">
                          <fl-spinner label="Loading redundancy" />
                          Loading redundancy
                        </span>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class DnsZonesListComponent implements OnInit, OnDestroy {
  protected dnsZonesService = inject(DnsZonesService);
  private readonly refreshService = inject(DnsRefreshService);
  private readonly replicaService = inject(DnsReplicaService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly confirmService = inject(ConfirmService);
  private readonly surfaceRevision = new DnsZonesListSurfaceRevision();

  protected readonly zones = this.dnsZonesService.zones;

  readonly surface = computed(() => {
    const input: DnsZonesListSurfaceInput = {
      zones: this.dnsZonesService.zones(),
      isLoading: this.dnsZonesService.loading(),
      expandedZoneId: this.expandedZoneId(),
      providerCountOf: (id) => this.providerCountFor(id),
      ttlOf: (id) => this.ttlFor(id),
      assignedClusterCountOf: (id) => (this.assignmentsMap()[id] ?? []).length,
    };
    const content = presentedContent(input);
    return buildDnsZonesListSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  protected deletingId = signal<string | null>(null);
  protected loadingAssignments = signal(false);
  protected assignmentsMap = signal<Record<string, ZoneClusterAssignment[] | undefined>>({});
  protected enrichedMap = signal<Record<string, DnsZone>>({});
  protected expandedZoneId = signal<string | null>(null);

  private pendingZone: DnsZoneResponseDto | null = null;

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });

    effect(() => {
      const trigger = this.refreshService.trigger();
      if (trigger > 0) {
        this.dnsZonesService.loadZones().then(() => {
          void this.loadAssignments();
          void this.loadEnriched();
        });
      }
    });
  }

  ngOnInit(): void {
    void (async () => {
      await this.dnsZonesService.loadZones();
      await Promise.all([this.loadAssignments(), this.loadEnriched()]);
    })();
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  refresh(): void {
    this.dnsZonesService.loadZones().then(() => {
      void this.loadAssignments();
      void this.loadEnriched();
    });
  }

  async loadEnriched(): Promise<void> {
    const zones = await this.replicaService.listZones().catch(() => null);
    if (zones) {
      this.enrichedMap.set(Object.fromEntries(zones.map((z) => [z.id, z])));
    }
  }

  toggleReplicas(zoneId: string): void {
    this.expandedZoneId.update((cur) => (cur === zoneId ? null : zoneId));
  }

  enrichedFor(zoneId: string): DnsZone | undefined {
    return this.enrichedMap()[zoneId];
  }

  ttlFor(zoneId: string): number | undefined {
    return this.enrichedMap()[zoneId]?.recordTtlSeconds;
  }

  providerCountFor(zoneId: string): number {
    const replicas = this.enrichedMap()[zoneId]?.replicas ?? [];
    return 1 + replicas.length;
  }

  providerCountLabel(zoneId: string): string {
    const count = this.providerCountFor(zoneId);
    return count === 1 ? '1 provider' : `${count} providers`;
  }

  protected readonly zoneActions = computed<Record<string, MenuAction[]>>(() => {
    const deleting = this.deletingId();
    const loading = this.loadingAssignments();
    const assignments = this.assignmentsMap();
    return Object.fromEntries(
      this.zones().map((zone) => [
        zone.id,
        [
          {
            id: 'delete',
            label: 'Delete zone',
            danger: true,
            disabled: deleting === zone.id || loading || (assignments[zone.id] ?? []).length > 0,
          },
        ],
      ]),
    );
  });

  private async loadAssignments(): Promise<void> {
    const zones = this.dnsZonesService.zones();
    if (zones.length === 0) return;
    this.loadingAssignments.set(true);
    const entries = await Promise.all(
      zones.map(async (z) => {
        const clusters = await this.dnsZonesService.getZoneAssignedClusters(z.id);
        return [z.id, clusters] as [string, ZoneClusterAssignment[]];
      }),
    );
    this.assignmentsMap.set(Object.fromEntries(entries));
    this.loadingAssignments.set(false);
  }

  async confirmDeleteZone(zone: DnsZoneResponseDto): Promise<void> {
    this.pendingZone = zone;
    const descriptionSuffix = zone.description ? ` (${zone.description})` : '';
    const confirmed = await this.confirmService.confirm({
      title: 'Delete DNS zone',
      body: `Delete ${zone.zoneName}${descriptionSuffix} from Flui? This cannot be undone.`,
      confirmLabel: 'Delete zone',
      destructive: true,
    });
    if (confirmed) {
      await this.onDeleteConfirmed();
    } else {
      this.onDeleteCancelled();
    }
  }

  async onDeleteConfirmed(): Promise<void> {
    if (!this.pendingZone) return;
    const zone = this.pendingZone;
    this.deletingId.set(zone.id);
    await this.dnsZonesService.deleteZone(zone.id);
    this.deletingId.set(null);
    this.pendingZone = null;
  }

  onDeleteCancelled(): void {
    this.pendingZone = null;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB');
  }
}
