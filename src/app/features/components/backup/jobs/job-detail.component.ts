import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { BackupJob, formatBytes } from '../../../model/backup.models';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupProgressModalComponent } from '../shared/progress-modal.component';
import { BackupBackLinkComponent } from '../shared/back-link.component';

@Component({
  selector: 'app-job-detail',
  standalone: true,
  imports: [CommonModule, BackupStatusBadgeComponent, BackupProgressModalComponent, BackupBackLinkComponent],
  template: `
    <div class="p-6 max-w-3xl space-y-4">
      <app-backup-back-link link="/management/backup/jobs" label="Back to jobs" />

      @if (job(); as j) {
      <header class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Backup job</h1>
          <p class="text-xs text-muted-foreground font-mono">{{ j.id }}</p>
        </div>
        <app-backup-status-badge kind="job" [value]="j.status" />
      </header>

      <div class="rounded-lg border border-border bg-card p-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div class="text-xs text-muted-foreground">Trigger</div>
          <div class="capitalize">{{ j.triggerType.replace('_',' ') }}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Velero backup</div>
          <div class="font-mono text-xs">{{ j.veleroBackupName || '—' }}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Started</div>
          <div>{{ j.startedAt || '—' }}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Finished</div>
          <div>{{ j.finishedAt || '—' }}</div>
        </div>
      </div>

      @if (j.errorMessage) {
      <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        {{ j.errorMessage }}
      </div>
      } @if (j.artifact; as a) {
      <div class="rounded-lg border border-border bg-card p-5 space-y-2">
        <h3 class="text-sm font-semibold">Artifact</h3>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div class="text-xs text-muted-foreground">Size</div>
            <div>{{ formatBytes(a.sizeBytes) }}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Items</div>
            <div>{{ a.itemCount || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Expires at</div>
            <div>{{ a.expiresAt || '—' }}</div>
          </div>
        </div>

        <h4 class="text-xs uppercase tracking-wide text-muted-foreground mt-3">Locations</h4>
        <ul class="space-y-1 text-sm">
          @for (loc of a.locations; track loc.id) {
          <li class="flex items-center justify-between">
            <span>
              <span class="font-medium">{{ loc.destination?.name || loc.destinationId.slice(0,8) }}</span>
              <span class="text-muted-foreground ml-2 capitalize">{{ loc.role }}</span>
            </span>
            <app-backup-status-badge kind="location" [value]="loc.state" />
          </li>
          }
        </ul>
      </div>
      }

      <app-backup-progress-modal
        [operationId]="opId()"
        title="Backup in progress"
        (closed)="opId.set(null)"
      />
      } @else {
      <p class="text-sm text-muted-foreground">Loading…</p>
      }
    </div>
  `,
})
export class JobDetailComponent implements OnInit {
  private readonly backup = inject(BackupService);
  private readonly route = inject(ActivatedRoute);

  protected readonly job = signal<BackupJob | null>(null);
  protected readonly opId = signal<string | null>(null);
  protected readonly formatBytes = formatBytes;

  ngOnInit(): void {
    void (async () => {
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) return;
      const j = await this.backup.getJob(id);
      this.job.set(j);
      if (j?.infrastructureOperationId && this.backup.activeOperations()[j.infrastructureOperationId]) {
        this.opId.set(j.infrastructureOperationId);
      }
    })();
  }
}
