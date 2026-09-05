import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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
} from '../../service/platform-update.service';

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
    <div class="card-surface" [class.border-primary]="isRunning()" [class.border-destructive]="isFailed()">
      <div class="p-5 space-y-3">
        <div class="flex items-start justify-between gap-5">
          <div class="space-y-1.5">
            <span class="badge inline-flex items-center gap-1.5"
                  [class]="isFailed() ? 'badge-error' : isRunning() ? 'bg-primary/10 text-primary' : 'badge-success'">
              @if (isRunning()) {
                <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
              }
              {{ headline() }}
            </span>
            <h2 class="text-lg font-semibold">
              <span class="font-mono text-muted-foreground font-medium">{{ operation().fromVersion }}</span>
              <span class="mx-1.5 text-muted-foreground/50">&rarr;</span>
              Flui {{ operation().targetVersion }}
            </h2>
            <p class="text-sm text-muted-foreground">{{ subline() }}</p>
          </div>
          <div class="text-right shrink-0">
            <div class="text-2xl font-semibold tracking-tight">{{ operation().progress }}%</div>
          </div>
        </div>
        <div class="h-1.5 rounded-full bg-muted overflow-hidden">
          <div class="h-full rounded-full transition-all"
               [class]="isFailed() ? 'bg-destructive' : 'bg-primary'"
               [style.width.%]="operation().progress"></div>
        </div>
      </div>

      @for (component of operation().components; track component.key) {
        <div class="flex items-start gap-3 px-5 py-3 border-t border-border">
          <div class="step-icon" [class]="iconClass(component)">
            <ng-icon [name]="iconName(component)" class="h-4 w-4"
                     [class.animate-spin]="component.status === 'running'" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold">
              {{ component.name }}
              @if (component.status !== 'skipped') {
                <span class="font-mono font-normal text-muted-foreground">
                  {{ component.fromVersion }} &rarr; {{ component.targetVersion }}
                </span>
              }
            </p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ componentDetail(component) }}</p>
          </div>
        </div>
      }

      @if (operation().errorMessage) {
        <div class="px-5 py-3 border-t border-border">
          <p class="rounded-md bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {{ operation().errorMessage }}
          </p>
        </div>
      }
    </div>

    @if (isRunning()) {
      <div class="flex items-start gap-2.5 rounded-lg bg-amber-100/70 dark:bg-amber-950/40 px-4 py-3">
        <ng-icon name="lucideTriangleAlert" class="h-4 w-4 mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
        <p class="text-xs text-amber-900 dark:text-amber-200">
          <span class="font-semibold">The API restarts during this update.</span>
          The dashboard loses its connection for about 90 seconds and reconnects on its own — keep this tab open.
          Your applications keep serving traffic throughout.
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
      return 'Components already rolled out were left on their new versions.';
    }
    if (!this.isRunning() && op.completedAt) {
      return `Completed ${new Date(op.completedAt).toLocaleString()}`;
    }
    return op.migrations > 0
      ? `${op.migrations} database migration${op.migrations === 1 ? '' : 's'} run with this release.`
      : 'No database migrations in this release.';
  }

  protected componentDetail(component: PlatformUpdateComponentProgress): string {
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

  protected iconName(component: PlatformUpdateComponentProgress): string {
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

  protected iconClass(component: PlatformUpdateComponentProgress): string {
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
