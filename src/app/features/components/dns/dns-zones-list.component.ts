import { Component, OnInit, inject, effect, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideTrash2, lucideGlobe, lucideAlertCircle, lucideRefreshCw, lucidePlus, lucideServer, lucideChevronDown, lucideChevronRight, lucideClock, lucideRadioTower } from '@ng-icons/lucide';
import { DnsZonesService, ZoneClusterAssignment } from '../../service/dns-zones.service';
import { DnsRefreshService } from '../../service/dns-refresh.service';
import { DnsReplicaService, DnsZone } from '../../service/dns-replica.service';
import { DnsZoneResponseDto } from '../../../core/api/model/dnsZoneResponseDto';
import { DeleteConfirmationDialogComponent } from '../../../shared/components/delete-confirmation-dialog.component';
import { ZoneReplicasComponent } from './zone-replicas.component';

@Component({
  selector: 'app-dns-zones-list',
  standalone: true,
  imports: [NgIconComponent, RouterLink, DeleteConfirmationDialogComponent, ZoneReplicasComponent],
  providers: [provideIcons({ lucideTrash2, lucideGlobe, lucideAlertCircle, lucideRefreshCw, lucidePlus, lucideServer, lucideChevronDown, lucideChevronRight, lucideClock, lucideRadioTower })],
  template: `
    <div class="space-y-4">

      <div class="flex items-center justify-end gap-2">
        <button
          (click)="refresh()"
          [disabled]="dnsZonesService.loading()"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="dnsZonesService.loading()" />
          Refresh
        </button>
        <a
          routerLink="../register"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
          Register Zone
        </a>
      </div>

      @if (dnsZonesService.error()) {
        <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          <ng-icon name="lucideAlertCircle" class="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{{ dnsZonesService.error() }}</span>
        </div>
      }

      @if (dnsZonesService.loading()) {
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden animate-pulse">
          <div class="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex gap-4">
            <div class="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-3 w-28 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
          </div>
          @for (i of [1, 2, 3]; track i) {
            <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-4">
              <div class="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-5 w-20 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 flex-1"></div>
              <div class="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-6 w-14 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
          }
        </div>
      } @else if (dnsZonesService.zones().length === 0) {
        <div class="text-center py-16 px-4">
          <ng-icon name="lucideGlobe" class="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p class="text-sm font-medium text-gray-900 dark:text-white">No DNS zones registered</p>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Register a DNS zone from your provider to assign it to clusters.
          </p>
        </div>
      } @else {
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <th class="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Zone Name</th>
                <th class="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Provider</th>
                <th class="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Description</th>
                <th class="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Registered</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              @for (zone of dnsZonesService.zones(); track zone.id) {
                @let clusters = assignmentsMap()[zone.id];
                @let isLoading = loadingAssignments();

                <!-- Zone row -->
                <tr class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <td class="px-4 py-3 font-medium text-gray-900 dark:text-white font-mono">
                    {{ zone.zoneName }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {{ zone.dnsProvider }}
                      </span>
                      <span
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                        [class]="providerCountFor(zone.id) > 1
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
                        [title]="providerCountFor(zone.id) > 1 ? 'Published on multiple DNS providers' : 'Single DNS provider'"
                      >
                        <ng-icon name="lucideRadioTower" class="h-3 w-3" />
                        {{ providerCountLabel(zone.id) }}
                      </span>
                      @if (ttlFor(zone.id); as ttl) {
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          title="Record TTL — a low value speeds up failover"
                        >
                          <ng-icon name="lucideClock" class="h-3 w-3" />
                          TTL {{ ttl }}s
                        </span>
                      }
                    </div>
                  </td>
                  <td class="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {{ zone.description || '—' }}
                  </td>
                  <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {{ formatDate(zone.createdAt) }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-1">
                      <button
                        (click)="toggleReplicas(zone.id)"
                        class="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        <ng-icon [name]="expandedZoneId() === zone.id ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-3.5 w-3.5" />
                        Redundancy
                      </button>
                      <button
                        (click)="confirmDeleteZone(zone)"
                        [disabled]="deletingId() === zone.id || isLoading || clusters.length > 0"
                        [title]="clusters.length > 0 ? 'Remove cluster assignments before deleting' : 'Delete zone'"
                        class="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- Replicas panel sub-row -->
                @if (expandedZoneId() === zone.id) {
                  <tr class="bg-gray-50/60 dark:bg-gray-900/20 border-t border-gray-200 dark:border-gray-700">
                    <td colspan="5" class="px-4 py-3">
                      @if (enrichedFor(zone.id); as enriched) {
                        <app-zone-replicas [zone]="enriched" (changed)="loadEnriched()" />
                      } @else {
                        <div class="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                          <ng-icon name="lucideRefreshCw" class="h-3 w-3 animate-spin" />
                          Loading redundancy…
                        </div>
                      }
                    </td>
                  </tr>
                }

                <!-- Assignments sub-row -->
                @if (isLoading || clusters.length > 0) {
                  <tr class="bg-amber-50/60 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-900/30">
                    <td colspan="5" class="px-4 py-2">
                      @if (isLoading) {
                        <div class="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                          <ng-icon name="lucideRefreshCw" class="h-3 w-3 animate-spin" />
                          Loading cluster assignments…
                        </div>
                      } @else {
                        <div class="flex flex-wrap items-center gap-2">
                          <div class="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 font-medium shrink-0">
                            <ng-icon name="lucideServer" class="h-3 w-3" />
                            Used by:
                          </div>
                          @for (c of clusters; track c.clusterId) {
                            <a
                              [routerLink]="['/cluster', c.clusterId, 'dns']"
                              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/50 border border-amber-200 dark:border-amber-700 transition-colors"
                            >
                              {{ c.clusterName }}
                              <span class="opacity-50">→</span>
                            </a>
                          }
                        </div>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <app-delete-confirmation-dialog
      #deleteDialog
      [deleting]="!!deletingId()"
      (confirmed)="onDeleteConfirmed()"
      (cancelled)="onDeleteCancelled()"
    />
  `,
})
export class DnsZonesListComponent implements OnInit {
  protected dnsZonesService = inject(DnsZonesService);
  private readonly refreshService = inject(DnsRefreshService);
  private readonly replicaService = inject(DnsReplicaService);

