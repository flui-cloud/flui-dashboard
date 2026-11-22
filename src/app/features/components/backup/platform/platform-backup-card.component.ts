import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlField } from '../../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { FlButton } from '../../../../ui/primitives/button';
import { FlStatus } from '../../../../ui/primitives/status';
import { BackupHealthBadgeComponent } from '../shared/health-badge.component';
import { BackupRunsTableComponent } from '../shared/runs-table.component';
import { BackupProgressModalComponent } from '../shared/progress-modal.component';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';
import { ToastService } from '../../../../shared/services/toast.service';
import { BackupService } from '../../../service/backup.service';
import { BackupPolicyActivity } from '../../../model/backup-run.models';
import {
  formatLocalDateTime,
  formatRelativeTime,
  formatUtcDateTime,
} from '../../../model/backup-activity';
import {
  PlatformBackupJob,
  PlatformBackupPolicy,
  PlatformBackupService,
  PlatformHeartbeatStatus,
} from '../../../service/platform-backup.service';

const INSECURE_SSH_KEY = 'SSH_KEY_ENCRYPTION_KEY';
const RECENT_RUNS = 5;

@Component({
  selector: 'app-platform-backup-card',
  imports: [
    FormsModule,
    RouterLink,
    ReadOnlySectionDirective,
    FlPanel,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlStatus,
    BackupHealthBadgeComponent,
    BackupRunsTableComponent,
    BackupProgressModalComponent,
  ],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Flui itself">
      @if (policy()) {
        <button
          panelActions
          flButton
          size="sm"
          type="button"
          appReadOnlySection="backup"
          [disabled]="!hasRecipient() || running() || !!activeOpId()"
          (click)="backUpNow()"
        >
          {{ running() ? 'Starting…' : 'Back up now' }}
        </button>
      }
      <div class="flex flex-col gap-4">
        <p class="text-fl-body-sm text-fl-ink-muted">
          The Flui database and its key material, copied off the provider and sealed to a recipient
          you hold, so Flui can be rebuilt on another provider.
        </p>

        @if (loading()) {
          <fl-loading-state [rows]="3" />
        } @else if (!policy()) {
          <fl-empty-state
            title="Platform backup not set up"
            body="Set it up from the CLI: the key that opens these backups is created on your own machine and kept in your vault, never on a server."
            [compact]="true"
          >
            <div class="flex flex-col items-center gap-1.5">
              <code
                class="fl-mono rounded-fl-md border border-fl-border bg-fl-surface-subtle px-2 py-1"
                >flui backup platform init</code
              >
              <code
                class="fl-mono rounded-fl-md border border-fl-border bg-fl-surface-subtle px-2 py-1"
                >flui backup enable platform -D &lt;destination-id&gt;</code
              >
            </div>
          </fl-empty-state>
        } @else {
          @if (!hasRecipient()) {
            <fl-alert tone="error" title="No operator recipient: platform backup cannot run">
              Set it from the CLI with <code class="fl-mono">flui backup platform init</code>.
            </fl-alert>
          }
          @if (sshKeyInsecure()) {
            <fl-alert tone="error" title="Insecure default: SSH key encryption key">
              <code class="fl-mono">{{ insecureSshKey }}</code> is still a built-in default. Anyone
              holding the platform backup can decrypt SSH key material. Rotate it before relying on
              this recovery path.
            </fl-alert>
          }
          @if (zitadelKnown() && !zitadelCovered()) {
            <fl-alert tone="warning" title="Identity data not covered">
              Zitadel starts fresh on a rebuild.
            </fl-alert>
          }

          <fl-key-value>
            <fl-kv-item key="Health">
              @if (activity(); as a) {
                <app-backup-health-badge [state]="a.health.state" [detail]="a.health.detail" />
                @if (a.health.detail) {
                  <span class="block text-fl-body-sm text-fl-ink-muted">{{ a.health.detail }}</span>
                }
              } @else {
                <span class="text-fl-ink-muted">—</span>
              }
            </fl-kv-item>
            <fl-kv-item key="Schedule">
              @if (activity(); as a) {
                <span class="block">{{ a.schedule.description }}</span>
                @if (a.schedule.nextRunAt) {
                  <span
                    class="block text-fl-body-sm text-fl-ink-muted"
                    [attr.title]="utc(a.schedule.nextRunAt)"
                  >
                    Next {{ relative(a.schedule.nextRunAt) }}, {{ local(a.schedule.nextRunAt) }}
                  </span>
                }
              } @else {
                <span class="fl-mono">{{ policy()?.cronSchedule || '—' }}</span>
              }
            </fl-kv-item>
            <fl-kv-item key="Operator recipient">
              @if (hasRecipient()) {
                <fl-status tone="success" label="Configured" />
                <span class="block fl-mono text-fl-ink-muted">{{ recipientPrefix() }}…</span>
              } @else {
                <fl-status tone="error" label="Not configured" />
              }
            </fl-kv-item>
            <fl-kv-item key="Dead-man's switch" data-testid="platform-heartbeat">
              @if (!heartbeatConfigured()) {
                <fl-status tone="neutral" label="Not configured" />
              } @else if (heartbeatStatus(); as h) {
                @switch (h.state) {
                  @case ('beating') {
                    <fl-status
                      tone="success"
                      [label]="'Sending' + (h.lastBeatAt ? ', last ' + relative(h.lastBeatAt) : '')"
                    />
                  }
                  @case ('withheld') {
                    <fl-status tone="error" label="Withheld: your watchdog will raise the alarm" />
                  }
                  @case ('failing') {
                    <fl-status tone="error" label="Not delivered" />
                  }
                  @default {
                    <span>Heartbeat URL configured</span>
                  }
                }
                @for (reason of h.reasons; track reason) {
                  <span
                    class="block text-fl-body-sm text-fl-ink-muted"
                    data-testid="platform-heartbeat-reason"
                    >{{ reason }}</span
                  >
                }
              } @else {
                <span>Heartbeat URL configured</span>
              }
            </fl-kv-item>
            @if (zitadelKnown()) {
              <fl-kv-item key="Identity data (Zitadel)">
                @if (zitadelCovered()) {
                  <fl-status tone="success" label="Covered" />
                } @else {
                  <fl-status tone="warning" label="Not covered" />
                }
              </fl-kv-item>
            }
          </fl-key-value>
        }

        @if (error()) {
          <fl-alert tone="error" title="Platform backup">{{ error() }}</fl-alert>
        }
      </div>
    </fl-panel>

    @if (!loading() && policy()) {
      <fl-panel title="Recent platform runs" [flush]="true">
        @if (activity(); as a) {
          <a
            panelActions
            class="fl-link text-fl-body-sm"
            [routerLink]="['/management/backup/policies', a.policyId]"
            >View all runs</a
          >
        }
        @if (activity(); as a) {
          @if (a.runs.length) {
            <app-backup-runs-table [runs]="a.runs" [compact]="true" [limit]="recentRuns" />
          } @else {
            <fl-empty-state title="No runs yet" [compact]="true" />
          }
        } @else if (activityError()) {
          <fl-empty-state title="Run history unavailable" [compact]="true" />
        } @else {
          <fl-loading-state [rows]="2" />
        }
      </fl-panel>

      <fl-panel title="Dead-man's switch">
        <div class="flex flex-col gap-3">
          <fl-field
            label="Heartbeat URL"
            for="platform-heartbeat-url"
            [hint]="
              hasRecipient()
                ? 'Called every 5 minutes while the installation is healthy and its last backup is fresh. Point it at your watchdog, for example a healthchecks.io check. Keep it private.'
                : 'Configure the operator recipient with the CLI first.'
            "
          >
            <div class="flex flex-col gap-2 sm:flex-row">
              <div class="fl-input fl-input--lg min-w-0 flex-1">
                <input
                  id="platform-heartbeat-url"
                  type="url"
                  [(ngModel)]="heartbeatUrlInput"
                  [disabled]="!hasRecipient() || saving()"
                  [placeholder]="
                    heartbeatConfigured() ? 'Paste a new address to replace it' : 'https://…'
                  "
                />
              </div>
              <button
                flButton
                type="button"
                [disabled]="!hasRecipient() || saving() || !heartbeatUrlInput.trim()"
                (click)="saveHeartbeat()"
                data-testid="platform-heartbeat-save"
              >
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
              @if (heartbeatConfigured()) {
                <button
                  flButton="ghost"
                  type="button"
                  [disabled]="saving()"
                  (click)="stopHeartbeat()"
                  data-testid="platform-heartbeat-stop"
                >
                  Stop
                </button>
              }
            </div>
          </fl-field>
          @if (heartbeatHost(); as host) {
            <p class="text-fl-body-sm" data-testid="platform-heartbeat-set">
              Set, sending to {{ host }}
            </p>
          }
          <p class="text-fl-body-sm text-fl-ink-muted">
            The operator recipient (<code class="fl-mono">age1…</code>) is set with
            <code class="fl-mono">flui backup platform init</code>. The matching private key stays
            in the operator's vault on their own machine: the master can never decrypt its own
            backup, so it is never generated in the browser.
          </p>
        </div>
      </fl-panel>
    }

    <app-backup-progress-modal
      [operationId]="activeOpId()"
      title="Backing up the platform"
      (closed)="onProgressClosed()"
    />
  `,
})
export class PlatformBackupCardComponent implements OnInit {
  private readonly service = inject(PlatformBackupService);
  private readonly toast = inject(ToastService);
  private readonly backup = inject(BackupService);

  protected readonly insecureSshKey = INSECURE_SSH_KEY;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly policy = signal<PlatformBackupPolicy | null>(null);
  protected readonly lastJob = signal<PlatformBackupJob | null>(null);
  protected readonly activity = signal<BackupPolicyActivity | null>(null);
  protected readonly heartbeatStatus = signal<PlatformHeartbeatStatus | null>(null);
  protected readonly activityError = signal(false);
  protected readonly running = signal(false);
  protected readonly activeOpId = signal<string | null>(null);
  protected readonly recentRuns = RECENT_RUNS;

  protected readonly relative = (iso: string) => formatRelativeTime(iso);
  protected readonly local = formatLocalDateTime;
  protected readonly utc = formatUtcDateTime;

  protected heartbeatUrlInput = '';

  protected readonly recipient = computed(
    () => this.policy()?.metadata?.platform?.recipient ?? null,
  );
  protected readonly hasRecipient = computed(() => !!this.recipient());
  protected readonly recipientPrefix = computed(() => this.recipient()?.slice(0, 18) ?? '');
  protected readonly heartbeatHost = computed(
    () => this.policy()?.metadata?.platform?.heartbeat?.host ?? null,
  );
  protected readonly heartbeatConfigured = computed(
    () => !!this.policy()?.metadata?.platform?.heartbeat?.set,
  );

  protected readonly zitadelCovered = computed(
    () => this.lastJob()?.metadata?.zitadelCovered === true,
  );
  protected readonly zitadelKnown = computed(
    () => typeof this.lastJob()?.metadata?.zitadelCovered === 'boolean',
  );
  protected readonly sshKeyInsecure = computed(
    () => this.lastJob()?.metadata?.insecureDefaults?.includes(INSECURE_SSH_KEY) ?? false,
  );

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const policies = await this.service.listPlatformPolicies();
      const policy = policies[0] ?? null;
      this.policy.set(policy);
      if (policy) {
        const [lastJob] = await Promise.all([
          this.service.lastPlatformJob([policy.id]),
          this.loadActivity(policy.id),
          this.service
            .heartbeatStatus()
            .then((h) => this.heartbeatStatus.set(h))
            .catch(() => this.heartbeatStatus.set(null)),
        ]);
        this.lastJob.set(lastJob);
      }
    } catch (err: unknown) {
      this.error.set(this.errorMessage(err, 'Failed to load platform backup status'));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadActivity(policyId: string): Promise<void> {
    this.activityError.set(false);
    try {
      this.activity.set(await this.backup.getPolicyActivity(policyId, RECENT_RUNS));
    } catch {
      this.activityError.set(true);
    }
  }

  protected async backUpNow(): Promise<void> {
    const policy = this.policy();
    if (!policy) return;
    this.running.set(true);
    const result = await this.backup.runOnDemand(policy.id);
    this.running.set(false);
    if (result?.operationId) this.activeOpId.set(result.operationId);
    else if (result) void this.loadActivity(policy.id);
    else this.toast.showError(this.backup.error() ?? 'Could not start the backup');
  }

  protected onProgressClosed(): void {
    this.activeOpId.set(null);
    const policy = this.policy();
    if (!policy) return;
    void this.loadActivity(policy.id);
    void this.service.lastPlatformJob([policy.id]).then((job) => this.lastJob.set(job));
  }

  protected async saveHeartbeat(): Promise<void> {
    const url = this.heartbeatUrlInput.trim();
    if (!url) return;
    await this.writeHeartbeat({ heartbeatUrl: url }, 'Heartbeat set');
  }

  protected async stopHeartbeat(): Promise<void> {
    await this.writeHeartbeat({ clearHeartbeat: true }, 'Heartbeat stopped');
  }

  private async writeHeartbeat(
    change: { heartbeatUrl?: string; clearHeartbeat?: boolean },
    done: string,
  ): Promise<void> {
    const policy = this.policy();
    const recipient = this.recipient();
    if (!policy || !recipient) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      this.policy.set(await this.service.setPlatformConfig(policy.id, { recipient, ...change }));
      this.heartbeatUrlInput = '';
      this.toast.showSuccess(done);
      this.heartbeatStatus.set(await this.service.heartbeatStatus().catch(() => null));
    } catch (err: unknown) {
      const message = this.errorMessage(err, 'Failed to update the heartbeat');
      this.error.set(message);
      this.toast.showError(message);
    } finally {
      this.saving.set(false);
    }
  }

  private errorMessage(err: unknown, fallback: string): string {
    if (typeof err === 'object' && err !== null) {
      const e = err as { error?: { message?: string }; message?: string };
      return e.error?.message ?? e.message ?? fallback;
    }
    return fallback;
  }
}
