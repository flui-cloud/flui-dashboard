import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';
import { BackupService } from '../../service/backup.service';
import { AssistantOperationProgressComponent } from '../assistant/assistant-operation-progress.component';
import type { AppCoverageRow } from '../../service/fleet.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { decisionPanel } from './app-backup-decision';
import { BackupPolicyFacts, ProtectionPolicy } from './backup-policy-facts';
import { BackupProtectForm } from './backup-protect-form';
import { protectionState } from './backup-protection-state';

interface BeforeDeploy {
  enabled: boolean;
  required: boolean;
  takes: { restorePoint: boolean; dump: boolean; volumes: boolean };
  warning?: string;
}

export interface Protection {
  protectedOffCluster: boolean;
  policies: ProtectionPolicy[];
  beforeDeploy?: BeforeDeploy | null;
  coverage?: AppCoverageRow | null;
}

type BeforeDeployChoice = 'off' | 'on' | 'required';

/**
 * Whether this application is protected off the cluster, at the top of its
 * Backup tab: copies on the cluster go with the cluster, so they are not the
 * answer to "is this app protected".
 */
@Component({
  selector: 'app-backup-protection',
  imports: [
    FormsModule,
    AssistantOperationProgressComponent,
    FlPanel,
    BackupPolicyFacts,
    BackupProtectForm,
    FlAlert,
    FlField,
    FlStatus,
    FlButton,
  ],
  host: { class: 'block' },
  template: `
    @if (protection(); as p) {
      @if (ownHeader() || p.policies.length || choosing() || failure()) {
        <fl-panel
          [title]="ownHeader() ? 'Backup protection' : 'Backup policies'"
          data-testid="backup-protection"
        >
          <div panelActions class="fl-row">
            @if (copyPolicies()[0]; as pol) {
              <button
                flButton="primary"
                size="sm"
                type="button"
                [disabled]="backupBusy()"
                (click)="backUpNow(pol, false)"
              >
                {{ startingBackup() ? 'Starting…' : 'Back up now' }}
              </button>
            } @else if (canProtect()) {
              <button flButton="primary" size="sm" type="button" (click)="startProtect()">
                Protect this {{ database() ? 'database' : 'app' }}
              </button>
            }
          </div>
          <div class="flex flex-col gap-4">
            @if (ownHeader() && state(); as st) {
              <div class="flex flex-col gap-1">
                <fl-status [tone]="st.tone" [label]="st.label" />
                @if (st.detail) {
                  <p class="text-fl-body-sm text-fl-ink-muted">{{ st.detail }}</p>
                }
              </div>
            }

            @for (pol of p.policies; track pol.policyId; let first = $first) {
              <app-backup-policy-facts
                [policy]="pol"
                [backUpOffered]="isExtraCopy(pol)"
                [busy]="backupBusy()"
                [class.border-t]="!first || ownHeader()"
                [class.border-fl-border-subtle]="!first || ownHeader()"
                [class.pt-4]="!first || ownHeader()"
                (backUp)="backUpNow($event, false)"
              />
            }

            @if (needVolume() || (backupFailed() && backupPolicy())) {
              <div class="flex flex-wrap items-end gap-2">
                @if (needVolume()) {
                  <fl-field label="Volume" for="backup-volume-name">
                    <div class="fl-input">
                      <input
                        id="backup-volume-name"
                        class="fl-mono"
                        [ngModel]="volumeName()"
                        (ngModelChange)="volumeName.set($event)"
                        placeholder="Volume name"
                      />
                    </div>
                  </fl-field>
                }
                @if (backupFailed() && backupPolicy(); as pol) {
                  <button
                    flButton
                    size="sm"
                    type="button"
                    [disabled]="startingBackup()"
                    (click)="backUpNow(pol, true)"
                  >
                    Try again with the app stopped
                  </button>
                }
              </div>
            }
            @if (backupError(); as e) {
              <fl-alert tone="error" title="Backup did not start">{{ e }}</fl-alert>
            }

            @if (backupOp(); as op) {
              <app-assistant-operation-progress
                [operationId]="op"
                label="Backing up now"
                (settled)="onBackupSettled($event)"
              />
            }

            @if (p.policies.length && p.beforeDeploy; as bd) {
              <fl-field
                label="Backup before each deploy"
                for="before-deploy"
                hint="Required stops a deploy when the backup before it cannot be taken."
              >
                <span class="fl-select-wrap">
                  <select
                    id="before-deploy"
                    class="fl-select fl-select--sm"
                    [ngModel]="beforeDeployChoice(bd)"
                    (ngModelChange)="setBeforeDeploy($event)"
                    [disabled]="savingBeforeDeploy()"
                  >
                    <option value="off">Off</option>
                    <option value="on">On</option>
                    <option value="required">Required</option>
                  </select>
                </span>
              </fl-field>
              @if (bd.enabled && bd.warning) {
                <fl-alert tone="warning" title="Backup before deploy">{{ bd.warning }}</fl-alert>
              }
            }

            @if (choosing()) {
              <app-backup-protect-form
                [destinations]="backup.destinations()"
                [database]="database()"
                [postgres]="postgres()"
                [working]="working()"
                [(destinationId)]="destinationId"
                [(pause)]="pause"
                [(keepMonthly)]="keepMonthly"
                [(advanced)]="advanced"
                [(archiveMinutes)]="archiveMinutes"
                (submitted)="protect()"
                (cancelled)="choosing.set(false)"
              />
            }
            @if (failure()) {
              <fl-alert tone="error" title="Change not saved">{{ failure() }}</fl-alert>
            }
          </div>
        </fl-panel>
      }
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
  readonly loaded = output<Protection | null>();

  protected readonly protection = signal<Protection | null>(null);
  protected readonly ownHeader = computed(() => !decisionPanel(this.protection()));
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
  protected readonly backupPolicy = signal<ProtectionPolicy | null>(null);

  protected readonly state = computed(() => {
    const p = this.protection();
    return p ? protectionState(p, this.hasData(), this.database()) : null;
  });
  protected readonly copyPolicies = computed(() =>
    (this.protection()?.policies ?? []).filter(
      (pol) => pol.engineClass === 'volume_copy' && !!pol.destination,
    ),
  );
  protected readonly canProtect = computed(() => {
    const p = this.protection();
    return (
      !!p &&
      this.ownHeader() &&
      this.hasData() &&
      !p.protectedOffCluster &&
      !p.policies.length &&
      !this.choosing()
    );
  });
  protected readonly backupBusy = computed(
    () => (!!this.backupOp() && !this.backupFailed()) || this.startingBackup(),
  );

  protected isExtraCopy(pol: ProtectionPolicy): boolean {
    const list = this.copyPolicies();
    return list[0] !== pol && list.includes(pol);
  }

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
    this.backupPolicy.set(pol);
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

  async startProtect(): Promise<void> {
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
        this.http.post(this.database() ? `${base}/enable-database` : base, body),
      );
      this.choosing.set(false);
      await this.load(id);
    } catch (err: any) {
      this.failure.set(err?.error?.message ?? 'Could not set up the backup');
    } finally {
      this.working.set(false);
    }
  }

  reload(): void {
    const id = this.appId();
    if (id) void this.load(id);
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
    this.loaded.emit(this.protection());
  }
}
