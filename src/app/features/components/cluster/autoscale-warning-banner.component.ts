import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert, lucideCircleAlert, lucideZap, lucidePlus } from '@ng-icons/lucide';
import { AutoscaleStatus } from '../../model/autoscale.models';

@Component({
  selector: 'app-autoscale-warning-banner',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({ lucideTriangleAlert, lucideCircleAlert, lucideZap, lucidePlus }),
  ],
  template: `
    @if (visible()) {
      <div
        class="flex items-start gap-3 rounded-lg border p-3"
        [class]="containerClass()"
      >
        <ng-icon
          [name]="iconName()"
          class="h-5 w-5 flex-shrink-0 mt-0.5"
          [class]="iconClass()"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium" [class]="titleClass()">
            {{ title() }}
          </p>
          @if (status()?.warningMessage; as msg) {
            <p class="text-xs mt-0.5" [class]="messageClass()">{{ msg }}</p>
          }
          @if (showActions()) {
            <div class="flex flex-wrap items-center gap-2 mt-2">
              @if (showConfigure()) {
                <button
                  type="button"
                  (click)="configure.emit()"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border bg-background hover:bg-muted transition-colors"
                  [class]="actionBorderClass()"
                >
                  <ng-icon name="lucideZap" class="h-3.5 w-3.5" />
                  {{ status()?.autoscalingEnabled ? 'Manage autoscaling' : 'Configure autoscaling' }}
                </button>
              }
              @if (showAddWorker()) {
                <button
                  type="button"
                  (click)="addWorker.emit()"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
                  Add worker now
                </button>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class AutoscaleWarningBannerComponent {
  status = input<AutoscaleStatus | null>(null);
  showActions = input<boolean>(true);

  configure = output<void>();
  addWorker = output<void>();

  readonly visible = computed(() => {
    const s = this.status();
    return !!s && s.warning !== 'NONE';
  });

  readonly title = computed(() => {
    const s = this.status();
    if (!s) return '';
    if (s.warning === 'DANGER_NEEDS_SCALE') {
      return s.autoscalingEnabled
        ? 'Critical pressure — scale-up required'
        : 'Critical pressure — enable autoscaling or add a worker now';
    }
    if (s.warning === 'WARN_NEEDS_AUTOSCALE') {
      return 'Cluster under sustained pressure — autoscaling recommended';
    }
    return '';
  });

  readonly iconName = computed(() =>
    this.status()?.warning === 'DANGER_NEEDS_SCALE' ? 'lucideCircleAlert' : 'lucideTriangleAlert'
  );

  readonly containerClass = computed(() =>
    this.status()?.warning === 'DANGER_NEEDS_SCALE'
      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
      : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
  );

  readonly iconClass = computed(() =>
    this.status()?.warning === 'DANGER_NEEDS_SCALE'
      ? 'text-red-600 dark:text-red-400'
      : 'text-yellow-600 dark:text-yellow-400'
  );

  readonly titleClass = computed(() =>
    this.status()?.warning === 'DANGER_NEEDS_SCALE'
      ? 'text-red-900 dark:text-red-200'
      : 'text-yellow-900 dark:text-yellow-200'
  );

  readonly messageClass = computed(() =>
    this.status()?.warning === 'DANGER_NEEDS_SCALE'
      ? 'text-red-800 dark:text-red-300'
      : 'text-yellow-800 dark:text-yellow-300'
  );

  readonly actionBorderClass = computed(() =>
    this.status()?.warning === 'DANGER_NEEDS_SCALE'
      ? 'border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
      : 'border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300'
  );

  readonly showConfigure = computed(() => true);
  readonly showAddWorker = computed(() => this.status()?.warning === 'DANGER_NEEDS_SCALE');
}
