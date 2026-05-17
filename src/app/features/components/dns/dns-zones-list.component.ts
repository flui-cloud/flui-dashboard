import { Component, OnInit, inject, effect, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideTrash2, lucideGlobe, lucideAlertCircle, lucideRefreshCw, lucidePlus, lucideServer } from '@ng-icons/lucide';
import { DnsZonesService, ZoneClusterAssignment } from '../../service/dns-zones.service';
import { DnsRefreshService } from '../../service/dns-refresh.service';
import { DnsZoneResponseDto } from '../../../core/api/model/dnsZoneResponseDto';
import { DeleteConfirmationDialogComponent } from '../../../shared/components/delete-confirmation-dialog.component';

@Component({
  selector: 'app-dns-zones-list',
  standalone: true,
  imports: [NgIconComponent, RouterLink, DeleteConfirmationDialogComponent],
  providers: [provideIcons({ lucideTrash2, lucideGlobe, lucideAlertCircle, lucideRefreshCw, lucidePlus, lucideServer })],
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
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {{ zone.dnsProvider }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {{ zone.description || '—' }}
                  </td>
                  <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {{ formatDate(zone.createdAt) }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      (click)="confirmDeleteZone(zone)"
                      [disabled]="deletingId() === zone.id || isLoading || clusters.length > 0"
                      [title]="clusters.length > 0 ? 'Remove cluster assignments before deleting' : 'Delete zone'"
                      class="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </td>
                </tr>

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

  protected deletingId = signal<string | null>(null);
  protected loadingAssignments = signal(false);
  protected assignmentsMap = signal<Record<string, ZoneClusterAssignment[]>>({});

  private pendingZone: DnsZoneResponseDto | null = null;
  private readonly deleteDialog = viewChild.required<DeleteConfirmationDialogComponent>('deleteDialog');

  constructor() {
    effect(() => {
      const trigger = this.refreshService.trigger();
      if (trigger > 0) {
        this.dnsZonesService.loadZones().then(() => this.loadAssignments());
      }
    });
  }

  ngOnInit(): void {
    void (async () => {
      await this.dnsZonesService.loadZones();
      await this.loadAssignments();
    })();
  }

  refresh(): void {
    this.dnsZonesService.loadZones().then(() => this.loadAssignments());
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
