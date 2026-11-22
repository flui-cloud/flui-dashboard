import { Component, computed, inject, model, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import {
  PlatformUpdateService,
  WITHOUT_BACKUP_ACKNOWLEDGEMENT,
} from '../../service/platform-update.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { canApplyPlan, planBlockers } from './platform-upgrade-plan';

@Component({
  selector: 'app-platform-upgrade-confirm',
  imports: [FlAlert, FlButton, FlIcon, FlSpinner, FlStatus],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="closed.emit()"
    >
      <div
        class="fl-dialog fl-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-upgrade-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="platform-upgrade-title">
            Update to Flui {{ updates.availableVersion() }}
          </h2>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="closed.emit()">
            <fl-icon name="lucideX" />
          </button>
        </header>

        <div class="fl-dialog__body">
          <p class="m-0 text-fl-ink-secondary">
            From <span class="fl-mono">{{ updates.status()?.installedVersion }}</span>. This runs on
            the control cluster and cannot be paused once started.
          </p>

          @if (updates.planning()) {
            <p class="fl-row m-0 text-fl-ink-muted">
              <fl-spinner label="Planning" />
              Reading every cluster to plan the update…
            </p>
          } @else if (updates.plan$(); as plan) {
            <ol class="m-0 flex list-none flex-col gap-2 p-0">
              @for (phase of plan.phases; track phase.key; let i = $index) {
                <li class="flex gap-2.5" [class.text-fl-ink-muted]="!phase.willRun">
                  <span class="fl-mono text-fl-ink-muted">{{ i + 1 }}.</span>
                  <span class="flex flex-col">
                    <span class="font-semibold">{{ phase.title }}</span>
                    <span class="text-fl-caption text-fl-ink-muted">{{ phase.summary }}</span>
                  </span>
                </li>
              }
            </ol>
            @for (blocker of hardBlockers(); track blocker.message) {
              <fl-alert tone="error" title="Blocked">{{ blocker.message }}</fl-alert>
            }
            @for (blocker of softBlockers(); track blocker.message) {
              <fl-alert tone="warning" title="Needs your acknowledgement">{{
                blocker.message
              }}</fl-alert>
            }
            <label class="fl-check items-start">
              <input
                type="checkbox"
                [checked]="withoutBackup()"
                (change)="withoutBackup.set($any($event.target).checked)"
              />
              <span class="text-fl-ink-secondary">
                Update without a backup. {{ acknowledgement }}
              </span>
            </label>
            <div>
              <button
                flButton="ghost"
                size="sm"
                type="button"
                [attr.aria-expanded]="planDetails()"
                (click)="planDetails.set(!planDetails())"
              >
                {{ planDetails() ? 'Hide the plan details' : 'Show the plan details' }}
              </button>
            </div>
            @if (planDetails()) {
              <div
                class="flex flex-col gap-2 rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3 text-fl-caption"
              >
                <p class="fl-mono m-0 text-fl-ink-muted">plan {{ plan.planId }}</p>
                @for (phase of plan.phases; track phase.key) {
                  @for (cluster of phase.clusters ?? []; track cluster.clusterId) {
                    <p class="m-0">
                      <span class="font-semibold">{{ phase.title }}</span> ·
                      {{ cluster.clusterName }}:
                      @if (phase.key === 'k3s') {
                        {{
                          cluster.upToDate
                            ? 'already there'
                            : (cluster.fromVersion ?? '?') +
                              ' → ' +
                              (cluster.steps ?? []).join(' → ')
                        }}
                      } @else {
                        {{
                          cluster.upToDate
                            ? 'already in line'
                            : (cluster.files?.length ?? 0) + ' file(s)'
                        }}
                      }
                      @for (b of cluster.blockers; track b) {
                        <span class="block"><fl-status tone="error" [label]="b" /></span>
                      }
                    </p>
                  }
                }
              </div>
            }
          }
          @for (advisory of warnings(); track advisory.title) {
            <fl-alert
              [tone]="advisory.level === 'blocker' ? 'error' : 'warning'"
              [title]="advisory.title"
            >
              {{ advisory.detail }}
            </fl-alert>
          }
          @if (migrations() > 0) {
            <label class="fl-check items-start">
              <input
                type="checkbox"
                [checked]="acknowledged()"
                (change)="acknowledged.set($any($event.target).checked)"
              />
              <span class="text-fl-ink-secondary">
                I understand the database migrations in this release are not reverted by a rollback.
              </span>
            </label>
          }
          @if (updates.error(); as error) {
            <fl-alert tone="error" title="Update not started">{{ error }}</fl-alert>
          }
        </div>

        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="closed.emit()">Cancel</button>
          <button flButton="primary" type="button" (click)="start()" [disabled]="!canStart()">
            @if (updates.starting()) {
              <fl-spinner label="Starting" />
            }
            Start update
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class PlatformUpgradeConfirmComponent {
  protected readonly updates = inject(PlatformUpdateService);

  readonly acknowledged = model(false);
  readonly closed = output<void>();

  protected readonly withoutBackup = signal(false);
  protected readonly planDetails = signal(false);
  protected readonly acknowledgement = WITHOUT_BACKUP_ACKNOWLEDGEMENT;

  protected readonly migrations = computed(() => this.updates.status()?.migrations ?? 0);
  protected readonly warnings = computed(
    () => this.updates.status()?.advisories.filter((a) => a.level !== 'info') ?? [],
  );
  protected readonly hardBlockers = computed(() => {
    const plan = this.updates.plan$();
    return plan ? planBlockers(plan).hard : [];
  });
  protected readonly softBlockers = computed(() => {
    const plan = this.updates.plan$();
    return plan ? planBlockers(plan).soft : [];
  });
  protected readonly canStart = computed(() => {
    const plan = this.updates.plan$();
    return (
      !this.updates.starting() &&
      !this.updates.planning() &&
      !!plan &&
      canApplyPlan(plan, { withoutBackup: this.withoutBackup() }) &&
      (this.migrations() === 0 || this.acknowledged()) &&
      (this.updates.status()?.applicable ?? false)
    );
  });

  protected async start(): Promise<void> {
    const version = this.updates.availableVersion();
    if (!version) return;
    try {
      await this.updates.start(version, {
        planId: this.updates.plan$()?.planId,
        withoutBackup: this.withoutBackup(),
      });
      this.closed.emit();
    } catch {
      return;
    }
  }
}
