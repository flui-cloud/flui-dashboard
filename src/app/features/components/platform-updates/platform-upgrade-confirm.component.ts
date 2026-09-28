import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideTriangleAlert } from '@ng-icons/lucide';
import {
  PlatformUpdateService,
  WITHOUT_BACKUP_ACKNOWLEDGEMENT,
} from '../../service/platform-update.service';
import { canApplyPlan, planBlockers } from './platform-upgrade-plan';

@Component({
  selector: 'app-platform-upgrade-confirm',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideLoader, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      (click)="closed.emit()"
    >
      <div
        class="w-full max-w-lg card-surface"
        (click)="$event.stopPropagation()"
      >
        <div class="border-b border-border p-5">
          <h3 class="text-base font-semibold">
            Update to Flui {{ updates.availableVersion() }}
          </h3>
          <p class="text-sub">
            From
            <span class="font-mono">{{
              updates.status()?.installedVersion
            }}</span
            >. This runs on the control cluster and cannot be paused once
            started.
          </p>
        </div>
        <div class="space-y-4 p-5">
          @if (updates.planning()) {
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
              Reading every cluster to plan the update…
            </div>
          } @else if (updates.plan$(); as plan) {
            <ol class="space-y-2">
              @for (phase of plan.phases; track phase.key; let i = $index) {
                <li
                  class="flex gap-2.5 text-sm"
                  [class.opacity-60]="!phase.willRun"
                >
                  <span class="font-mono text-muted-foreground"
                    >{{ i + 1 }}.</span
                  >
                  <span>
                    <span class="font-semibold">{{ phase.title }}</span>
                    <span class="block text-xs text-muted-foreground">{{
                      phase.summary
                    }}</span>
                  </span>
                </li>
              }
            </ol>
            @for (blocker of hardBlockers(); track blocker.message) {
              <p
                class="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {{ blocker.message }}
              </p>
            }
            @for (blocker of softBlockers(); track blocker.message) {
              <p class="rounded-md bg-muted px-3 py-2 text-xs">
                {{ blocker.message }}
              </p>
            }
            <label class="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-border"
                [checked]="withoutBackup()"
                (change)="withoutBackup.set($any($event.target).checked)"
              />
              <span class="text-muted-foreground">
                Update without a backup. {{ acknowledgement }}
              </span>
            </label>
            <button
              type="button"
              (click)="planDetails.set(!planDetails())"
              class="text-xs text-primary hover:underline"
            >
              {{
                planDetails()
                  ? 'Hide the plan details'
                  : 'Show the plan details'
              }}
            </button>
            @if (planDetails()) {
              <div class="space-y-2 rounded-md bg-muted p-3 text-xs">
                <p class="font-mono text-muted-foreground">
                  plan {{ plan.planId }}
                </p>
                @for (phase of plan.phases; track phase.key) {
                  @for (
                    cluster of phase.clusters ?? [];
                    track cluster.clusterId
                  ) {
                    <p>
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
                        <span class="block text-destructive">{{ b }}</span>
                      }
                    </p>
                  }
                }
              </div>
            }
          }
          @for (advisory of warnings(); track advisory.title) {
            <div class="flex items-start gap-2.5 rounded-md bg-muted p-3">
              <ng-icon
                name="lucideTriangleAlert"
                class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              />
              <div>
                <p class="text-sm">{{ advisory.title }}</p>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {{ advisory.detail }}
                </p>
              </div>
            </div>
          }
          @if (migrations() > 0) {
            <label class="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-border"
                [checked]="acknowledged()"
                (change)="acknowledged.set($any($event.target).checked)"
              />
              <span class="text-muted-foreground">
                I understand the database migrations in this release are not
                reverted by a rollback.
              </span>
            </label>
          }
          @if (updates.error(); as error) {
            <p
              class="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {{ error }}
            </p>
          }
        </div>
        <div
          class="flex justify-end gap-2 border-t border-border bg-muted/50 p-4"
        >
          <button
            type="button"
            (click)="closed.emit()"
            class="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            (click)="start()"
            [disabled]="!canStart()"
            class="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            @if (updates.starting()) {
              <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
            }
            Start update
          </button>
        </div>
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

  protected readonly migrations = computed(
    () => this.updates.status()?.migrations ?? 0,
  );
  protected readonly warnings = computed(
    () =>
      this.updates.status()?.advisories.filter((a) => a.level !== 'info') ?? [],
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
      // The dialog stays open and shows the refusal.
    }
  }
}
