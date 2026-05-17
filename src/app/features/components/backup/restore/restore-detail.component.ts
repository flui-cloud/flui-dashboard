import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { RestoreJob } from '../../../model/backup.models';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupProgressModalComponent } from '../shared/progress-modal.component';
import { BackupBackLinkComponent } from '../shared/back-link.component';

@Component({
  selector: 'app-restore-detail',
  standalone: true,
  imports: [CommonModule, BackupStatusBadgeComponent, BackupProgressModalComponent, BackupBackLinkComponent],
  template: `
    <div class="p-6 max-w-3xl space-y-4">
      <app-backup-back-link link="/management/backup/restore" label="Back to restores" />
      @if (job(); as r) {
      <header class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Restore job</h1>
          <p class="text-xs text-muted-foreground font-mono">{{ r.id }}</p>
        </div>
        <app-backup-status-badge kind="restore" [value]="r.status" />
      </header>

      <div class="rounded-lg border border-border bg-card p-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div class="text-xs text-muted-foreground">Artifact</div>
          <div class="font-mono text-xs">{{ r.artifactId }}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Target</div>
          <div class="capitalize">{{ r.targetKind }} → {{ r.targetClusterId }}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Source destination</div>
          <div class="font-mono text-xs">{{ r.sourceDestinationId }}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">Velero restore</div>
          <div class="font-mono text-xs">{{ r.veleroRestoreName || '—' }}</div>
        </div>
      </div>

      @if (r.errorMessage) {
      <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        {{ r.errorMessage }}
      </div>
      }

      <app-backup-progress-modal
        [operationId]="opId()"
        title="Restore in progress"
        (closed)="opId.set(null)"
      />
      } @else {
      <p class="text-sm text-muted-foreground">Loading…</p>
      }
    </div>
  `,
})
export class RestoreDetailComponent implements OnInit {
  private readonly backup = inject(BackupService);
  private readonly route = inject(ActivatedRoute);

  protected readonly job = signal<RestoreJob | null>(null);
  protected readonly opId = signal<string | null>(null);

  ngOnInit(): void {
    void (async () => {
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) return;
      const r = await this.backup.getRestoreJob(id);
      this.job.set(r);
      if (r?.infrastructureOperationId && this.backup.activeOperations()[r.infrastructureOperationId]) {
        this.opId.set(r.infrastructureOperationId);
      }
    })();
  }
}
