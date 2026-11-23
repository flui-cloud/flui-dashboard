import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlField } from '../../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlLoadingState } from '../../../../ui/patterns/states';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlStatus } from '../../../../ui/primitives/status';
import { BackupService } from '../../../service/backup.service';
import { providerLabel } from '../../../model/backup.models';
import {
  ProviderReadiness,
  SetupOptions,
  centsToEur,
  providerReadinessMessage,
} from '../../../model/backup-status.models';
import { QuickSetupDto } from '../../../../core/api/model/quickSetupDto';
import { BackupProgressModalComponent } from '../shared/progress-modal.component';

type Step = 'loading' | 'connect_primary' | 'choose' | 'running' | 'done' | 'error';

@Component({
  selector: 'app-enable-backups-modal',
  imports: [
    CdkTrapFocus,
    FormsModule,
    RouterLink,
    BackupProgressModalComponent,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlStatus,
  ],
  providers: [provideIcons({ lucideX })],
  template: `
    @if (open()) {
      <div
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="onClose()"
      >
        <div
          class="fl-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enable-backups-title"
        >
          <header class="fl-dialog__header">
            <h2 class="fl-dialog__title" id="enable-backups-title">Enable backups</h2>
            <button type="button" class="fl-dialog__close" aria-label="Close" (click)="onClose()">
              <fl-icon name="lucideX" />
            </button>
          </header>

          <div class="fl-dialog__body">
            @switch (step()) {
              @case ('loading') {
                <fl-loading-state [rows]="3" />
              }

              @case ('connect_primary') {
                <fl-alert tone="warning" title="Storage provider required">{{
                  readinessMessage()
                }}</fl-alert>
                <p class="text-fl-body-sm text-fl-ink-muted">
                  Configure Scaleway from the Providers page, then come back to enable backups.
                </p>
              }

              @case ('choose') {
                @if (options(); as opts) {
                  <p class="text-fl-body-sm text-fl-ink-muted">
                    Your data stays in the EU, where you choose.
                  </p>
                  @if (!opts.primary.ready) {
                    <fl-alert tone="warning" title="Storage provider not ready">
                      {{ readinessMessage() }}
                      <a alertActions class="fl-link" routerLink="/management/providers"
                        >Open providers</a
                      >
                    </fl-alert>
                  }

                  <fl-key-value class="fl-kv--compact">
                    <fl-kv-item key="Storage provider">
                      @if ((opts.eligible?.length ?? 0) > 1) {
                        <span class="fl-select-wrap">
                          <select
                            class="fl-select fl-select--sm"
                            name="primaryProvider"
                            aria-label="Storage provider"
                            [ngModel]="chosenProvider() ?? opts.primary.provider"
                            (ngModelChange)="chosenProvider.set($event)"
                          >
                            @for (c of opts.eligible; track c.provider) {
                              <option [value]="c.provider" [disabled]="!c.ready">
                                {{ providerLabel(c.provider)
                                }}{{ c.ready ? '' : ', not connected' }}
                              </option>
                            }
                          </select>
                        </span>
                      } @else {
                        {{ providerLabel(opts.primary.provider) }}
                      }
                    </fl-kv-item>
                    <fl-kv-item key="Estimated data">
                      @if (opts.estimate.estimatedDataGb != null) {
                        ~{{ opts.estimate.estimatedDataGb }} GB
                      } @else {
                        <span class="text-fl-ink-muted">Unavailable</span>
                      }
                    </fl-kv-item>
                    <fl-kv-item key="Backup storage per month">
                      @if (opts.estimate.backupMonthlyCentsBy.single != null) {
                        <span [title]="opts.estimate.backupPricingSource || ''">{{
                          centsToEur(opts.estimate.backupMonthlyCentsBy.single)
                        }}</span>
                      } @else {
                        <span
                          class="text-fl-ink-muted"
                          [title]="opts.estimate.backupUnavailableReason || ''"
                          >Cost unavailable</span
                        >
                      }
                    </fl-kv-item>
                    <fl-kv-item key="Cluster and backup per month">
                      @if (totalEstimate(); as t) {
                        <span class="font-semibold">{{ t }}</span>
                      } @else {
                        <span class="text-fl-ink-muted">Cost unavailable</span>
                      }
                    </fl-kv-item>
                  </fl-key-value>

                  @if (opts.estimate.backupScope; as scope) {
                    <details class="rounded-fl-md border border-fl-border text-fl-body-sm">
                      <summary class="cursor-pointer px-3 py-2 text-fl-ink-secondary">
                        What a backup includes
                      </summary>
                      <div class="flex flex-col gap-2 px-3 pb-3 pt-1">
                        @if (scope.persistentVolumes === 'per-application') {
                          <ul class="ml-4 list-disc">
                            <li>Each app gets its own backup, new apps included</li>
                            <li>Databases: continuous backup, or nightly dumps</li>
                            <li>Other volumes: encrypted snapshots, 7 daily and 4 weekly</li>
                          </ul>
                          <p class="text-fl-ink-muted">
                            Databases Flui does not recognise are listed as needing a decision
                            instead of being copied while they write.
                          </p>
                        } @else {
                          <p class="text-fl-ink-muted">{{ scope.notes }}</p>
                        }
                        <p class="text-fl-ink-muted">
                          Container images and resources outside the cluster are not included.
                        </p>
                      </div>
                    </details>
                  }

                  @if (opts.estimate.backupMonthlyCentsBy.single == null) {
                    <fl-alert tone="info" title="Why no cost?">
                      There is no price for this storage provider yet. Set a price per GB after
                      activation to get monthly estimates.
                    </fl-alert>
                  }

                  <fl-field
                    label="Schedule"
                    for="enable-backups-schedule"
                    hint="Estimated costs vary with actual usage, commercial discounts and provider price changes."
                  >
                    <span class="fl-select-wrap">
                      <select
                        id="enable-backups-schedule"
                        class="fl-select"
                        [ngModel]="cronSchedule()"
                        (ngModelChange)="cronSchedule.set($event)"
                      >
                        <option value="">Nightly, each kind at its own time (recommended)</option>
                        <option value="0 2 * * *">Everything at 02:00 UTC</option>
                        <option value="0 */6 * * *">Every 6 hours</option>
                      </select>
                    </span>
                  </fl-field>

                  @if (errorMsg()) {
                    <fl-alert tone="error" title="Could not activate backups">{{
                      errorMsg()
                    }}</fl-alert>
                  }
                }
              }

              @case ('running') {
                <fl-status tone="progress" label="Provisioning your backups…" />
                <app-backup-progress-modal
                  [operationId]="opId()"
                  title="Enabling backups"
                  (closed)="onProgressClosed()"
                />
              }

              @case ('done') {
                <fl-status tone="success" label="Backups enabled" />
                <p class="text-fl-body-sm text-fl-ink-muted">
                  Every app on this cluster now has a backup, and new apps get one too.
                </p>
              }

              @case ('error') {
                <fl-alert tone="error" title="Setup failed">{{
                  errorMsg() || 'Setup failed.'
                }}</fl-alert>
              }
            }
          </div>

          @if (step() !== 'loading' && step() !== 'running') {
            <footer class="fl-dialog__footer">
              @switch (step()) {
                @case ('connect_primary') {
                  <button flButton="ghost" type="button" (click)="onClose()">Cancel</button>
                  <a flButton="primary" routerLink="/management/providers" (click)="onClose()"
                    >Configure provider</a
                  >
                }
                @case ('choose') {
                  <button flButton="ghost" type="button" (click)="onClose()">Cancel</button>
                  <button
                    flButton="primary"
                    type="button"
                    [disabled]="submitting() || !canActivate()"
                    [title]="canActivate() ? '' : 'Primary storage provider is not ready.'"
                    (click)="onActivate()"
                  >
                    {{ submitting() ? 'Starting…' : 'Activate backups' }}
                  </button>
                }
                @case ('done') {
                  <button flButton="primary" type="button" (click)="onClose()">Done</button>
                }
                @case ('error') {
                  <button flButton type="button" (click)="onClose()">Close</button>
                }
              }
            </footer>
          }
        </div>
      </div>
    }
  `,
})
export class EnableBackupsModalComponent implements OnInit {
  private readonly backup = inject(BackupService);

