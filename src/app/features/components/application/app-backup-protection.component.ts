import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';
import { BackupService } from '../../service/backup.service';
import { AssistantOperationProgressComponent } from '../assistant/assistant-operation-progress.component';

interface ProtectionPolicy {
  policyId: string;
  name: string;
  engineClass: string;
  engine?: string | null;
  schedule: string | null;
  enabled: boolean;
  status: string;
  destination: { id: string; name: string; provider: string } | null;
  lastRun: { status: string; at: string | null; error: string | null } | null;
  nextRunAt: string | null;
}

interface BeforeDeploy {
  enabled: boolean;
  required: boolean;
  takes: { restorePoint: boolean; dump: boolean; volumes: boolean };
  warning?: string;
}

interface Protection {
  protectedOffCluster: boolean;
  policies: ProtectionPolicy[];
  beforeDeploy?: BeforeDeploy | null;
}

type BeforeDeployChoice = 'off' | 'on' | 'required';

/**
 * Whether this application is protected off the cluster, at the top of its
 * Backup tab: copies on the cluster go with the cluster, so they are not the
 * answer to "is this app protected".
 */
@Component({
  selector: 'app-backup-protection',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, AssistantOperationProgressComponent],
  template: `
    @if (protection(); as p) {
      <section
        class="card-surface p-4 space-y-3"
        data-testid="backup-protection"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">
              @if (!hasData()) {
                Nothing to protect
              } @else if (p.protectedOffCluster) {
                Protected off the cluster
              } @else {
                Not protected off the cluster
              }
            </h2>
            @if (!hasData()) {
              <p class="text-sm text-muted-foreground mt-0.5">
                This application keeps no data of its own: redeploying it brings
                it back as it was.
              </p>
            } @else if (!p.protectedOffCluster) {
              <p class="text-sm text-muted-foreground mt-0.5">
                @if (p.policies.length) {
                  Its backups did not reach backup storage — see why below. If
                  the cluster is lost, so is its data.
                } @else {
                  Nothing of this {{ database() ? 'database' : 'application' }}
                  is copied to backup storage. If the cluster is lost, so is its
                  data.
                }
              </p>
            }
          </div>
          @if (
            hasData() &&
            !p.protectedOffCluster &&
            !p.policies.length &&
            !choosing()
          ) {
            <button
              (click)="startProtect()"
              class="shrink-0 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Protect this {{ database() ? 'database' : 'app' }}
            </button>
          }
        </div>

        @for (pol of p.policies; track pol.policyId) {
          <div class="rounded-md border border-border px-3 py-2 text-sm">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-medium">{{ kindLabel(pol.engineClass, pol.engine) }}</span>
              <span
                class="text-xs"
                [class]="
                  pol.enabled ? 'text-muted-foreground' : 'text-amber-600'
                "
              >
                {{
                  pol.enabled
                    ? pol.schedule
                      ? 'on a schedule (' + pol.schedule + ')'
                      : 'on'
                    : 'stopped'
                }}
              </span>
            </div>
            <div class="text-xs text-muted-foreground mt-1">
              To {{ pol.destination?.name ?? 'an unknown destination' }}
              @if (pol.lastRun; as r) {
                · last run {{ r.status.replace('_', ' ')
                }}{{ r.at ? ' at ' + r.at.slice(0, 16).replace('T', ' ') : '' }}
              } @else {
                · no run yet
              }
              @if (pol.nextRunAt) {
                · next {{ pol.nextRunAt.slice(0, 16).replace('T', ' ') }}
              }
            </div>
            @if (pol.lastRun?.error) {
              <div class="text-xs text-red-600 mt-1">
                {{ pol.lastRun?.error }}
              </div>
            }
            @if (pol.engineClass === 'volume_copy' && pol.destination) {
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <button
                  (click)="backUpNow(pol, false)"
                  [disabled]="(!!backupOp() && !backupFailed()) || startingBackup()"
                  class="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-50"
                >
                  {{ startingBackup() ? 'Starting…' : 'Back up now' }}
                </button>
                @if (needVolume()) {
                  <input
                    [ngModel]="volumeName()"
                    (ngModelChange)="volumeName.set($event)"
                    placeholder="volume name"
                    class="h-7 w-44 px-2 rounded-md border border-input bg-background text-xs font-mono"
                  />
                }
                @if (backupFailed()) {
                  <button
                    (click)="backUpNow(pol, true)"
                    [disabled]="startingBackup()"
                    class="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-50"
                  >
                    Try again with the app stopped
                  </button>
                }
              </div>
              @if (backupError(); as e) {
                <div class="text-xs text-red-600 mt-1">{{ e }}</div>
              }
            }
          </div>
        }

        @if (backupOp(); as op) {
          <app-assistant-operation-progress
            [operationId]="op"
            label="Backing up now"
            (settled)="onBackupSettled($event)"
          />
        }

        @if (p.policies.length && p.beforeDeploy; as bd) {
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <label for="before-deploy" class="text-muted-foreground">
              Backup before each deploy
            </label>
            <select
              id="before-deploy"
              [ngModel]="beforeDeployChoice(bd)"
              (ngModelChange)="setBeforeDeploy($event)"
              [disabled]="savingBeforeDeploy()"
              class="h-8 px-2 rounded-md border border-input bg-background text-sm"
              title="Required: a deploy stops if the backup before it cannot be taken"
            >
              <option value="off">Off</option>
              <option value="on">On</option>
              <option value="required">Required</option>
            </select>
            @if (bd.enabled && bd.warning) {
              <span class="text-xs text-amber-600">{{ bd.warning }}</span>
            }
          </div>
        }

        @if (choosing()) {
          <div class="flex flex-wrap items-end gap-2">
            <label class="block text-sm">
              <span class="text-xs text-muted-foreground">Backup storage</span>
              <select
                [ngModel]="destinationId()"
                (ngModelChange)="destinationId.set($event)"
                class="mt-1 block h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                @for (d of backup.destinations(); track d.id) {
                  <option [value]="d.id">{{ d.name }}</option>
                }
              </select>
            </label>
            @if (!database()) {
              <label class="flex items-center gap-2 text-sm h-9">
                <input
                  type="checkbox"
                  [ngModel]="pause()"
                  (ngModelChange)="pause.set($event)"
                />
                Stop the app during each copy
              </label>
              <label
                class="flex items-center gap-2 text-sm h-9"
                title="Two more months of history on top of 7 daily and 4 weekly snapshots"
              >
                <input
                  type="checkbox"
                  [ngModel]="keepMonthly()"
                  (ngModelChange)="keepMonthly.set($event)"
                />
                Keep 3 monthly snapshots (+~30% space)
              </label>
            } @else if (postgres() && advanced()) {
              <label class="block text-sm">
                <span class="text-xs text-muted-foreground"
                  >Max minutes between log closes</span
                >
                <input
                  type="number"
                  min="1"
                  max="60"
                  [ngModel]="archiveMinutes()"
                  (ngModelChange)="archiveMinutes.set($event)"
                  class="mt-1 block h-9 w-24 px-3 rounded-md border border-input bg-background text-sm"
                  title="Lower loses less data if the volume is lost; higher uses less storage"
                />
              </label>
            } @else if (postgres()) {
              <button
                (click)="advanced.set(true)"
                class="h-9 px-2 text-xs text-muted-foreground hover:underline"
              >
                Advanced
              </button>
            }
            <button
              (click)="protect()"
              [disabled]="!destinationId() || working()"
              class="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {{
                working()
                  ? 'Setting up…'
                  : database()
                    ? 'Start backups'
                    : 'Copy every night'
              }}
            </button>
            <button
              (click)="choosing.set(false)"
              class="px-3 py-1.5 text-sm rounded-md hover:bg-muted"
            >
              Cancel
            </button>
          </div>
          @if (!backup.destinations().length) {
            <p class="text-xs text-muted-foreground">
              No backup storage yet: add one under Management → Backup →
              Destinations.
            </p>
          }
        }
        @if (failure()) {
          <p class="text-sm text-red-600">{{ failure() }}</p>
        }
      </section>
    }
  `,
})
export class AppBackupProtectionComponent {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  protected readonly backup = inject(BackupService);