  protected deletingId = signal<string | null>(null);
  protected loadingAssignments = signal(false);
  protected assignmentsMap = signal<Record<string, ZoneClusterAssignment[]>>({});
  protected enrichedMap = signal<Record<string, DnsZone>>({});
  protected expandedZoneId = signal<string | null>(null);

  private pendingZone: DnsZoneResponseDto | null = null;
  private readonly deleteDialog = viewChild.required<DeleteConfirmationDialogComponent>('deleteDialog');

  constructor() {
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

  refresh(): void {
    this.dnsZonesService.loadZones().then(() => {
      void this.loadAssignments();
      void this.loadEnriched();
    });
  }

  /** Fetches the enriched zones (recordTtlSeconds + replicas) for the chips + panel. */
  async loadEnriched(): Promise<void> {
    try {
      const zones = await this.replicaService.listZones();
      this.enrichedMap.set(Object.fromEntries(zones.map((z) => [z.id, z])));
    } catch {
      // Non-fatal: chips/panel simply stay empty if the enriched fetch fails.
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

  /** Primary provider (1) plus each configured replica. */
  providerCountFor(zoneId: string): number {
    const replicas = this.enrichedMap()[zoneId]?.replicas ?? [];
    return 1 + replicas.length;
  }

  providerCountLabel(zoneId: string): string {
    const count = this.providerCountFor(zoneId);
    return count === 1 ? '1 provider' : `${count} providers`;
  }

  private async loadAssignments(): Promise<void> {
    const zones = this.dnsZonesService.zones();
    if (zones.length === 0) return;
    this.loadingAssignments.set(true);
    const entries = await Promise.all(
      zones.map(async z => {
        const clusters = await this.dnsZonesService.getZoneAssignedClusters(z.id);
        return [z.id, clusters] as [string, ZoneClusterAssignment[]];
      })
    );
    this.assignmentsMap.set(Object.fromEntries(entries));
    this.loadingAssignments.set(false);
  }

  confirmDeleteZone(zone: DnsZoneResponseDto): void {
    this.pendingZone = zone;
    this.deleteDialog().open({
      title: 'Delete DNS Zone',
      description: 'This action cannot be undone.',
      itemName: zone.zoneName,
      itemDescription: zone.description ?? undefined,
    });
  }

  async onDeleteConfirmed(): Promise<void> {
    if (!this.pendingZone) return;
    const zone = this.pendingZone;
    this.deletingId.set(zone.id);
    await this.dnsZonesService.deleteZone(zone.id);
    this.deletingId.set(null);
    this.pendingZone = null;
    this.deleteDialog().close();
  }

  onDeleteCancelled(): void {
    this.pendingZone = null;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
}