  readonly clusterId = input.required<string>();
  readonly open = input<boolean>(false);
  readonly closed = output<{ activated: boolean }>();

  /** Null until the operator picks one; the backend's own choice stands. */
  protected readonly chosenProvider = signal<QuickSetupDto.PrimaryProviderEnum | null>(null);

  protected readonly step = signal<Step>('loading');
  protected readonly options = signal<SetupOptions | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly opId = signal<string | null>(null);

  protected readonly cronSchedule = signal('');

  protected readonly centsToEur = centsToEur;
  protected readonly providerLabel = (p: string): string =>
    providerLabel(p as never, this.backup.presets());

  /**
   * The destination this activation would use: whichever the operator picked,
   * otherwise the one the backend proposed.
   */
  private readonly effectiveProvider = computed<ProviderReadiness | undefined>(() => {
    const opts = this.options();
    if (!opts) return undefined;
    const chosen = this.chosenProvider();
    return (chosen && opts.eligible?.find((c) => c.provider === chosen)) || opts.primary;
  });

  /**
   * Activate is allowed only when the backend reports the chosen destination as
   * ready. `ready=false` (for any reason) blocks the POST — server would 400.
   */
  protected readonly canActivate = computed<boolean>(() => !!this.effectiveProvider()?.ready);

