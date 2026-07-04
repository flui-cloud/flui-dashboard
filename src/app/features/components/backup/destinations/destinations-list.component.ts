import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { formatBytes, providerLabel } from '../../../model/backup.models';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupBackLinkComponent } from '../shared/back-link.component';

@Component({
  selector: 'app-destinations-list',
  standalone: true,
  imports: [CommonModule, RouterLink, BackupStatusBadgeComponent, BackupBackLinkComponent],
  template: `
    <div class="p-6 space-y-4">
      <app-backup-back-link link="/management/backup" label="Back to Backup" />
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Backup destinations</h1>
          <p class="text-sm text-muted-foreground mt-1">
            S3-compatible storage targets shared by your policies.
          </p>
        </div>
        <a
          routerLink="/management/backup/destinations/new"
          class="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Add external S3
        </a>
      </header>

      <div class="rounded-lg border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p class="text-sm font-medium">⚡ One-click Scaleway backups</p>
          <p class="text-xs text-muted-foreground mt-0.5">
            Pick a cluster and Flui provisions the destination, schedule, Velero and first backup
            automatically — using your existing Scaleway credentials. Most users don't need to add a
            destination by hand.
          </p>
        </div>
        <a
          routerLink="/management/backup"
          class="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 text-center"
        >
          Enable backups →
        </a>
      </div>

      @if (backup.error()) {
      <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        {{ backup.error() }}
      </div>
      } @if (backup.loading()) {
      <p class="text-sm text-muted-foreground">Loading…</p>
      } @else if (backup.destinations().length === 0) {
      <div class="rounded-lg border border-dashed border-border p-8 text-center">
        <p class="text-sm text-muted-foreground">
          No destinations yet. Use <span class="font-medium text-foreground">one-click Scaleway backups</span>
          above, or add an external S3 bucket manually.
        </p>
      </div>
      } @else {
      <div class="overflow-hidden rounded-lg border border-border bg-card">
        <table class="w-full text-sm">
          <thead class="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th class="text-left px-4 py-2">Name</th>
              <th class="text-left px-4 py-2">Provider</th>
              <th class="text-left px-4 py-2">Region / Bucket</th>
              <th class="text-left px-4 py-2">Health</th>
              <th class="text-left px-4 py-2">Usage</th>
              <th class="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (d of backup.destinations(); track d.id) {
            <tr class="border-t border-border hover:bg-muted/20">
              <td class="px-4 py-2">
                <a [routerLink]="['/management/backup/destinations', d.id]" class="font-medium hover:underline">
                  {{ d.name }}
                </a>
              </td>
              <td class="px-4 py-2 text-muted-foreground">{{ providerLabel(d.provider) }}</td>
              <td class="px-4 py-2 text-muted-foreground">{{ d.region }} / {{ d.bucket }}</td>
              <td class="px-4 py-2">
                <app-backup-status-badge kind="health" [value]="d.healthStatus" />
              </td>
              <td class="px-4 py-2 text-muted-foreground">{{ formatBytes(d.usageBytes) }}</td>
              <td class="px-4 py-2 text-right space-x-2">
                <button
                  type="button"
                  class="text-xs text-primary hover:underline"
                  [disabled]="busy().has(d.id)"
                  (click)="onTest(d.id)"
                >
                  Test
                </button>
                <button
                  type="button"
                  class="text-xs text-primary hover:underline"
                  [disabled]="busy().has(d.id)"
                  (click)="onRefresh(d.id)"
                >
                  Refresh usage
                </button>
                <button
                  type="button"
                  class="text-xs text-red-600 hover:underline"
                  (click)="onDelete(d.id)"
                >
                  Delete
                </button>
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
export class DestinationsListComponent implements OnInit {
  protected readonly backup = inject(BackupService);
  private readonly router = inject(Router);

  protected readonly busy = signal<Set<string>>(new Set());
  protected readonly providerLabel = providerLabel;
  protected readonly formatBytes = formatBytes;

  ngOnInit(): void {
    void (async () => {
      await this.backup.loadDestinations();
    })();
  }

  async onTest(id: string): Promise<void> {
    this.markBusy(id, true);
    await this.backup.testDestination(id);
    this.markBusy(id, false);
  }

  async onRefresh(id: string): Promise<void> {
    this.markBusy(id, true);
    await this.backup.refreshUsage(id);
    this.markBusy(id, false);
  }

  async onDelete(id: string): Promise<void> {
    if (!confirm('Delete this destination? Policies referencing it must be removed first.'))
      return;
    await this.backup.deleteDestination(id);
  }

  private markBusy(id: string, on: boolean): void {
    const set = new Set(this.busy());
    if (on) set.add(id);
    else set.delete(id);
    this.busy.set(set);
  }
}
