import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import { DeployReviewGroup } from '../../application/deploy-review-group';
import { Crumb } from '../../../../ui/patterns/breadcrumb';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlField } from '../../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlPageHeader } from '../../../../ui/patterns/page-header';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlWizardSteps, WizardStep } from '../../../../ui/patterns/wizard-steps';
import { ConfirmService } from '../../../../ui/overlays/confirm';
import { FlButton } from '../../../../ui/primitives/button';
import { FlSpinner } from '../../../../ui/primitives/spinner';

const STEP_TITLES = ['Backup', 'New database', 'Review'];

@Component({
  selector: 'app-restore-wizard',
  imports: [
    FormsModule,
    RouterLink,
    DeployReviewGroup,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlPageHeader,
    FlPanel,
    FlWizardSteps,
    FlButton,
    FlSpinner,
  ],
  template: `
    <div class="fl-page">
      @if (databaseMode()) {
        <fl-page-header title="Restore into a new database" [breadcrumb]="breadcrumb">
          <span headerMeta>
            Nothing existing is touched, and it works even if the original database was deleted.
          </span>
        </fl-page-header>

        <div class="fl-wizard">
          <nav aria-label="Steps">
            <fl-wizard-steps [steps]="steps()" [current]="step()" (stepSelect)="step.set($event)" />
          </nav>

          <fl-panel [title]="titles[step()]" [flush]="true">
            <div class="fl-stack p-4">
              @switch (step()) {
                @case (0) {
                  <fl-field
                    label="Backup"
                    for="restore-artifact"
                    hint="The ID of the database backup to restore, filled in when you start from a backup job."
                  >
                    <div class="fl-input">
                      <input
                        id="restore-artifact"
                        class="fl-mono"
                        autocomplete="off"
                        [ngModel]="artifactId()"
                        (ngModelChange)="artifactId.set($event)"
                      />
                    </div>
                  </fl-field>
                }
                @case (1) {
                  <fl-field label="New database name" for="restore-db-name">
                    <div class="fl-input">
                      <input
                        id="restore-db-name"
                        placeholder="pg-restored"
                        autocomplete="off"
                        [ngModel]="dbName()"
                        (ngModelChange)="dbName.set($event)"
                      />
                    </div>
                  </fl-field>
                  <fl-field label="Cluster" for="restore-cluster">
                    <span class="fl-select-wrap">
                      <select
                        id="restore-cluster"
                        class="fl-select"
                        [ngModel]="clusterId()"
                        (ngModelChange)="clusterId.set($event)"
                      >
                        <option value="">The original cluster</option>
                        @for (c of clusters(); track c.id) {
                          <option [value]="c.id">{{ c.name }}</option>
                        }
                      </select>
                    </span>
                  </fl-field>
                  <fl-field
                    label="Point in time"
                    for="restore-at"
                    hint="Empty: everything that reached the backup storage."
                  >
                    <div class="fl-input">
                      <input
                        id="restore-at"
                        type="datetime-local"
                        [ngModel]="dbAt()"
                        (ngModelChange)="dbAt.set($event)"
                      />
                    </div>
                  </fl-field>
                }
                @case (2) {
                  <app-deploy-review-group
                    title="Backup"
                    step="0"
                    [editable]="editable"
                    (edit)="step.set(+$event)"
                  >
                    <fl-key-value>
                      <fl-kv-item key="Backup ID" [mono]="true">{{ artifactId() }}</fl-kv-item>
                    </fl-key-value>
                  </app-deploy-review-group>
                  <app-deploy-review-group
                    title="New database"
                    step="1"
                    [editable]="editable"
                    (edit)="step.set(+$event)"
                  >
                    <fl-key-value>
                      <fl-kv-item key="Name" [mono]="true">{{ dbName().trim() }}</fl-kv-item>
                      <fl-kv-item key="Cluster">{{ clusterName() }}</fl-kv-item>
                      <fl-kv-item key="Point in time">{{
                        dbAt() ? dbAt().replace('T', ' ') : 'Latest'
                      }}</fl-kv-item>
                    </fl-key-value>
                  </app-deploy-review-group>
                  @if (submitError(); as e) {
                    <fl-alert tone="error" title="Restore did not start">{{ e }}</fl-alert>
                  }
                }
              }
            </div>

            <div class="fl-wizard__footer border-t border-fl-border px-4 py-3">
              <a flButton="ghost" routerLink="/management/backup/restore">Cancel</a>
              <button
                flButton
                type="button"
                [disabled]="step() === 0"
                (click)="step.set(step() - 1)"
              >
                Previous
              </button>
              @if (step() < 2) {
                <button
                  flButton="primary"
                  type="button"
                  [disabled]="!canAdvance()"
                  (click)="step.set(step() + 1)"
                >
                  Next
                </button>
              } @else {
                <button
                  flButton="primary"
                  type="button"
                  [disabled]="!artifactId() || !dbName().trim() || submitting()"
                  (click)="onSubmitDatabase()"
                >
                  @if (submitting()) {
                    <fl-spinner label="Starting" />
                    Starting…
                  } @else {
                    Start restore
                  }
                </button>
              }
            </div>
          </fl-panel>
        </div>
      } @else {
        <fl-page-header title="Restore" [breadcrumb]="breadcrumb">
          <span headerMeta>Restores start from the backup you want to bring back.</span>
        </fl-page-header>

        <fl-panel title="How to restore">
          <fl-key-value>
            <fl-kv-item key="A database">
              Open one of its backup runs under
              <a class="fl-link" routerLink="/management/backup/jobs">Backup jobs</a>
              and choose Restore into a new database.
            </fl-kv-item>
            <fl-kv-item key="A volume">
              Open the app, then Backup, Volume backups. Restore the whole backup or only the files
              you need.
            </fl-kv-item>
          </fl-key-value>
        </fl-panel>

        @if (submitError(); as e) {
          <fl-alert tone="error" title="Restore did not start">{{ e }}</fl-alert>
        }
      }
    </div>
  `,
})
export class RestoreWizardComponent implements OnInit {
  protected readonly backup = inject(BackupService);
  private readonly clusterService = inject(ClusterService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly breadcrumb: readonly Crumb[] = [
    { label: 'Backups', link: '/management/backup' },
    { label: 'Restores', link: '/management/backup/restore' },
    { label: 'New restore' },
  ];
  protected readonly titles = STEP_TITLES;
  protected readonly editable = ['0', '1'];

  readonly clusters = this.clusterService.clusters;
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly databaseMode = signal(false);
  protected readonly step = signal(0);
  readonly artifactId = signal('');
  readonly clusterId = signal('');
  readonly dbName = signal('');
  readonly dbAt = signal('');

  protected readonly clusterName = computed(() => {
    const id = this.clusterId();
    if (!id) return 'The original cluster';
    return this.clusters().find((c) => c.id === id)?.name ?? id;
  });

  protected readonly steps = computed<WizardStep[]>(() => [
    { name: STEP_TITLES[0], summary: this.artifactId() ? 'Chosen' : undefined },
    { name: STEP_TITLES[1], summary: this.dbName().trim() || undefined },
    { name: STEP_TITLES[2] },
  ]);

  protected readonly canAdvance = computed(() => {
    if (this.step() === 0) return !!this.artifactId().trim();
    return !!this.dbName().trim();
  });

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    if (query.get('artifact')) this.artifactId.set(query.get('artifact') ?? '');
    this.databaseMode.set(query.get('kind') === 'database');
    void (async () => {
      await Promise.all([this.backup.loadDestinations(), this.clusterService.loadClusters()]);
    })();
  }

  async onSubmitDatabase(): Promise<void> {
    const name = this.dbName().trim();
    const where = this.clusterId() ? ` on ${this.clusterName()}` : '';
    const ok = await this.confirm.confirm({
      title: 'Restore into a new database',
      body: `Flui creates ${name} from this backup${where}. Nothing existing is changed.`,
      confirmLabel: 'Start restore',
    });
    if (!ok) return;
    this.submitting.set(true);
    this.submitError.set(null);
    const clusterId = this.clusterId();
    const at = this.dbAt();
    const result = await this.backup.restoreDatabase(this.artifactId().trim(), {
      name,
      ...(clusterId ? { clusterId } : {}),
      ...(at ? { recoveryTargetTime: new Date(at).toISOString() } : {}),
    });
    this.submitting.set(false);
    if (!result) {
      this.submitError.set(this.backup.error() ?? 'Restore failed to start');
      return;
    }
    this.router.navigate(['/management/backup/restore', result.restore.id]);
  }
}
