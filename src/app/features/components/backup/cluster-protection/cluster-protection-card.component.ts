import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
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
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlField } from '../../../../ui/patterns/field';
import { FlTable } from '../../../../ui/patterns/table';
import { FlActionsMenu, MenuAction } from '../../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../../ui/overlays/confirm';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../../ui/primitives/status';
import { BackupService } from '../../../service/backup.service';
import {
  ClusterProtection,
  ProtectedApp,
  protectedAppLine,
} from '../../../model/backup-protection.models';
import { AssistantOperationProgressComponent } from '../../assistant/assistant-operation-progress.component';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';

const OUTCOME_TONE: Record<string, StatusTone> = {
  protected: 'success',
  already_protected: 'success',
  waiting: 'neutral',
  needs_decision: 'warning',
  failed: 'error',
  skipped: 'neutral',
};

const COLUMNS = 7;

const STOP_ACTIONS: readonly MenuAction[] = [
  { id: 'stop', label: 'Stop protecting new apps', danger: true },
];

/**
 * "Protect this cluster": every application on it gets a backup policy of its
 * own, the ones installed later too.
 */
@Component({
  selector: 'tbody[app-cluster-protection-card]',
  imports: [
    CdkTrapFocus,
    FormsModule,
    AssistantOperationProgressComponent,
    ReadOnlySectionDirective,
    FlAlert,
    FlField,
    FlTable,
    FlActionsMenu,
    FlButton,
    FlIcon,
    FlStatus,
  ],
  providers: [provideIcons({ lucideX })],
  host: { 'data-testid': 'cluster-protection' },
  template: `
    <tr>
      <td class="fl-cell-name border-t border-fl-border-subtle font-medium">
        {{ clusterName() || clusterId() }}
      </td>
      <td class="border-t border-fl-border-subtle">
        @if (view(); as v) {
          <fl-status [tone]="state().tone" [label]="state().label" />
        } @else if (loadError()) {
          <fl-status tone="error" label="Could not load" />
        } @else {
          <span class="text-fl-ink-muted">Loading…</span>
        }
      </td>
      <td class="border-t border-fl-border-subtle text-fl-ink-muted">
        @if (view()?.protected) {
          {{ destinationName(view()!.destinationId) }}
        } @else {
          —
        }
      </td>
      <td class="border-t border-fl-border-subtle text-fl-ink-muted">
        @if (view(); as v) {
          @if (v.protected) {
            @if (v.cronSchedule) {
              <span class="fl-mono">{{ v.cronSchedule }}</span> UTC
            } @else {
              Default schedule
            }
          } @else {
            —
          }
        }
      </td>
      <td class="border-t border-fl-border-subtle text-fl-ink-muted">
        @if (view()?.protected) {
          {{ view()!.beforeDeploy ? 'On' : 'Off' }}
        } @else {
          —
        }
      </td>
      <td class="is-num border-t border-fl-border-subtle">
        @if (view()?.applications?.length) {
          <button
            type="button"
            class="fl-link"
            [attr.aria-expanded]="showApps()"
            [attr.aria-label]="(showApps() ? 'Hide' : 'Show') + ' what each app got'"
            (click)="showApps.set(!showApps())"
          >
            {{ view()!.applications.length }}
          </button>
        } @else {
          <span class="text-fl-ink-muted">0</span>
        }
      </td>
      <td class="is-fit border-t border-fl-border-subtle">
        @if (view(); as v) {
          <div class="fl-row justify-end" appReadOnlySection="backup">
            @if (v.protected) {
              <fl-actions-menu
                [compact]="true"
                [label]="'Actions for ' + clusterName()"
                [items]="stopActions()"
                (action)="confirmStop()"
              />
            } @else if (!choosing() && !operationId()) {
              <button flButton size="sm" type="button" (click)="startChoosing()">
                Protect this cluster
              </button>
            }
          </div>
        }
      </td>
    </tr>

    @if (loadError(); as e) {
      <tr>
        <td [attr.colspan]="columns" class="whitespace-normal">
          <fl-alert tone="error" title="Could not read how this cluster is protected">{{
            e
          }}</fl-alert>
        </td>
      </tr>
    }

    @if (operationId(); as op) {
      <tr>
        <td [attr.colspan]="columns" class="whitespace-normal">
          <app-assistant-operation-progress
            [operationId]="op"
            label="Protecting every app on this cluster"
            (settled)="onSettled()"
          />
        </td>
      </tr>
    }

    @if (failure()) {
      <tr>
        <td [attr.colspan]="columns" class="whitespace-normal">
          <fl-alert tone="error" title="Change not saved">{{ failure() }}</fl-alert>
        </td>
      </tr>
    }

    @if (showApps() && view()?.applications?.length) {
      <tr>
        <td [attr.colspan]="columns" class="whitespace-normal">
          <div class="fl-table-wrap rounded-fl-md border border-fl-border">
            <table flTable density="dense" [attr.aria-label]="'Apps on ' + clusterName()">
              <thead>
                <tr>
                  <th scope="col">Application</th>
                  <th scope="col">What it got</th>
                </tr>
              </thead>
              <tbody>
                @for (a of apps(); track a.applicationId) {
                  <tr>
                    <td>{{ a.name ?? a.applicationId }}</td>
                    <td><fl-status [tone]="tone(a)" [label]="line(a)" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    }

    @if (choosing()) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (click)="choosing.set(false)"
        (keydown.escape)="choosing.set(false)"
      >
        <div
          class="fl-dialog"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'protect-title-' + clusterId()"
          (click)="$event.stopPropagation()"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" [id]="'protect-title-' + clusterId()">
              Protect {{ clusterName() }}
            </h2>
            <button
              type="button"
              class="fl-dialog__close"
              aria-label="Close"
              (click)="choosing.set(false)"
            >
              <fl-icon name="lucideX" />
            </button>
          </header>
          <div class="fl-dialog__body">
            <p>Each app gets its own backup, new apps included.</p>
            @if (backup.destinations().length) {
              <fl-field label="Backup storage" [for]="'protect-destination-' + clusterId()">
                <span class="fl-select-wrap">
                  <select
                    class="fl-select"
                    [id]="'protect-destination-' + clusterId()"
                    [ngModel]="destinationId()"
                    (ngModelChange)="destinationId.set($event)"
                  >
                    @for (d of backup.destinations(); track d.id) {
                      <option [value]="d.id">{{ d.name }}</option>
                    }
                  </select>
                </span>
              </fl-field>
            } @else {
              <fl-alert tone="info" title="No backup storage yet">
                Use Enable backups on this page, or add a destination.
              </fl-alert>
            }
            <label class="fl-check">
              <input
                type="checkbox"
                [ngModel]="beforeDeploy()"
                (ngModelChange)="beforeDeploy.set($event)"
              />
              <span>Back up before each deploy</span>
            </label>
          </div>
          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" (click)="choosing.set(false)">Cancel</button>
            <button
              flButton="primary"
              type="button"
              [disabled]="!destinationId() || working()"
              (click)="protect()"
            >
              {{ working() ? 'Starting…' : 'Protect' }}
            </button>
          </footer>
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
  readonly loaded = output<ClusterProtection>();

  private readonly confirm = inject(ConfirmService);
  protected readonly columns = COLUMNS;

  protected readonly view = signal<ClusterProtection | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);
  protected readonly choosing = signal(false);
  protected readonly working = signal(false);
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

  protected readonly state = computed<{ tone: StatusTone; label: string }>(() => {
    const v = this.view();
    if (!v?.protected) return { tone: 'neutral', label: 'Not configured' };
    if (v.needsDecision.length) return { tone: 'warning', label: 'Needs a decision' };
    return { tone: 'success', label: 'Protected' };
  });

  protected readonly stopActions = computed<readonly MenuAction[]>(() =>
    STOP_ACTIONS.map((a) => ({ ...a, disabled: !!this.operationId() || this.working() })),
  );

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

  protected tone(app: ProtectedApp): StatusTone {
    return OUTCOME_TONE[app.outcome] ?? 'neutral';
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
      this.loaded.emit(res.protection);
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

  protected async confirmStop(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Stop protecting new apps?',
      body: `Apps installed on ${this.clusterName()} from now on get no backup unless someone adds one. The backups already set up keep running.`,
      confirmLabel: 'Stop',
      destructive: true,
    });
    if (ok) await this.stop();
  }

  protected async stop(): Promise<void> {
    this.working.set(true);
    this.failure.set(null);
    try {
      await this.backup.stopClusterProtection(this.clusterId());
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
      const protection = await this.backup.getClusterProtection(id);
      this.view.set(protection);
      this.loaded.emit(protection);
    } catch (err: any) {
      this.loadError.set(err?.error?.message ?? 'Could not read how this cluster is protected');
    }
  }
}
