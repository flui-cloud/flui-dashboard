import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BackupService } from '../../../service/backup.service';
import {
  ClusterProtection,
  ProtectedApp,
  protectedAppLine,
} from '../../../model/backup-protection.models';
import { AssistantOperationProgressComponent } from '../../assistant/assistant-operation-progress.component';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';
import { NeedsDecisionListComponent } from './needs-decision-list.component';

const OUTCOME_TONE: Record<string, string> = {
  protected: 'text-green-700 dark:text-green-400',
  already_protected: 'text-green-700 dark:text-green-400',
  waiting: 'text-muted-foreground',
  needs_decision: 'text-amber-700 dark:text-amber-400',
  failed: 'text-red-600',
  skipped: 'text-muted-foreground',
};

/**
 * "Protect this cluster": every application on it gets a backup policy of its
 * own, the ones installed later too.
 */
@Component({
  selector: 'app-cluster-protection-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AssistantOperationProgressComponent,
    NeedsDecisionListComponent,
    ReadOnlySectionDirective,
  ],
  template: `
    <div class="rounded-lg border border-border bg-card p-4 space-y-3" data-testid="cluster-protection">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold">{{ clusterName() }}</span>
            @if (view(); as v) {
              <span
                class="rounded-full border px-2 py-0.5 text-[11px]"
                [class]="v.protected
                  ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'border-border bg-muted text-muted-foreground'"
              >
                {{ v.protected ? 'Every app protected' : 'Not protected' }}
              </span>
            }
          </div>
          @if (view(); as v) {
            @if (v.protected) {
              <p class="text-xs text-muted-foreground mt-1">
                To {{ destinationName(v.destinationId) }} ·
                {{ v.cronSchedule ? 'at ' + v.cronSchedule + ' UTC' : 'default schedule' }} ·
                {{ v.beforeDeploy ? 'backup before each deploy' : 'no backup before deploys' }}
              </p>
            } @else {
              <p class="text-xs text-muted-foreground mt-1">
                Each app gets its own backup, new apps included.
              </p>
            }
          } @else if (loadError()) {
            <p class="text-xs text-red-600 mt-1">{{ loadError() }}</p>
          }
        </div>
        @if (view(); as v) {
          <div class="flex gap-2" appReadOnlySection="backup">
            @if (v.protected) {
              <button
                type="button"
                class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                [disabled]="!!operationId() || working()"
                (click)="confirmingStop.set(true)"
              >
                Stop protecting new apps
              </button>
            } @else if (!choosing() && !operationId()) {
              <button
                type="button"
                class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                (click)="startChoosing()"
              >
                Protect this cluster
              </button>
            }
          </div>
        }
      </div>

      @if (choosing()) {
        <div class="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
          <label class="block text-xs">
            <span class="text-muted-foreground">Backup storage</span>
            <select
              [ngModel]="destinationId()"
              (ngModelChange)="destinationId.set($event)"
              class="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              @for (d of backup.destinations(); track d.id) {
                <option [value]="d.id">{{ d.name }}</option>
              }
            </select>
          </label>
          <label class="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              [ngModel]="beforeDeploy()"
              (ngModelChange)="beforeDeploy.set($event)"
            />
            Back up before each deploy
          </label>
          <button
            type="button"
            class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            [disabled]="!destinationId() || working()"
            (click)="protect()"
          >
            {{ working() ? 'Starting…' : 'Protect' }}
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm hover:bg-muted"
            (click)="choosing.set(false)"
          >
            Cancel
          </button>
          @if (!backup.destinations().length) {
            <p class="w-full text-xs text-muted-foreground">
              No backup storage yet: use "Enable backups" below, or add a destination.
            </p>
          }
        </div>
      }

      @if (operationId(); as op) {
        <app-assistant-operation-progress
          [operationId]="op"
          label="Protecting every app on this cluster"
          (settled)="onSettled()"
        />
      }

      @if (failure()) {
        <p class="text-sm text-red-600">{{ failure() }}</p>
      }

      @if (view(); as v) {
        <app-needs-decision-list
          [items]="v.needsDecision"
          [destinationId]="v.destinationId ?? backup.destinations()[0]?.id ?? null"
          (decided)="reload()"
        />

        @if (v.applications.length) {
          <div>
            <button
              type="button"
              class="text-xs text-muted-foreground hover:underline"
              (click)="showApps.set(!showApps())"
            >
              {{ showApps() ? 'Hide' : 'Show' }} what each app got ({{ v.applications.length }})
            </button>
            @if (showApps()) {
              <ul class="mt-2 divide-y divide-border/60 text-sm">
                @for (a of apps(); track a.applicationId) {
                  <li class="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span>{{ a.name ?? a.applicationId }}</span>
                    <span class="text-xs" [class]="tone(a)">{{ line(a) }}</span>
                  </li>
                }
              </ul>
            }
          </div>
        }
      }
    </div>

    @if (confirmingStop()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        (click)="closeStop()"
      >
        <div
          class="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-6 shadow-xl"
          (click)="$event.stopPropagation()"
        >
          <h3 class="text-lg font-semibold">Stop protecting new apps?</h3>
          <p class="text-sm text-muted-foreground">
            Apps installed on {{ clusterName() }} from now on get no backup
            unless someone adds one. The backups already set up keep running.
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              (click)="closeStop()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              [disabled]="working()"
              (click)="stop()"
            >
              {{ working() ? 'Stopping…' : 'Stop' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ClusterProtectionCardComponent {
  protected readonly backup = inject(BackupService);

  readonly clusterId = input.required<string>();
  readonly clusterName = input<string>('');
  readonly changed = output<void>();

  protected readonly view = signal<ClusterProtection | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);
  protected readonly choosing = signal(false);
  protected readonly working = signal(false);
  protected readonly confirmingStop = signal(false);
  protected readonly showApps = signal(false);
  protected readonly destinationId = signal('');
  protected readonly beforeDeploy = signal(false);
  protected readonly operationId = signal<string | null>(null);

  protected readonly apps = computed(() =>
    [...(this.view()?.applications ?? [])].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? ''),
    ),
  );

  protected readonly line = protectedAppLine;

  constructor() {
    effect(() => {
      const id = this.clusterId();
      untracked(() => {
        this.view.set(null);
        this.operationId.set(null);
        this.choosing.set(false);
        void this.load(id);
      });
    });
  }

  protected tone(app: ProtectedApp): string {
    return OUTCOME_TONE[app.outcome] ?? 'text-muted-foreground';
  }

  protected destinationName(id: string | null): string {
    if (!id) return 'no destination';
    return this.backup.destinations().find((d) => d.id === id)?.name ?? 'backup storage';
  }

  protected async startChoosing(): Promise<void> {
    this.failure.set(null);
    await this.backup.loadDestinations();
    this.destinationId.set(this.backup.destinations()[0]?.id ?? '');
    this.choosing.set(true);
  }

  protected async protect(): Promise<void> {
    const destinationId = this.destinationId();
    if (!destinationId) return;
    this.working.set(true);
    this.failure.set(null);
    try {
      const res = await this.backup.protectCluster(this.clusterId(), {
        destinationId,
        beforeDeploy: this.beforeDeploy(),
        runFirstBackup: true,
      });
      this.view.set(res.protection);
      this.operationId.set(res.operationId);
      this.choosing.set(false);
    } catch (err: any) {
      this.failure.set(err?.error?.message ?? 'Could not start protecting the cluster');
    } finally {
      this.working.set(false);
    }
  }

  protected onSettled(): void {
    void this.reload();
  }

  protected closeStop(): void {
    if (!this.working()) this.confirmingStop.set(false);
  }

  protected async stop(): Promise<void> {
    this.working.set(true);
    this.failure.set(null);
    try {
      await this.backup.stopClusterProtection(this.clusterId());
      this.confirmingStop.set(false);
      await this.reload();
    } catch (err: any) {
      this.failure.set(err?.error?.message ?? 'Could not stop the protection');
    } finally {
      this.working.set(false);
    }
  }

  async reload(): Promise<void> {
    await this.load(this.clusterId());
    this.changed.emit();
  }

  private async load(id: string): Promise<void> {
    this.loadError.set(null);
    try {
      this.view.set(await this.backup.getClusterProtection(id));
    } catch (err: any) {
      this.loadError.set(err?.error?.message ?? 'Could not read how this cluster is protected');
    }
  }
}
