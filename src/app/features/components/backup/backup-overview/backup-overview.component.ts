import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import { formatBytes } from '../../../model/backup.models';
import { EnableBackupsModalComponent } from '../enable-backups/enable-backups-modal.component';

interface OverviewCard {
  title: string;
  description: string;
  link: string;
  cta: string;
}

@Component({
  selector: 'app-backup-overview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    EnableBackupsModalComponent,
  ],
  template: `
    <div class="p-6 space-y-6">
      <header class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Backup &amp; Restore</h1>
          <p class="text-sm text-muted-foreground mt-1">
            EU sovereignty by default. Activate backups in 1 click per cluster — backups use your existing provider credentials.
          </p>
        </div>
      </header>

      <!-- One-click activation -->
      <section class="space-y-2">
        <h2 class="text-sm font-semibold">Activate backups on a cluster</h2>
        <div class="rounded-lg border border-border bg-card p-5">
          @if (clusters().length === 0) {
          <p class="text-sm text-muted-foreground">
            Create a cluster first to enable backups.
          </p>
          } @else {
          <p class="text-sm text-muted-foreground mb-1">
            Pick a cluster and we'll provision destinations, install Velero and run the first backup automatically.
          </p>
          <p class="text-xs text-muted-foreground mb-3">
            Requires a configured Scaleway provider —
            <a routerLink="/management/providers" class="text-primary hover:underline">manage providers</a>.
          </p>
          <div class="flex flex-col sm:flex-row gap-2">
            <select
              [(ngModel)]="selectedClusterId"
              class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select a cluster —</option>
              @for (c of clusters(); track c.id) {
              <option [value]="c.id">{{ c.name }} ({{ c.provider }})</option>
              }
            </select>
            <button
              type="button"
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              [disabled]="!selectedClusterId"
              (click)="openEnableModal()"
            >
              Enable backups
            </button>
          </div>
          }
        </div>
      </section>

      <!-- Stats -->
      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Overview</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="rounded-lg border border-border bg-card p-4">
            <div class="text-xs text-muted-foreground">Destinations</div>
            <div class="text-2xl font-semibold mt-1">{{ destinationsCount() }}</div>
          </div>
          <div class="rounded-lg border border-border bg-card p-4">
            <div class="text-xs text-muted-foreground">Policies</div>
            <div class="text-2xl font-semibold mt-1">{{ policiesCount() }}</div>
            @if (degradedCount() > 0) {
            <div class="text-xs text-amber-600 dark:text-amber-400 mt-1">
              {{ degradedCount() }} degraded
            </div>
            }
          </div>
          <div class="rounded-lg border border-border bg-card p-4">
            <div class="text-xs text-muted-foreground">Total storage</div>
            <div class="text-2xl font-semibold mt-1">{{ totalUsage() }}</div>
          </div>
          <div class="rounded-lg border border-border bg-card p-4">
            <div class="text-xs text-muted-foreground">Restore jobs</div>
            <div class="text-2xl font-semibold mt-1">{{ restoreCount() }}</div>
          </div>
        </div>
      </section>

      <!-- Section cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @for (card of cards; track card.link) {
        <a
          [routerLink]="card.link"
          class="rounded-lg border border-border bg-card p-5 hover:border-primary transition-colors"
        >
          <h3 class="text-base font-semibold">{{ card.title }}</h3>
          <p class="text-sm text-muted-foreground mt-1">{{ card.description }}</p>
          <span class="mt-3 inline-block text-sm text-primary">{{ card.cta }} →</span>
        </a>
        }
      </div>

      @if (error()) {
      <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        {{ error() }}
      </div>
      }

      @if (showEnableModal() && selectedClusterId) {
      <app-enable-backups-modal
        [clusterId]="selectedClusterId"
        [open]="true"
        (closed)="onEnableModalClosed($event)"
      />
      }
    </div>
  `,
})
export class BackupOverviewComponent implements OnInit {
  private readonly backup = inject(BackupService);
  private readonly clusterService = inject(ClusterService);

  protected readonly showEnableModal = signal(false);
  protected selectedClusterId = '';

  readonly clusters = this.clusterService.clusters;
  readonly destinationsCount = computed(() => this.backup.destinations().length);
  readonly policiesCount = computed(() => this.backup.policies().length);
  readonly degradedCount = computed(() => this.backup.degradedPolicies().length);
  readonly restoreCount = computed(() => this.backup.restoreJobs().length);
  readonly totalUsage = computed(() => formatBytes(this.backup.totalUsageBytes()));
  readonly error = this.backup.error;

  openEnableModal(): void {
    if (!this.selectedClusterId) return;
    this.showEnableModal.set(true);
  }

  onEnableModalClosed(result: { activated: boolean }): void {
    this.showEnableModal.set(false);
    if (result.activated) {
      void this.backup.loadPolicies();
      void this.backup.loadStatus();
    }
  }

  readonly cards: OverviewCard[] = [
    {
      title: 'Destinations',
      description: 'S3-compatible storage targets shared by your backup policies.',
      link: '/management/backup/destinations',
      cta: 'Manage destinations',
    },
    {
      title: 'Policies',
      description: 'Per-cluster backup policies and schedules.',
      link: '/management/backup/policies',
      cta: 'Manage policies',
    },
    {
      title: 'Backup jobs',
      description: 'On-demand and scheduled run history with per-destination artifact status.',
      link: '/management/backup/jobs',
      cta: 'View jobs',
    },
    {
      title: 'Restore',
      description: 'Preview and run restore jobs across clusters and namespaces.',
      link: '/management/backup/restore',
      cta: 'View restores',
    },
  ];

  ngOnInit(): void {
    void (async () => {
      await Promise.all([
        this.backup.loadDestinations(),
        this.backup.loadPolicies(),
        this.backup.loadRestoreJobs(),
        this.clusterService.loadClusters(),
      ]);
    })();
  }
}