  readonly appId = input<string | null>(null);
  readonly appSlug = input<string>('');
  readonly clusterId = input<string>('');
  readonly database = input(false);
  /** Continuous Postgres: the only engine whose log-close interval can be set. */
  readonly postgres = input(false);
  /** False for an application with no volume: there is nothing to copy. */
  readonly hasData = input(true);
  /** A backup taken from here finished. */
  readonly backedUp = output<void>();

  protected readonly protection = signal<Protection | null>(null);
  protected readonly choosing = signal(false);
  protected readonly working = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly destinationId = signal('');
  protected readonly pause = signal(false);
  protected readonly keepMonthly = signal(false);
  protected readonly advanced = signal(false);
  protected readonly archiveMinutes = signal(5);
  protected readonly backupOp = signal<string | null>(null);
  protected readonly startingBackup = signal(false);
  protected readonly backupError = signal<string | null>(null);
  protected readonly backupFailed = signal(false);
  protected readonly needVolume = signal(false);
  protected readonly volumeName = signal('');
  protected readonly savingBeforeDeploy = signal(false);

  private policyOptions(): Record<string, boolean | number> | null {
    const options: Record<string, boolean | number> = {};
    if (this.database()) {
      if (!this.postgres()) return null;
      const minutes = Math.round(Number(this.archiveMinutes()));
      if (this.advanced() && Number.isFinite(minutes) && minutes !== 5) {
        options['archiveTimeoutSeconds'] = Math.min(60, Math.max(1, minutes)) * 60;
      }
    } else {
      if (this.pause()) options['pauseDuringCopy'] = true;
      if (this.keepMonthly()) options['keepMonthly'] = true;
    }
    return Object.keys(options).length ? options : null;
  }

