import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupBackLinkComponent } from '../shared/back-link.component';

@Component({
  selector: 'app-policies-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BackupStatusBadgeComponent, BackupBackLinkComponent],
  template: `
    <div class="p-6 space-y-4">
      <app-backup-back-link link="/management/backup" label="Back to Backup" />
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Backup policies</h1>
          <p class="text-sm text-muted-foreground mt-1">
            Per-cluster policies orchestrating Velero backups across destinations.
          </p>
        </div>
        <a
          routerLink="/management/backup/policies/new"
          class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New policy
        </a>
      </header>

      <div class="flex gap-2">
        <select
          [(ngModel)]="clusterFilter"
          class="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All clusters</option>
          @for (c of clusters(); track c.id) {
          <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
      </div>

      @if (backup.loading()) {
      <p class="text-sm text-muted-foreground">Loading…</p>
      } @else if (filtered().length === 0) {
      <div class="rounded-lg border border-dashed border-border p-8 text-center">
        <p class="text-sm text-muted-foreground">No policies match the current filter.</p>
      </div>
      } @else {
      <div class="overflow-hidden rounded-lg border border-border bg-card">
        <table class="w-full text-sm">
          <thead class="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th class="text-left px-4 py-2">Name</th>
              <th class="text-left px-4 py-2">Cluster</th>
              <th class="text-left px-4 py-2">Profile</th>
              <th class="text-left px-4 py-2">Schedule</th>
              <th class="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
            <tr class="border-t border-border hover:bg-muted/20">
              <td class="px-4 py-2">
                <a [routerLink]="['/management/backup/policies', p.id]" class="font-medium hover:underline">
                  {{ p.name }}
                </a>
              </td>
              <td class="px-4 py-2 text-muted-foreground">{{ clusterName(p.clusterId) }}</td>
              <td class="px-4 py-2 text-muted-foreground capitalize">{{ p.profile }}</td>
              <td class="px-4 py-2 text-muted-foreground font-mono text-xs">
                {{ p.cronSchedule || 'on-demand' }}
              </td>
              <td class="px-4 py-2">
                <app-backup-status-badge kind="policy" [value]="p.status" />
              </td>
            </tr>
            }
          </tbody>
        </table>
      </div>
      }
    </div>
  `,
})
export class PoliciesListComponent implements OnInit {
  protected readonly backup = inject(BackupService);
  private readonly clusterService = inject(ClusterService);

  readonly clusters = this.clusterService.clusters;
  clusterFilter = '';

  readonly filtered = computed(() => {
    const id = this.clusterFilter;
    const all = this.backup.policies();
    return id ? all.filter((p) => p.clusterId === id) : all;
  });

  ngOnInit(): void {
    void (async () => {
      await Promise.all([this.backup.loadPolicies(), this.clusterService.loadClusters()]);
    })();
  }

  clusterName(id: string): string {
    return this.clusters().find((c) => c.id === id)?.name ?? id.slice(0, 8);
  }
}
