import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import { CreateRestoreJobDto } from '../../../../core/api/model/createRestoreJobDto';

@Component({
  selector: 'app-restore-wizard',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="p-6 max-w-3xl space-y-5">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold">
          {{ databaseMode() ? 'Restore into a new database' : 'Restore' }}
        </h1>
        <a
          routerLink="/management/backup/restore"
          class="text-sm text-muted-foreground hover:underline"
        >
          Cancel
        </a>
      </header>

      @if (databaseMode()) {
        <section class="space-y-3">
          <p class="text-sm text-muted-foreground">
            Restores this database backup into a new database. Nothing existing
            is touched, and it works even if the original database was deleted.
          </p>
          <label class="block">
            <span class="text-sm font-medium">Backup</span>
            <input
              [(ngModel)]="form.artifactId"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium">New database name *</span>
            <input
              [(ngModel)]="dbName"
              placeholder="pg-restored"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium">Cluster</span>
            <select
              [(ngModel)]="form.targetClusterId"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">The original cluster</option>
              @for (c of clusters(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </label>
          <label class="block">
            <span class="text-sm font-medium">Point in time</span>
            <input
              type="datetime-local"
              [(ngModel)]="dbAt"
              class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <span class="text-xs text-muted-foreground">
              Empty: everything that reached the backup storage.
            </span>
          </label>
        </section>
      } @else {
        <section class="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
          <p>
            <span class="font-medium">A database:</span>
            <span class="text-muted-foreground">
              open one of its backup runs under
              <a routerLink="/management/backup/jobs" class="text-primary hover:underline">Backup jobs</a>
              and choose "Restore into a new database".
            </span>
          </p>
          <p>
            <span class="font-medium">A volume:</span>
            <span class="text-muted-foreground">
              open the app, then Backup → Volume backups. Restore the whole
              backup or only the files you need.
            </span>
          </p>
        </section>
      }

      @if (submitError()) {
        <div
          class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
        >
          {{ submitError() }}
        </div>
      }

      @if (databaseMode()) {
      <div class="flex justify-end">
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          [disabled]="!form.artifactId || !dbName.trim() || submitting()"
          (click)="onSubmitDatabase()"
        >
          {{ submitting() ? 'Starting…' : 'Start restore' }}
        </button>
      </div>
      }
    </div>
  `,
})
export class RestoreWizardComponent implements OnInit {
  protected readonly backup = inject(BackupService);
  private readonly clusterService = inject(ClusterService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly clusters = this.clusterService.clusters;
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  form: CreateRestoreJobDto = {
    artifactId: '',
    sourceDestinationId: '',
    targetClusterId: '',
    targetKind: 'namespace' as CreateRestoreJobDto.TargetKindEnum,
    placement: 'new' as CreateRestoreJobDto.PlacementEnum,
  };

  readonly databaseMode = signal(false);
  dbName = '';
  dbAt = '';

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    if (query.get('artifact'))
      this.form.artifactId = query.get('artifact') ?? '';
    this.databaseMode.set(query.get('kind') === 'database');
    void (async () => {
      await Promise.all([
        this.backup.loadDestinations(),
        this.clusterService.loadClusters(),
      ]);
    })();
  }

  async onSubmitDatabase(): Promise<void> {
    this.submitting.set(true);
    this.submitError.set(null);
    const result = await this.backup.restoreDatabase(
      this.form.artifactId.trim(),
      {
        name: this.dbName.trim(),
        ...(this.form.targetClusterId
          ? { clusterId: this.form.targetClusterId }
          : {}),
        ...(this.dbAt
          ? { recoveryTargetTime: new Date(this.dbAt).toISOString() }
          : {}),
      },
    );
    this.submitting.set(false);
    if (!result) {
      this.submitError.set(this.backup.error() ?? 'Restore failed to start');
      return;
    }
    this.router.navigate(['/management/backup/restore', result.restore.id]);
  }
}
