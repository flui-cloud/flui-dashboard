import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleX,
  lucideClock,
  lucideLoader,
  lucideMinus,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import {
  PlatformUpdateComponentProgress,
  PlatformUpdateOperation,
  PlatformUpgradePhase,
} from '../../service/platform-update.service';
import { k3sNodeRows } from './platform-upgrade-plan';

@Component({
  selector: 'app-platform-update-progress',
  standalone: true,
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideCircleX,
      lucideClock,
      lucideLoader,
      lucideMinus,
      lucideTriangleAlert,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div
      class="card-surface"
      [class.border-primary]="isRunning()"
      [class.border-destructive]="isFailed()"
    >
      <div class="p-5 space-y-3">
        <div class="flex items-start justify-between gap-5">
          <div class="space-y-1.5">
            <span
              class="badge inline-flex items-center gap-1.5"
              [class]="
                isFailed()
                  ? 'badge-error'
                  : isRunning()
                    ? 'bg-primary/10 text-primary'
                    : 'badge-success'
              "
            >
              @if (isRunning()) {
                <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
              }
              {{ headline() }}
            </span>
            <h2 class="text-lg font-semibold">
              <span class="font-mono text-muted-foreground font-medium">{{
                operation().fromVersion
              }}</span>
              <span class="mx-1.5 text-muted-foreground/50">&rarr;</span>
              Flui {{ operation().targetVersion }}
            </h2>
            <p class="text-sm text-muted-foreground">{{ subline() }}</p>
          </div>
          <div class="text-right shrink-0">
            <div class="text-2xl font-semibold tracking-tight">
              {{ operation().progress }}%
            </div>
          </div>
        </div>
        <div class="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            [class]="isFailed() ? 'bg-destructive' : 'bg-primary'"
            [style.width.%]="operation().progress"
          ></div>
        </div>
      </div>

      @if (operation().phases; as phases) {
        @for (phase of phases; track phase.key) {
          <div class="flex items-start gap-3 px-5 py-3 border-t border-border">
            <div class="step-icon" [class]="iconClass(phase)">
              <ng-icon
                [name]="iconName(phase)"
                class="h-4 w-4"
                [class.animate-spin]="phase.status === 'running'"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">{{ phase.title }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ phaseDetail(phase) }}
              </p>
              @if (phase.key !== 'k3s' && phase.clusters?.length) {
                <p class="text-xs text-muted-foreground mt-1">
                  @for (c of phase.clusters; track c.clusterId) {
                    <span class="mr-3"
                      >{{ c.clusterName }}: {{ c.status }}</span
                    >
                  }
                </p>
              }
              @for (check of phase.checks ?? []; track check.name) {
                <p class="text-xs mt-0.5" [class.text-destructive]="!check.ok">
                  {{ check.ok ? '✓' : '✗' }} {{ check.name }}
                  @if (check.detail) {
                    · {{ check.detail }}
                  }
                </p>
              }
            </div>
          </div>
          @if (phase.key === 'k3s' && k3sRows().length > 0) {
            <div class="px-5 pb-3">
              <div
                class="grid grid-cols-[1fr_1fr_70px_140px_90px] gap-3 bg-muted px-3 py-1.5 text-label"
              >
                <div>Cluster</div>
                <div>Node</div>
                <div>Role</div>
                <div>K3s</div>
                <div>State</div>
              </div>
              @for (row of k3sRows(); track row.cluster + row.node) {
                <div
                  class="grid grid-cols-[1fr_1fr_70px_140px_90px] gap-3 border-t border-border px-3 py-1.5 text-xs"
                >
                  <div>{{ row.cluster }}</div>
                  <div class="font-mono truncate" [title]="row.node">
                    {{ row.node }}
                  </div>
                  <div class="text-muted-foreground">{{ row.role }}</div>
                  <div class="font-mono text-muted-foreground">
                    {{ row.version ?? '—' }}
                  </div>
                  <div
                    [class.text-destructive]="row.status === 'failed'"
                    [title]="row.message ?? ''"
                  >
                    {{ row.status }}
                  </div>
                </div>
              }
            </div>
          }
        }
      } @else {
        @for (component of operation().components; track component.key) {
          <div class="flex items-start gap-3 px-5 py-3 border-t border-border">
            <div class="step-icon" [class]="iconClass(component)">
              <ng-icon
                [name]="iconName(component)"
                class="h-4 w-4"
                [class.animate-spin]="component.status === 'running'"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">
                {{ component.name }}
                @if (component.status !== 'skipped') {
                  <span class="font-mono font-normal text-muted-foreground">
                    {{ component.fromVersion }} &rarr;
                    {{ component.targetVersion }}
                  </span>
                }
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ componentDetail(component) }}
              </p>
            </div>
          </div>
        }
      }

      @if (operation().errorMessage) {
        <div class="px-5 py-3 border-t border-border">
          <p
            class="rounded-md bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive"
          >
            {{ operation().errorMessage }}
          </p>
        </div>
      }
    </div>

    @if (isRunning()) {
      <div
        class="flex items-start gap-2.5 rounded-lg bg-amber-100/70 dark:bg-amber-950/40 px-4 py-3"
      >
        <ng-icon
          name="lucideTriangleAlert"
          class="h-4 w-4 mt-0.5 shrink-0 text-amber-700 dark:text-amber-400"
        />
        <p class="text-xs text-amber-900 dark:text-amber-200">
          <span class="font-semibold"
            >The API restarts during this update.</span
          >
          The dashboard loses its connection for about 90 seconds and reconnects
          on its own — keep this tab open. Your applications keep serving
          traffic throughout.
        </p>
      </div>
    }
  `,
})
export class PlatformUpdateProgressComponent {
  readonly operation = input.required<PlatformUpdateOperation>();

  protected readonly isRunning = computed(() =>
    ['PENDING', 'IN_PROGRESS'].includes(this.operation().status),
  );
  protected readonly isFailed = computed(() =>
    ['FAILED', 'CANCELLED'].includes(this.operation().status),
  );

  protected readonly k3sRows = computed(() => k3sNodeRows(this.operation()));

  protected phaseDetail(phase: PlatformUpgradePhase): string {
    switch (phase.status) {
      case 'skipped':
        return phase.key === 'backup' && this.operation().withoutBackup
          ? 'Skipped by acknowledgement: without a backup, a database migration cannot be undone.'
          : 'Nothing to do';
      case 'running':
        return 'In progress';
      case 'done':
        return phase.key === 'backup' && phase.backupJobId
          ? `Done · backup ${phase.backupJobId}`
          : 'Done';
      case 'failed':
        return phase.error ?? 'Stopped';
      default:
        return 'Waiting';
    }
  }

  protected headline(): string {
    if (this.isFailed()) return 'Failed';
    return this.isRunning() ? 'Updating' : 'Completed';
  }

  protected subline(): string {
    const op = this.operation();
    if (op.awaitingSelfRestart) {
      return 'Waiting for the API to come back on the new version.';
    }
    if (this.isFailed()) {
      if (op.schema === 2) {
        return op.guidance && !op.errorMessage?.includes(op.guidance)
          ? op.guidance
          : 'Stopped where shown below. Nothing was rolled back.';
      }
      return 'Components already rolled out were left on their new versions.';
    }
    if (!this.isRunning() && op.completedAt) {
      return `Completed ${new Date(op.completedAt).toLocaleString()}`;
    }
    return op.migrations > 0
      ? `${op.migrations} database migration${op.migrations === 1 ? '' : 's'} run with this release.`
      : 'No database migrations in this release.';
  }

  protected componentDetail(
    component: PlatformUpdateComponentProgress,
  ): string {
    switch (component.status) {
      case 'skipped':
        return `Already on ${component.targetVersion || 'its release version'}, nothing to roll out`;
      case 'running':
        return component.key === 'fluiApi'
          ? 'Rolling out and applying database migrations'
          : 'Rolling out';
      case 'done':
        return 'Rolled out';
      case 'failed':
        return 'Did not become ready';
      default:
        return 'Waiting';
    }
  }

  protected iconName(component: { status: string }): string {
    switch (component.status) {
      case 'done':
        return 'lucideCircleCheck';
      case 'running':
        return 'lucideLoader';
      case 'failed':
        return 'lucideCircleX';
      case 'skipped':
        return 'lucideMinus';
      default:
        return 'lucideClock';
    }
  }

  protected iconClass(component: { status: string }): string {
    switch (component.status) {
      case 'done':
        return 'step-icon-completed';
      case 'running':
        return 'bg-primary/10 text-primary';
      case 'failed':
        return 'step-icon-error';
      default:
        return 'step-icon-pending';
    }
  }
}
