import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupBackLinkComponent } from '../shared/back-link.component';

@Component({
  selector: 'app-restore-list',
  standalone: true,
  imports: [CommonModule, RouterLink, BackupStatusBadgeComponent, BackupBackLinkComponent],
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
export class RestoreListComponent implements OnInit {
  protected readonly backup = inject(BackupService);

  ngOnInit(): void {
    void (async () => {
      await this.backup.loadRestoreJobs();
    })();
  }
}
