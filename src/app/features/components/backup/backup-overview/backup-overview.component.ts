import { Component, OnDestroy, OnInit, computed, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import { formatBytes } from '../../../model/backup.models';
import { EnableBackupsModalComponent } from '../enable-backups/enable-backups-modal.component';
import { PlatformBackupCardComponent } from '../platform/platform-backup-card.component';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import {
  BackupOverviewSurfaceInput,
  BackupOverviewSurfaceRevision,
  buildBackupOverviewSurface,
  presentedContent,
} from './backup-overview-surface';

interface OverviewCard {
  title: string;
  description: string;
  link: string;
  cta: string;
}

@Component({
  selector: 'app-backup-overview',
  standalone: true,
  imports: [ReadOnlySectionDirective, FormsModule, RouterLink, EnableBackupsModalComponent, PlatformBackupCardComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="p-6 space-y-6">
      <header class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Backup &amp; Restore</h1>
          <p class="text-sm text-muted-foreground mt-1">
            Your data stays in the EU, on storage you own. What you protect it with depends
            on what it is — the three below cover different things and do not replace each other.
          </p>
        </div>
      </header>

      <section class="space-y-2" appReadOnlySection="backup">
        <h2 class="text-sm font-semibold">What do you want to protect?</h2>
        <div class="grid gap-4 md:grid-cols-3">
          <div class="rounded-lg border border-border bg-card p-4 flex flex-col">
            <div class="text-sm font-semibold">A cluster</div>
            <p class="text-xs text-muted-foreground mt-1 flex-1">
              Its Kubernetes objects, and the contents of shared-storage volumes.
              <span class="text-amber-700 dark:text-amber-400">Not database volumes</span> —
              those sit on dedicated storage this engine cannot read.
            </p>
            <div class="text-xs text-muted-foreground mt-2">Runs on a schedule</div>
          </div>
          <div class="rounded-lg border border-border bg-card p-4 flex flex-col">
            <div class="text-sm font-semibold">A database</div>
            <p class="text-xs text-muted-foreground mt-1 flex-1">
              Every change shipped off-cluster as it happens, so it can be restored to any
              moment in the window — not just to last night.
            </p>
            <div class="text-xs text-muted-foreground mt-2">
              Open the database → <span class="font-medium">Backup</span>
            </div>
          </div>
          <div class="rounded-lg border border-border bg-card p-4 flex flex-col">
            <div class="text-sm font-semibold">Flui itself</div>
            <p class="text-xs text-muted-foreground mt-1 flex-1">
              The control-plane database, sealed to a recipient you hold. This is what a
              rebuild starts from when the cluster running Flui is gone.
            </p>
            <div class="text-xs text-muted-foreground mt-2">Set up below</div>
          </div>
        </div>

        <h2 class="text-sm font-semibold pt-2">Protect a cluster</h2>
        <div class="rounded-lg border border-border bg-card p-5">
          @if (clusters().length === 0) {
          <p class="text-sm text-muted-foreground">
            Create a cluster first to enable backups.
          </p>
          } @else {
          <p class="text-sm text-muted-foreground mb-1">
            Pick a cluster and Flui provisions the destination, installs the engine and takes
            the first backup. Each run records which volumes it captured and which it skipped.
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

      <!-- Platform resilience (control-plane DR) -->
      <app-platform-backup-card />

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
export class BackupOverviewComponent implements OnInit, OnDestroy {
  private readonly backup = inject(BackupService);
  private readonly clusterService = inject(ClusterService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly showEnableModal = signal(false);
  protected selectedClusterId = '';

  readonly clusters = this.clusterService.clusters;
  readonly destinationsCount = computed(() => this.backup.destinations().length);
  readonly policiesCount = computed(() => this.backup.policies().length);
  readonly degradedCount = computed(() => this.backup.degradedPolicies().length);
  readonly restoreCount = computed(() => this.backup.restoreJobs().length);
  readonly totalUsage = computed(() => formatBytes(this.backup.totalUsageBytes()));
  readonly error = this.backup.error;

  private readonly surfaceRevision = new BackupOverviewSurfaceRevision();

  readonly surface = computed(() => {
    const input: BackupOverviewSurfaceInput = {
      destinationsCount: this.destinationsCount(),
      policiesCount: this.policiesCount(),
      degradedPoliciesCount: this.degradedCount(),
      restoreJobsCount: this.restoreCount(),
      totalUsageText: this.totalUsage(),
      clustersAvailable: this.clusters().length,
      hasLoadError: !!this.error(),
    };
    return buildBackupOverviewSurface(input, {
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
