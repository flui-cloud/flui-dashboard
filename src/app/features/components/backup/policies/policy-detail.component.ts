import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { BackupPolicy } from '../../../model/backup.models';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupProgressModalComponent } from '../shared/progress-modal.component';
import { BackupBackLinkComponent } from '../shared/back-link.component';

@Component({
  selector: 'app-policy-detail',
  standalone: true,
  imports: [CommonModule, BackupStatusBadgeComponent, BackupProgressModalComponent, BackupBackLinkComponent],
  template: `
    <div class="p-6 max-w-3xl space-y-4">
      <app-backup-back-link link="/management/backup/policies" label="Back to policies" />
      @if (policy(); as p) {
      <header class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-semibold">{{ p.name }}</h1>
          <p class="text-sm text-muted-foreground">
            <app-backup-status-badge kind="policy" [value]="p.status" />
            <span class="ml-2 capitalize">{{ p.profile }} profile</span>
          </p>
        </div>
        <button
          type="button"
          class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          [disabled]="running()"
          (click)="onRunNow(p.id)"
        >
          {{ running() ? 'Starting…' : 'Run now' }}
        </button>
      </header>

      @if (p.status === 'degraded') {
      <div class="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
        Policy is degraded — primary is healthy but a replica destination is failing. Recovery will retry automatically.
      </div>
      }

      <div class="rounded-lg border border-border bg-card p-5 space-y-3 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="text-xs text-muted-foreground">Scope</div>
            <div class="capitalize">{{ p.scope.replace('_',' ') }}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Schedule</div>
            <div class="font-mono text-xs">{{ p.cronSchedule || 'on-demand' }}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Retention</div>
            <div>{{ p.retentionDays }}d / {{ p.retentionMaxCopies || '∞' }} copies</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Includes PVC data</div>
            <div>{{ p.includePvcs ? 'Yes' : 'No' }}</div>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-border bg-card p-5 space-y-2">
        <h3 class="text-sm font-semibold">Destinations</h3>
        <ul class="space-y-1 text-sm">
          @for (d of p.destinations; track d.id) {
          <li class="flex items-center justify-between">
            <span>
              <span class="font-medium">{{ d.destination?.name || d.destinationId.slice(0,8) }}</span>
              <span class="text-muted-foreground ml-2 capitalize">{{ d.role }}</span>
            </span>
            <span class="text-xs text-muted-foreground">
              Replication: {{ d.lastReplicationStatus }}
            </span>
          </li>
          }
        </ul>
      </div>

      <div class="flex justify-end">
        <button type="button" class="text-sm text-red-600 hover:underline" (click)="onDelete(p)">
          Delete policy
        </button>
      </div>
      } @else {
      <p class="text-sm text-muted-foreground">Loading…</p>
      }

      <app-backup-progress-modal
        [operationId]="activeOpId()"
        title="Running backup"
        (closed)="activeOpId.set(null)"
      />
    </div>
  `,
})
export class PolicyDetailComponent implements OnInit {
  private readonly backup = inject(BackupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly policy = signal<BackupPolicy | null>(null);
  protected readonly running = signal(false);
  protected readonly activeOpId = signal<string | null>(null);

  ngOnInit(): void {
    void (async () => {
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) return;
      this.policy.set(await this.backup.getPolicy(id));
    })();
  }

  async onRunNow(policyId: string): Promise<void> {
    this.running.set(true);
    const result = await this.backup.runOnDemand(policyId);
    this.running.set(false);
    if (result?.operationId) this.activeOpId.set(result.operationId);
  }

  async onDelete(p: BackupPolicy): Promise<void> {
    if (!confirm(`Delete policy "${p.name}"?`)) return;
    const ok = await this.backup.deletePolicy(p.id);
    if (ok) this.router.navigate(['/management/backup/policies']);
  }
}
