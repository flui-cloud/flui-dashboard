import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLoader,
  lucideTriangleAlert,
  lucideX,
} from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { ApplicationKindEnum } from '../../model/application.models';
import { ClusterService } from '../../service/cluster.service';
import {
  CutoverMode,
  DbMigrationMode,
  MigrationService,
  MigrationType,
  StagingMode,
} from '../../service/migration.service';

/**
 * Launch modal for cross-cluster migrations (app / managed-DB / full-app).
 * Self-contained: the parent holds a @ViewChild reference and calls `show()`;
 * on success it emits `launched` so the parent reloads its list.
 */
@Component({
  selector: 'app-migration-launch-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon],
  providers: [provideIcons({ lucideLoader, lucideTriangleAlert, lucideX })],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        (click)="close()"
      >
        <div
          class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl"
          (click)="$event.stopPropagation()"
        >
          <div class="mb-4 flex items-start justify-between">
            <div>
              <h3 class="text-lg font-semibold">New migration</h3>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Move a workload, a managed database, or a full app to another cluster.
              </p>
            </div>
            <button
              type="button"
              (click)="close()"
              class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ng-icon name="lucideX" class="h-4 w-4" />
            </button>
          </div>

          <div class="space-y-4">
            <!-- Type -->
            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
              <div class="inline-flex rounded-md border border-border p-0.5">
                @for (t of types; track t) {
                  <button
                    type="button"
                    (click)="setType(t)"
                    class="rounded px-3 py-1 text-sm font-medium"
                    [class]="type() === t
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'"
                  >
                    {{ typeLabel(t) }}
                  </button>
                }
              </div>
            </div>

            <!-- Clusters -->
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground" for="m-src">
                  Source cluster
                </label>
                <select
                  id="m-src"
                  [ngModel]="srcCluster()"
                  (ngModelChange)="setSrcCluster($event)"
                  class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">Select cluster…</option>
                  @for (c of clusters(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground" for="m-dst">
                  Target cluster
                </label>
                <select
                  id="m-dst"
                  [ngModel]="targetCluster()"
                  (ngModelChange)="targetCluster.set($event)"
                  class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">Select cluster…</option>
                  @for (c of clusters(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
            </div>
            @if (srcCluster() && targetCluster() && srcCluster() === targetCluster()) {
              <p class="text-xs text-destructive">Target must differ from the source cluster.</p>
            }

            <!-- Consumer app (app + full) -->
            @if (type() === 'app' || type() === 'full') {
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground" for="m-app">
                  {{ type() === 'app' ? 'App to move' : 'Consumer app' }}
                </label>
                <select
                  id="m-app"
                  [ngModel]="appId()"
                  (ngModelChange)="appId.set($event)"
                  [disabled]="!srcCluster()"
                  class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                >
                  <option value="">
                    {{ srcCluster() ? 'Select an app…' : 'Pick a source cluster first' }}
                  </option>
                  @for (a of srcApps(); track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select>
              </div>
            }

            <!-- Database app (db + full) -->
            @if (type() === 'db' || type() === 'full') {
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground" for="m-db">
                  Database app
                </label>
                <select
                  id="m-db"
                  [ngModel]="dbAppId()"
                  (ngModelChange)="dbAppId.set($event)"
                  [disabled]="!srcCluster()"
                  class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                >
                  <option value="">
                    {{ srcCluster() ? 'Select a database…' : 'Pick a source cluster first' }}
                  </option>
                  @for (a of dbApps(); track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select>
                @if (srcCluster() && dbApps().length === 0) {
                  <p class="mt-1 text-xs text-muted-foreground">
                    No database apps found on the source cluster.
                  </p>
                }
              </div>
            }

            <!-- Cutover -->
            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground" for="m-cutover">
                Cutover
              </label>
              <select
                id="m-cutover"
                [ngModel]="cutover()"
                (ngModelChange)="cutover.set($event)"
                class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="auto">Automatic — cut over as soon as it's ready</option>
                <option value="manual">Manual — park and cut over on your signal</option>
              </select>
            </div>

            <!-- DB-only: mode + restore fields -->
            @if (type() === 'db') {
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground" for="m-mode">
                  Mode
                </label>
                <select
                  id="m-mode"
                  [ngModel]="mode()"
                  (ngModelChange)="mode.set($event)"
                  class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="live">Live — stream from the running database</option>
                  <option value="restore">Restore — rebuild from a backup / point in time</option>
                </select>
              </div>

              @if (mode() === 'restore') {
                <div>
                  <label class="mb-1 block text-xs font-medium text-muted-foreground" for="m-name">
                    Display name
                  </label>
                  <input
                    id="m-name"
                    type="text"
                    [ngModel]="displayName()"
                    (ngModelChange)="displayName.set($event)"
                    placeholder="e.g. orders-db (restored)"
                    class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs font-medium text-muted-foreground" for="m-rtt">
                    Recover to (leave empty for the latest recoverable point)
                  </label>
                  <input
                    id="m-rtt"
                    type="datetime-local"
                    [ngModel]="recoverTo()"
                    (ngModelChange)="recoverTo.set($event)"
                    class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </div>
              }
            }

            <!-- Full-only: staging -->
            @if (type() === 'full') {
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground" for="m-staging">
                  Staging
                </label>
                <select
                  id="m-staging"
                  [ngModel]="staging()"
                  (ngModelChange)="staging.set($event)"
                  class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="scaled-down">Scaled-down — stage the app at zero replicas</option>
                  <option value="live-fenced">Live-fenced — stage at full replicas, read-only DB</option>
                </select>
                @if (staging() === 'live-fenced') {
                  <p class="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    live-fenced stages the app at full replicas against a READ-ONLY destination DB —
                    it must boot with no write-migrations-on-start and no background workers with
                    external side-effects until cutover.
                  </p>
                }
              </div>
            }

            @if (error(); as e) {
              <p class="flex items-center gap-1.5 text-xs text-destructive">
                <ng-icon name="lucideTriangleAlert" class="h-3.5 w-3.5" /> {{ e }}
              </p>
            }
          </div>

          <div class="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              (click)="close()"
              [disabled]="submitting()"
              class="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              (click)="submit()"
              [disabled]="!canSubmit()"
              class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              @if (submitting()) {
                <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" /> Launching…
              } @else {
                Launch migration
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MigrationLaunchModalComponent {
  private readonly migrationService = inject(MigrationService);
  private readonly clusterService = inject(ClusterService);
  private readonly applicationService = inject(ApplicationService);

  readonly launched = output<void>();

  readonly types: MigrationType[] = ['app', 'db', 'full'];

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
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly clusters = this.clusterService.clusters;

  readonly srcApps = computed(() =>
    this.applicationService
      .applications()
      .filter((a) => a.clusterId === this.srcCluster()),
  );
  readonly dbApps = computed(() =>
    this.srcApps().filter((a) => a.kind === ApplicationKindEnum.Database),
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
  }

  close(): void {
    this.open.set(false);
  }

  setType(t: MigrationType): void {
    this.type.set(t);
  }

  setSrcCluster(id: string): void {
    this.srcCluster.set(id);
    // apps belong to a cluster — clear selections that no longer apply.
    this.appId.set('');
    this.dbAppId.set('');
  }

  typeLabel(t: MigrationType): string {
    return { app: 'App', db: 'Database', full: 'Full app' }[t];
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
            recoveryTargetTime:
              restore && local ? new Date(local).toISOString() : undefined,
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
    this.error.set(null);
    this.submitting.set(false);
  }

  private msg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message ?? err?.message ?? 'Request failed';
  }
}
