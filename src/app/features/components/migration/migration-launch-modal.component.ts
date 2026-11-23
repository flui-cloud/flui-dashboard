import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { ApplicationKindEnum } from '../../model/application.models';
import { ClusterService } from '../../service/cluster.service';
import { BackupService } from '../../service/backup.service';
import {
  CutoverMode,
  DbMigrationMode,
  MigrationService,
  MigrationType,
  StagingMode,
} from '../../service/migration.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { MigrationLaunchChoice } from './migration-launch-choice';
import {
  CUTOVER_OPTIONS,
  MODE_OPTIONS,
  STAGING_OPTIONS,
  TYPE_OPTIONS,
} from './migration-launch-options';

/**
 * Launch modal for cross-cluster migrations (app / managed-DB / full-app).
 * Self-contained: the parent holds a @ViewChild reference and calls `show()`;
 * on success it emits `launched` so the parent reloads its list.
 */
@Component({
  selector: 'app-migration-launch-modal',
  imports: [
    CdkTrapFocus,
    FormsModule,
    FlAlert,
    FlField,
    FlButton,
    FlIcon,
    FlSpinner,
    MigrationLaunchChoice,
  ],
  providers: [provideIcons({ lucideX })],
  template: `
    @if (open()) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (click)="close()"
        (keydown.escape)="close()"
      >
        <div
          class="fl-dialog fl-dialog--wide"
          role="dialog"
          aria-modal="true"
          aria-labelledby="m-launch-title"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="m-launch-title">New migration</h2>
            <button type="button" class="fl-dialog__close" aria-label="Close" (click)="close()">
              <fl-icon name="lucideX" />
            </button>
          </header>

          <div class="fl-dialog__body">
            <p class="m-0 text-fl-ink-muted">
              Move a workload, a managed database or a full app to another cluster.
            </p>

            <app-migration-launch-choice
              legend="What moves"
              name="m-type"
              [options]="typeOptions"
              [(value)]="type"
            />

            <div class="grid gap-3 sm:grid-cols-2">
              <fl-field label="Source cluster" for="m-src">
                <span class="fl-select-wrap">
                  <select
                    id="m-src"
                    class="fl-select"
                    [ngModel]="srcCluster()"
                    (ngModelChange)="setSrcCluster($event)"
                  >
                    <option value="">Select a cluster…</option>
                    @for (c of clusters(); track c.id) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  </select>
                </span>
              </fl-field>
              <fl-field
                label="Target cluster"
                for="m-dst"
                [error]="sameCluster() ? 'Target must differ from the source cluster.' : null"
              >
                <span class="fl-select-wrap">
                  <select
                    id="m-dst"
                    class="fl-select"
                    [ngModel]="targetCluster()"
                    (ngModelChange)="targetCluster.set($event)"
                  >
                    <option value="">Select a cluster…</option>
                    @for (c of clusters(); track c.id) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  </select>
                </span>
              </fl-field>
            </div>

            @if (type() === 'app' || type() === 'full') {
              <fl-field [label]="type() === 'app' ? 'App to move' : 'Consumer app'" for="m-app">
                <span class="fl-select-wrap">
                  <select
                    id="m-app"
                    class="fl-select"
                    [ngModel]="appId()"
                    (ngModelChange)="appId.set($event)"
                    [disabled]="!srcCluster()"
                  >
                    <option value="">
                      {{ srcCluster() ? 'Select an app…' : 'Pick a source cluster first' }}
                    </option>
                    @for (a of srcApps(); track a.id) {
                      <option [value]="a.id">{{ a.name }}</option>
                    }
                  </select>
                </span>
              </fl-field>
            }

            @if (type() === 'db' || type() === 'full') {
              <fl-field
                label="Database app"
                for="m-db"
                [hint]="
                  srcCluster() && dbApps().length === 0
                    ? 'No database apps found on the source cluster.'
                    : undefined
                "
              >
                <span class="fl-select-wrap">
                  <select
                    id="m-db"
                    class="fl-select"
                    [ngModel]="dbAppId()"
                    (ngModelChange)="dbAppId.set($event)"
                    [disabled]="!srcCluster()"
                  >
                    <option value="">
                      {{ srcCluster() ? 'Select a database…' : 'Pick a source cluster first' }}
                    </option>
                    @for (a of dbApps(); track a.id) {
                      <option [value]="a.id">{{ a.name }}</option>
                    }
                  </select>
                </span>
              </fl-field>
            }

            @if (type() === 'app') {
              <fl-alert tone="warning" title="Downtime at cutover">
                An app with volumes stops at cutover while they are copied, then starts on the
                target. If the copy fails, it starts again where it was.
              </fl-alert>
              @if (destinations().length > 1) {
                <fl-field label="Volumes move through" for="m-dest">
                  <span class="fl-select-wrap">
                    <select
                      id="m-dest"
                      class="fl-select"
                      [ngModel]="destinationId()"
                      (ngModelChange)="destinationId.set($event)"
                    >
                      <option value="">The destination protecting the app</option>
                      @for (d of destinations(); track d.id) {
                        <option [value]="d.id">{{ d.name }}</option>
                      }
                    </select>
                  </span>
                </fl-field>
              }
            }

            <app-migration-launch-choice
              legend="Cutover"
              name="m-cutover"
              [options]="cutoverOptions"
              [(value)]="cutover"
            />

            @if (type() === 'db') {
              <app-migration-launch-choice
                legend="Mode"
                name="m-mode"
                [options]="modeOptions"
                [(value)]="mode"
              />

              @if (mode() === 'restore') {
                <fl-field label="Display name" for="m-name">
                  <div class="fl-input fl-input--lg">
                    <input
                      id="m-name"
                      type="text"
                      [ngModel]="displayName()"
                      (ngModelChange)="displayName.set($event)"
                      placeholder="orders-db-restored"
                    />
                  </div>
                </fl-field>
                <fl-field
                  label="Recover to"
                  for="m-rtt"
                  hint="Leave empty for the latest recoverable point."
                >
                  <div class="fl-input fl-input--lg">
                    <input
                      id="m-rtt"
                      type="datetime-local"
                      [ngModel]="recoverTo()"
                      (ngModelChange)="recoverTo.set($event)"
                    />
                  </div>
                </fl-field>
              }
            }

            @if (type() === 'full') {
              <app-migration-launch-choice
                legend="Staging"
                name="m-staging"
                [options]="stagingOptions"
                [(value)]="staging"
              />
              @if (staging() === 'live-fenced') {
                <fl-alert tone="warning" title="The app runs against a read-only database">
                  Until cutover it must boot without running write migrations, and without
                  background workers that have side effects outside the app.
                </fl-alert>
              }
            }

            @if (error(); as e) {
              <fl-alert tone="error" title="Could not launch the migration">{{ e }}</fl-alert>
            }
          </div>

          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" [disabled]="submitting()" (click)="close()">
              Cancel
            </button>
            <button flButton="primary" type="button" [disabled]="!canSubmit()" (click)="submit()">
              @if (submitting()) {
                <fl-spinner label="Launching" />
                Launching…
              } @else {
                Launch migration
              }
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class MigrationLaunchModalComponent {
  private readonly migrationService = inject(MigrationService);
  private readonly clusterService = inject(ClusterService);
  private readonly applicationService = inject(ApplicationService);
  private readonly backupService = inject(BackupService);

  readonly launched = output<void>();

  readonly typeOptions = TYPE_OPTIONS;
  readonly cutoverOptions = CUTOVER_OPTIONS;
  readonly modeOptions = MODE_OPTIONS;
  readonly stagingOptions = STAGING_OPTIONS;

  readonly open = signal(false);
  readonly type = signal<MigrationType>('full');
  readonly srcCluster = signal('');
  readonly targetCluster = signal('');
  readonly appId = signal('');
  readonly dbAppId = signal('');
  readonly cutover = signal<CutoverMode>('auto');
  readonly mode = signal<DbMigrationMode>('live');
  readonly recoverTo = signal('');
  readonly displayName = signal('');
  readonly staging = signal<StagingMode>('scaled-down');
  readonly destinationId = signal('');
  readonly destinations = this.backupService.destinations;
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly clusters = this.clusterService.clusters;

  readonly srcApps = computed(() =>
    this.applicationService.applications().filter((a) => a.clusterId === this.srcCluster()),
  );
  readonly dbApps = computed(() =>
    this.srcApps().filter((a) => a.kind === ApplicationKindEnum.Database),
  );

  readonly sameCluster = computed(
    () => !!this.srcCluster() && this.srcCluster() === this.targetCluster(),
  );

  readonly canSubmit = computed(() => {
    if (this.submitting()) return false;
    const src = this.srcCluster();
    const dst = this.targetCluster();
    if (!src || !dst || src === dst) return false;
    switch (this.type()) {
      case 'app':
        return !!this.appId();
      case 'db':
        if (!this.dbAppId()) return false;
        if (this.mode() === 'restore' && !this.displayName().trim()) return false;
        return true;
      case 'full':
        return !!this.appId() && !!this.dbAppId();
    }
  });

  async show(): Promise<void> {
    this.reset();
    this.open.set(true);
    if (this.clusterService.clusters().length === 0) {
      await this.clusterService.loadClusters().catch(() => undefined);
    }
    if (this.applicationService.applications().length === 0) {
      await this.applicationService.loadApplications().catch(() => undefined);
    }
    if (this.backupService.destinations().length === 0) {
      await this.backupService.loadDestinations().catch(() => undefined);
    }
  }

  close(): void {
    this.open.set(false);
  }

  setSrcCluster(id: string): void {
    this.srcCluster.set(id);
    this.appId.set('');
    this.dbAppId.set('');
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      const targetClusterId = this.targetCluster();
      const cutover = this.cutover();
      switch (this.type()) {
        case 'app':
          await this.migrationService.createApp({
            srcAppId: this.appId(),
            targetClusterId,
            cutover,
            backupDestinationId: this.destinationId() || undefined,
          });
          break;
        case 'db': {
          const mode = this.mode();
          const restore = mode === 'restore';
          const local = this.recoverTo().trim();
          await this.migrationService.createDb({
            srcAppId: this.dbAppId(),
            targetClusterId,
            mode,
            cutover,
            displayName: restore ? this.displayName().trim() : undefined,
            recoveryTargetTime: restore && local ? new Date(local).toISOString() : undefined,
          });
          break;
        }
        case 'full':
          await this.migrationService.createFull({
            appId: this.appId(),
            dbAppId: this.dbAppId(),
            targetClusterId,
            cutover,
            stagingMode: this.staging(),
          });
          break;
      }
      this.launched.emit();
      this.open.set(false);
    } catch (e) {
      this.error.set(this.msg(e));
    } finally {
      this.submitting.set(false);
    }
  }

  private reset(): void {
    this.type.set('full');
    this.srcCluster.set('');
    this.targetCluster.set('');
    this.appId.set('');
    this.dbAppId.set('');
    this.cutover.set('auto');
    this.mode.set('live');
    this.recoverTo.set('');
    this.displayName.set('');
    this.staging.set('scaled-down');
    this.destinationId.set('');
    this.error.set(null);
    this.submitting.set(false);
  }

  private msg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message ?? err?.message ?? 'Request failed';
  }
}
