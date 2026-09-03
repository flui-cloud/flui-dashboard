import { Component, OnDestroy, OnInit, computed, effect, inject, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupBackLinkComponent } from '../shared/back-link.component';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import {
  JobsListSurfaceInput,
  JobsListSurfaceRevision,
  buildJobsListSurface,
  presentedContent,
} from './jobs-list-surface';

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [FormsModule, RouterLink, BackupStatusBadgeComponent, BackupBackLinkComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="p-6 space-y-4">
      <app-backup-back-link link="/management/backup" label="Back to Backup" />
      <header>
        <h1 class="text-2xl font-semibold">Backup jobs</h1>
        <p class="text-sm text-muted-foreground mt-1">
          Recent backup runs (on-demand and scheduled).
        </p>
      </header>

      <div class="flex gap-2">
        <select
          [(ngModel)]="clusterFilter"
          (ngModelChange)="onClusterChange($event)"
          class="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">— Select a cluster —</option>
          @for (c of clusters(); track c.id) {
          <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
      </div>

      @if (!clusterFilter) {
      <p class="text-sm text-muted-foreground">Pick a cluster to load its backup history.</p>
      } @else if (jobs().length === 0) {
      <div class="rounded-lg border border-dashed border-border p-8 text-center">
        <p class="text-sm text-muted-foreground">No jobs yet for this cluster.</p>
      </div>
      } @else {
      <div class="overflow-hidden rounded-lg border border-border bg-card">
        <table class="w-full text-sm">
          <thead class="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th class="text-left px-4 py-2">Started</th>
              <th class="text-left px-4 py-2">Trigger</th>
              <th class="text-left px-4 py-2">Status</th>
              <th class="text-left px-4 py-2">Velero backup</th>
            </tr>
          </thead>
          <tbody>
            @for (j of jobs(); track j.id) {
            <tr class="border-t border-border hover:bg-muted/20">
              <td class="px-4 py-2">
                <a [routerLink]="['/management/backup/jobs', j.id]" class="hover:underline">
                  {{ j.startedAt || j.createdAt }}
                </a>
              </td>
              <td class="px-4 py-2 capitalize text-muted-foreground">{{ j.triggerType.replace('_',' ') }}</td>
              <td class="px-4 py-2">
                <app-backup-status-badge kind="job" [value]="j.status" />
              </td>
              <td class="px-4 py-2 font-mono text-xs text-muted-foreground">{{ j.veleroBackupName || '—' }}</td>
            </tr>
            }
          </tbody>
        </table>
      </div>
      }
    </div>
  `,
})
export class JobsListComponent implements OnInit, OnDestroy {
  private readonly backup = inject(BackupService);
  private readonly clusterService = inject(ClusterService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  readonly clusters = this.clusterService.clusters;
  readonly jobs = this.backup.jobs;
  clusterFilter = '';

  private readonly surfaceRevision = new JobsListSurfaceRevision();

  readonly surface = computed(() => {
    const input: JobsListSurfaceInput = {
      jobs: this.jobs(),
      clusterFilterName: this.clusterFilter
        ? (this.clusters().find((c) => c.id === this.clusterFilter)?.name ?? this.clusterFilter)
        : null,
    };
    return buildJobsListSurface(input, {
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
      await this.clusterService.loadClusters();
    })();
  }

  async onClusterChange(id: string): Promise<void> {
    if (!id) return;
    await this.backup.loadJobsByCluster(id);
  }
}
