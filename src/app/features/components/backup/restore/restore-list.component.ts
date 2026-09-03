import { Component, OnDestroy, OnInit, computed, effect, inject, ChangeDetectionStrategy } from '@angular/core';

import { RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupBackLinkComponent } from '../shared/back-link.component';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import {
  RestoreListSurfaceInput,
  RestoreListSurfaceRevision,
  buildRestoreListSurface,
  presentedContent,
} from './restore-list-surface';

@Component({
  selector: 'app-restore-list',
  standalone: true,
  imports: [ReadOnlySectionDirective, RouterLink, BackupStatusBadgeComponent, BackupBackLinkComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="p-6 space-y-4">
      <app-backup-back-link link="/management/backup" label="Back to Backup" />
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Restore jobs</h1>
          <p class="text-sm text-muted-foreground mt-1">
            Past and ongoing restores. Restores can run cross-cluster (DR drills).
          </p>
        </div>
        <a
          appReadOnlySection="backup"
          routerLink="/management/backup/restore/new"
          class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New restore
        </a>
      </header>

      @if (backup.restoreJobs().length === 0) {
      <div class="rounded-lg border border-dashed border-border p-8 text-center">
        <p class="text-sm text-muted-foreground">No restore jobs yet.</p>
      </div>
      } @else {
      <div class="overflow-hidden rounded-lg border border-border bg-card">
        <table class="w-full text-sm">
          <thead class="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th class="text-left px-4 py-2">Created</th>
              <th class="text-left px-4 py-2">Target</th>
              <th class="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            @for (r of backup.restoreJobs(); track r.id) {
            <tr class="border-t border-border hover:bg-muted/20">
              <td class="px-4 py-2">
                <a [routerLink]="['/management/backup/restore', r.id]" class="hover:underline">
                  {{ r.createdAt }}
                </a>
              </td>
              <td class="px-4 py-2 capitalize text-muted-foreground">
                {{ r.targetKind }} → {{ r.targetClusterId.slice(0, 8) }}
              </td>
              <td class="px-4 py-2">
                <app-backup-status-badge kind="restore" [value]="r.status" />
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
export class RestoreListComponent implements OnInit, OnDestroy {
  protected readonly backup = inject(BackupService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  private readonly surfaceRevision = new RestoreListSurfaceRevision();

  readonly surface = computed(() => {
    const input: RestoreListSurfaceInput = { restoreJobs: this.backup.restoreJobs() };
    return buildRestoreListSurface(input, {
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
      await this.backup.loadRestoreJobs();
    })();
  }
}