  constructor() {
    effect(() => {
      const id = this.appId();
      this.backupOp.set(null);
      this.backupError.set(null);
      this.backupFailed.set(false);
      this.needVolume.set(false);
      this.volumeName.set('');
      if (id) void this.load(id);
    });
  }

  protected beforeDeployChoice(bd: BeforeDeploy): BeforeDeployChoice {
    if (!bd.enabled) return 'off';
    return bd.required ? 'required' : 'on';
  }

  protected async setBeforeDeploy(choice: BeforeDeployChoice): Promise<void> {
    const id = this.appId();
    if (!id) return;
    this.savingBeforeDeploy.set(true);
    this.failure.set(null);
    try {
      const beforeDeploy = await firstValueFrom(
        this.http.put<BeforeDeploy>(
          `${this.config.apiBaseUrl}/api/v1/applications/${encodeURIComponent(id)}/backup-before-deploy`,
          { enabled: choice !== 'off', required: choice === 'required' },
        ),
      );
      this.protection.update((p) => (p ? { ...p, beforeDeploy } : p));
    } catch (err: any) {
      this.failure.set(err?.error?.message ?? 'Could not change the backup before deploys');
    } finally {
      this.savingBeforeDeploy.set(false);
    }
  }

  protected async backUpNow(pol: ProtectionPolicy, pause: boolean): Promise<void> {
    const id = this.appId();
    const destinationId = pol.destination?.id;
    if (!id || !destinationId) return;
    this.startingBackup.set(true);
    this.backupOp.set(null);
    this.backupError.set(null);
    this.backupFailed.set(false);
    const volumeName = this.volumeName().trim();
    try {
      const res = await firstValueFrom(
        this.http.post<{ operationId: string }>(
          `${this.config.apiBaseUrl}/api/v1/applications/${encodeURIComponent(id)}/backups`,
          {
            destinationId,
            ...(volumeName ? { volumeName } : {}),
            ...(pause ? { pause: true } : {}),
          },
        ),
      );
      this.backupOp.set(res.operationId);
    } catch (err: any) {
      const message: string = err?.error?.message ?? 'Could not start the backup';
      if (/multiple volumes/i.test(message)) this.needVolume.set(true);
      this.backupError.set(message);
    } finally {
      this.startingBackup.set(false);
    }
  }

  protected onBackupSettled(status: string): void {
    this.backupFailed.set(status !== 'COMPLETED');
    if (status === 'COMPLETED') {
      this.backupOp.set(null);
      this.backedUp.emit();
      const id = this.appId();
      if (id) void this.load(id);
    }
  }

  protected kindLabel(engineClass: string, engine?: string | null): string {
    if (engineClass === 'database') {
      return engine?.endsWith('-dump') ? 'Scheduled dumps' : 'Continuous backup';
    }
    if (engineClass === 'volume_copy') return 'Volume copies to backup storage';
    return 'Backup';
  }

  protected async startProtect(): Promise<void> {
    this.failure.set(null);
    await this.backup.loadDestinations();
    this.destinationId.set(this.backup.destinations()[0]?.id ?? '');
    this.choosing.set(true);
  }

  protected async protect(): Promise<void> {
    const id = this.appId();
    if (!id) return;
    this.working.set(true);
    this.failure.set(null);
    const base = `${this.config.apiBaseUrl}/api/v1/backup-policies`;
    const body = {
      name: `${this.appSlug()}-${this.database() ? 'continuous' : 'volumes'}`,
      clusterId: this.clusterId(),
      engineClass: this.database() ? 'database' : 'volume_copy',
      scope: 'applications',
      scopeSelector: { applicationIds: [id] },
      ...(this.policyOptions() ? { metadata: this.policyOptions() } : {}),
      retentionDays: 30,
      enabled: true,
      destinations: [{ destinationId: this.destinationId(), role: 'primary' }],
      profile: 'single',
    };
    try {
      await firstValueFrom(
        this.http.post(
          this.database() ? `${base}/enable-database` : base,
          body,
        ),
      );
      this.choosing.set(false);
      await this.load(id);
    } catch (err: any) {
      this.failure.set(err?.error?.message ?? 'Could not set up the backup');
    } finally {
      this.working.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    try {
      this.protection.set(
        await firstValueFrom(
          this.http.get<Protection>(
            `${this.config.apiBaseUrl}/api/v1/applications/${encodeURIComponent(id)}/backup-protection`,
          ),
        ),
      );
    } catch {
      this.protection.set(null);
    }
  }
}
