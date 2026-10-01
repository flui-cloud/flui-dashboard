import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { BackupJob, formatBytes } from '../../../model/backup.models';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupProgressModalComponent } from '../shared/progress-modal.component';
import { BackupBackLinkComponent } from '../shared/back-link.component';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import {
  JobDetailSurfaceInput,
  JobDetailSurfaceRevision,
  buildJobDetailSurface,
  presentedContent,
} from './job-detail-surface';
import { MaskIdPipe } from '../../../../shared/pipes/mask-id.pipe';

@Component({
  selector: 'app-job-detail',
  standalone: true,
  imports: [MaskIdPipe, 
    BackupStatusBadgeComponent,
    BackupProgressModalComponent,
    BackupBackLinkComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="p-6 max-w-3xl space-y-4">
      <app-backup-back-link
        link="/management/backup/jobs"
        label="Back to jobs"
      />

      @if (job(); as j) {
        <header class="flex items-start justify-between">
          <div>
            <h1 class="text-2xl font-semibold">Backup job</h1>
            <p class="text-xs text-muted-foreground font-mono">{{ j.id | maskId }}</p>
          </div>
          <app-backup-status-badge kind="job" [value]="j.status" />
        </header>

        <div
          class="rounded-lg border border-border bg-card p-5 grid grid-cols-2 gap-3 text-sm"
        >
          <div>
            <div class="text-xs text-muted-foreground">Trigger</div>
            <div class="capitalize">{{ j.triggerType.replace('_', ' ') }}</div>
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

        @for (stop of stops(j); track stop.volume) {
          <p class="text-sm text-muted-foreground">
            Stopped for {{ stop.seconds }}s while copying
            <span class="font-mono text-xs">{{ stop.volume }}</span>
          </p>
        }
        @if (j.errorMessage) {
          <div
            class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
          >
            {{ j.errorMessage }}
          </div>
        }
        @if (j.artifact; as a) {
          <div class="rounded-lg border border-border bg-card p-5 space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">Artifact</h3>
              @if (a.engineClass === 'database') {
                <a
                  [routerLink]="['/management/backup/restore/new']"
                  [queryParams]="{ artifact: a.id, kind: 'database' }"
                  class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  Restore into a new database
                </a>
              }
            </div>
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

            <h4
              class="text-xs uppercase tracking-wide text-muted-foreground mt-3"
            >
              Locations
            </h4>
            <ul class="space-y-1 text-sm">
              @for (loc of a.locations; track loc.id) {
                <li class="flex items-center justify-between">
                  <span>
                    <span class="font-medium">{{
                      loc.destination?.name || loc.destinationId.slice(0, 8)
                    }}</span>
                    <span class="text-muted-foreground ml-2 capitalize">{{
                      loc.role
                    }}</span>
                  </span>
                  <app-backup-status-badge
                    kind="location"
                    [value]="loc.state"
                  />
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
export class JobDetailComponent implements OnInit, OnDestroy {
  private readonly backup = inject(BackupService);
  private readonly route = inject(ActivatedRoute);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly job = signal<BackupJob | null>(null);
  protected readonly opId = signal<string | null>(null);

  protected stops(j: BackupJob): Array<{ volume: string; seconds: number }> {
    return Object.entries(j.metadata?.stoppedSeconds ?? {}).map(
      ([volume, seconds]) => ({ volume, seconds }),
    );
  }
  protected readonly formatBytes = formatBytes;

  private readonly surfaceRevision = new JobDetailSurfaceRevision();

  readonly surface = computed(() => {
    const input: JobDetailSurfaceInput = { job: this.job() };
    const content = presentedContent(input);
    if (!content) return null;
    return buildJobDetailSurface(input, {
      revision: this.surfaceRevision.next(content),
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
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) return;
      const j = await this.backup.getJob(id);
      this.job.set(j);
      if (
        j?.infrastructureOperationId &&
        this.backup.activeOperations()[j.infrastructureOperationId]
      ) {
        this.opId.set(j.infrastructureOperationId);
      }
    })();
  }
}
