import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import {
  BackupDestination,
  costEstimateMonthlyEur,
  formatBytes,
  providerLabel,
} from '../../../model/backup.models';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupBackLinkComponent } from '../shared/back-link.component';

@Component({
  selector: 'app-destination-detail',
  standalone: true,
  imports: [CommonModule, BackupStatusBadgeComponent, BackupBackLinkComponent],
  template: `
    <div class="p-6 space-y-4 max-w-3xl">
      <app-backup-back-link link="/management/backup/destinations" label="Back to destinations" />

      @if (dest(); as d) {
      <header class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-semibold">{{ d.name }}</h1>
          <p class="text-sm text-muted-foreground mt-1">{{ providerLabel(d.provider) }}</p>
        </div>
        <div class="flex gap-2">
          <button class="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" (click)="onTest()">
            Test connection
          </button>
          <button class="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" (click)="onRefresh()">
            Refresh usage
          </button>
        </div>
      </header>

      <div class="rounded-lg border border-border bg-card p-5 space-y-3">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div class="text-xs text-muted-foreground">Health</div>
            <app-backup-status-badge kind="health" [value]="d.healthStatus" />
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Endpoint</div>
            <div class="font-mono text-xs break-all">{{ d.endpoint }}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Region / Bucket</div>
            <div>{{ d.region }} / {{ d.bucket }}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Path prefix</div>
            <div>{{ d.pathPrefix || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Encryption</div>
            <div>{{ d.encryptionMode }}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Usage</div>
            <div>{{ formatBytes(d.usageBytes) }}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Estimated cost / month</div>
            <div>{{ estimatedCost(d) }}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Last health check</div>
            <div>{{ d.lastHealthCheckAt || '—' }}</div>
          </div>
        </div>
        @if (d.lastHealthError) {
        <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {{ d.lastHealthError }}
        </div>
        }
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          class="text-sm text-red-600 hover:underline"
          (click)="onDelete(d)"
        >
          Delete destination
        </button>
      </div>
      } @else if (loading()) {
      <p class="text-sm text-muted-foreground">Loading…</p>
      } @else {
      <p class="text-sm text-muted-foreground">Destination not found.</p>
      }
    </div>
  `,
})
export class DestinationDetailComponent implements OnInit {
  private readonly backup = inject(BackupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly dest = signal<BackupDestination | null>(null);
  protected readonly loading = signal(false);
  protected readonly providerLabel = providerLabel;
  protected readonly formatBytes = formatBytes;

  ngOnInit(): void {
    void (async () => {
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) return;
      this.loading.set(true);
      const d = await this.backup.getDestination(id);
      this.dest.set(d);
      this.loading.set(false);
    })();
  }

  estimatedCost(d: BackupDestination): string {
    const v = costEstimateMonthlyEur(d.usageBytes, d.costPerGbMonthCents);
    return v == null ? '—' : `€${v.toFixed(2)}`;
  }

  async onTest(): Promise<void> {
    const id = this.dest()?.id;
    if (!id) return;
    await this.backup.testDestination(id);
    this.dest.set(await this.backup.getDestination(id));
  }

  async onRefresh(): Promise<void> {
    const id = this.dest()?.id;
    if (!id) return;
    await this.backup.refreshUsage(id);
    this.dest.set(await this.backup.getDestination(id));
  }

  async onDelete(d: BackupDestination): Promise<void> {
    if (!confirm(`Delete destination "${d.name}"?`)) return;
    const ok = await this.backup.deleteDestination(d.id);
    if (ok) this.router.navigate(['/management/backup/destinations']);
  }
}