  protected readonly readinessMessage = computed<string>(() => {
    const p = this.effectiveProvider();
    return providerReadinessMessage(p?.reason, p?.message);
  });

  /**
   * Returns the total monthly estimate in € (cluster + backup), or `null`
   * when any component is unavailable — never invent a number.
   */
  protected readonly totalEstimate = computed<string | null>(() => {
    const opts = this.options();
    if (!opts) return null;
    const cluster = opts.estimate.clusterMonthlyCents;
    const backup = opts.estimate.backupMonthlyCentsBy.single;
    if (cluster == null || backup == null) return null;
    return centsToEur(cluster + backup);
  });

  ngOnInit(): void {
    void (async () => {
      await Promise.all([this.backup.loadPresets(), this.loadOptions()]);
    })();
  }

  private async loadOptions(): Promise<void> {
    this.step.set('loading');
    const opts = await this.backup.getSetupOptions(this.clusterId());
    if (!opts) {
      this.errorMsg.set(this.backup.error() ?? 'Setup options unavailable.');
      this.step.set('error');
      return;
    }
    this.options.set(opts);
    this.step.set(opts.primary.needsConnection ? 'connect_primary' : 'choose');
  }

  async onActivate(): Promise<void> {
    this.submitting.set(true);
    this.errorMsg.set(null);

    const dto: QuickSetupDto = {
      profile: 'single',
      cronSchedule: this.cronSchedule() || undefined,
      retentionDays: 30,
      runFirstBackup: true,
      ...(this.chosenProvider() ? { primaryProvider: this.chosenProvider()! } : {}),
    };

    const res = await this.backup.startQuickSetup(this.clusterId(), dto);
    this.submitting.set(false);
    if (!res?.operationId) {
      this.errorMsg.set(this.backup.error() ?? 'Activation failed.');
      this.step.set('error');
      return;
    }
    this.opId.set(res.operationId);
    this.step.set('running');
  }

  onProgressClosed(): void {
    const id = this.opId();
    if (!id) return;
    const op = this.backup.activeOperations()[id];
    if (op?.status === 'completed') {
      this.step.set('done');
      void this.backup.loadStatus();
    } else if (op?.status === 'failed') {
      this.errorMsg.set(op.error ?? 'Activation failed.');
      this.step.set('error');
    }
  }

  onClose(): void {
    this.closed.emit({ activated: this.step() === 'done' });
  }
}
