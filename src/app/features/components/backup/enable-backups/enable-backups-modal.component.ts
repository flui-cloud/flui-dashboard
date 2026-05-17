import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import {
  SetupOptions,
  centsToEur,
  providerLabel,
  providerReadinessMessage,
} from '../../../model/backup.models';
import { QuickSetupDto } from '../../../../core/api/model/quickSetupDto';
import { BackupProgressModalComponent } from '../shared/progress-modal.component';

type Step = 'loading' | 'connect_primary' | 'choose' | 'running' | 'done' | 'error';

@Component({
  selector: 'app-enable-backups-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BackupProgressModalComponent],
  template: `
    @if (open()) {
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-lg rounded-lg border border-border bg-background shadow-xl">
        <header class="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 class="text-lg font-semibold">Enable backups</h2>
            <p class="text-xs text-muted-foreground mt-0.5">
              EU sovereignty by default — data stays where you choose.
            </p>
          </div>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground"
            (click)="onClose()"
          >
            ✕
          </button>
        </header>

        <div class="p-5">
          @switch (step()) {
          <!-- Loading setup options -->
          @case ('loading') {
          <p class="text-sm text-muted-foreground">Loading setup options…</p>
          }

          <!-- Primary storage provider not yet connected -->
          @case ('connect_primary') {
          <div class="space-y-4">
            <div class="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
              <p class="font-medium mb-1">Storage provider required</p>
              <p class="text-xs">
                {{ readinessMessage() }}
              </p>
            </div>
            <p class="text-xs text-muted-foreground">
              Configure Scaleway from the Providers page, then return here to enable backups.
            </p>
          </div>
          }

          <!-- Choose schedule + activate -->
          @case ('choose') {
          @if (options(); as opts) {
          <div class="space-y-4">
            @if (!opts.primary.ready) {
            <div class="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
              <p class="font-medium">Storage provider not ready</p>
              <p class="text-xs">{{ readinessMessage() }}</p>
              <p class="text-xs">
                <a routerLink="/management/providers" class="text-primary hover:underline">
                  Open Providers →
                </a>
              </p>
            </div>
            }

            <div class="rounded-md border border-border bg-card p-3 text-xs space-y-1">
              <div class="flex justify-between">
                <span class="text-muted-foreground">Storage provider</span>
                <span class="font-medium">{{ providerLabel(opts.primary.provider) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">Estimated data</span>
                @if (opts.estimate.estimatedDataGb != null) {
                <span>~{{ opts.estimate.estimatedDataGb }} GB</span>
                } @else {
                <span class="text-muted-foreground italic">Unavailable</span>
                }
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">Backup storage / month</span>
                @if (opts.estimate.backupMonthlyCentsBy.single != null) {
                <span class="font-medium">{{ centsToEur(opts.estimate.backupMonthlyCentsBy.single) }}</span>
                } @else {
                <span class="text-muted-foreground italic" [title]="opts.estimate.backupUnavailableReason || ''">
                  Cost unavailable
                </span>
                }
              </div>
              <div class="flex justify-between border-t border-border/60 pt-1 mt-1">
                <span class="text-muted-foreground">Cluster + backup / month</span>
                @if (totalEstimate(); as t) {
                <span class="font-semibold">{{ t }}</span>
                } @else {
                <span class="text-muted-foreground italic" title="Costs not available — see details below.">
                  Cost unavailable
                </span>
                }
              </div>
            </div>

            @if (opts.estimate.backupScope; as scope) {
            <details class="rounded-md border border-border bg-card text-xs">
              <summary class="cursor-pointer px-3 py-2 text-muted-foreground hover:text-foreground">
                What's included in a backup?
              </summary>
              <div class="px-3 pb-3 pt-1 space-y-2">
                <ul class="list-disc ml-4 text-foreground space-y-0.5">
                  @if (scope.k8sResources) {
                  <li>Application configuration and settings</li>
                  } @if (scope.persistentVolumes) {
                  <li>Application data and storage volumes</li>
                  }
                </ul>
                <p class="text-muted-foreground">
                  Container images and resources outside the cluster are not included.
                </p>
              </div>
            </details>
            }

            @if (opts.estimate.backupMonthlyCentsBy.single == null) {
            <div class="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <strong class="text-foreground">Why no cost?</strong>
              We don't have a price for this storage provider yet. You can set a custom price per GB after activation to get monthly estimates.
            </div>
            }

            <label class="block">
              <span class="text-sm font-medium">Schedule</span>
              <select
                [(ngModel)]="cronSchedule"
                class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="0 2 * * *">Daily at 02:00 UTC (recommended)</option>
                <option value="0 */6 * * *">Every 6 hours</option>
                <option value="0 0 * * 0">Weekly (Sunday 00:00 UTC)</option>
                <option value="">On-demand only</option>
              </select>
            </label>

            <p class="text-[10px] text-muted-foreground">
              Estimated costs. Vary based on actual usage, commercial discounts and provider price changes.
            </p>
            @if (errorMsg()) {
            <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
              {{ errorMsg() }}
            </div>
            }
          </div>
          }
          }

          <!-- Quick-setup running -->
          @case ('running') {
          <div class="text-center py-6">
            <p class="text-sm text-muted-foreground">Provisioning your backups…</p>
          </div>
          <app-backup-progress-modal
            [operationId]="opId()"
            title="Enabling backups"
            (closed)="onProgressClosed()"
          />
          }

          <!-- Done -->
          @case ('done') {
          <div class="text-center py-6 space-y-2">
            <div class="text-3xl">✓</div>
            <p class="text-sm font-medium">Backups enabled successfully.</p>
            <p class="text-xs text-muted-foreground">
              Automatic schedule active. The first backup is running now.
            </p>
          </div>
          }

          <!-- Error -->
          @case ('error') {
          <div class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {{ errorMsg() || 'Setup failed.' }}
          </div>
          }
          }
        </div>

        <footer class="flex items-center justify-end gap-2 p-5 border-t border-border">
          @switch (step()) { @case ('connect_primary') {
          <button class="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" (click)="onClose()">
            Cancel
          </button>
          <a
            routerLink="/management/providers"
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            (click)="onClose()"
          >
            Configure provider
          </a>
          } @case ('choose') {
          <button class="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" (click)="onClose()">
            Cancel
          </button>
          <button
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            [disabled]="submitting() || !canActivate()"
            [title]="canActivate() ? '' : 'Primary storage provider is not ready.'"
            (click)="onActivate()"
          >
            {{ submitting() ? 'Starting…' : 'Activate backups' }}
          </button>
          } @case ('done') {
          <button class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90" (click)="onClose()">
            Done
          </button>
          } @case ('error') {
          <button class="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" (click)="onClose()">
            Close
          </button>
          } }
        </footer>
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

  protected readonly step = signal<Step>('loading');
  protected readonly options = signal<SetupOptions | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly opId = signal<string | null>(null);

  protected cronSchedule = '0 2 * * *';

  protected readonly centsToEur = centsToEur;
  protected readonly providerLabel = providerLabel;

  /**
   * Activate is allowed only when the backend reports the primary provider as ready.
   * `ready=false` (for any reason) blocks the POST — server would 400.
   */
  protected readonly canActivate = computed<boolean>(() => !!this.options()?.primary?.ready);

  protected readonly readinessMessage = computed<string>(() => {
    const p = this.options()?.primary;
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
      await this.loadOptions();
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
      cronSchedule: this.cronSchedule || undefined,
      retentionDays: 30,
      runFirstBackup: true,
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
