import { Component, Input, input, output, ChangeDetectionStrategy } from '@angular/core';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBox,
  lucideChevronDown,
  lucideChevronRight,
  lucideTriangleAlert,
  lucideCircleAlert,
} from '@ng-icons/lucide';
import {
  PodDebugInfo,
  hasMissingResources,
  hasUnreadyContainer,
  phaseBadgeClass,
  totalRestarts,
} from '../../../model/pod-debug.models';

@Component({
  selector: 'app-pod-card',
  standalone: true,
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideBox,
      lucideChevronDown,
      lucideChevronRight,
      lucideTriangleAlert,
      lucideCircleAlert,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <button
      type="button"
      (click)="toggled.emit(pod.name)"
      class="w-full flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors text-left"
    >
      <ng-icon
        [name]="expanded() ? 'lucideChevronDown' : 'lucideChevronRight'"
        class="h-4 w-4 text-gray-400 flex-shrink-0"
      />
      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
        <ng-icon name="lucideBox" class="h-4 w-4 text-gray-600" />
      </div>
      <div class="flex-1 min-w-0 space-y-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span [class]="phaseClass">{{ pod.phase }}</span>
          @if (unready) {
            <span
              class="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700"
            >
              <ng-icon name="lucideCircleAlert" class="h-3 w-3" />
              container not ready
            </span>
          }
          @if (missing) {
            <span
              class="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700"
            >
              <ng-icon name="lucideTriangleAlert" class="h-3 w-3" />
              missing resource
            </span>
          }
        </div>
        <p class="text-sm font-mono font-medium text-gray-900 truncate">
          {{ pod.name }}
        </p>
        <p class="text-xs text-gray-500 truncate">
          {{ pod.containers.length }} container · {{ restarts }} restart
          @if (restarts !== 1) {
            s
          }
          @if (pod.nodeName) {
            · node: <span class="font-mono">{{ pod.nodeName }}</span>
          }
        </p>
      </div>
    </button>
  `,
})
export class PodCardComponent {
  @Input({ required: true }) pod!: PodDebugInfo;
  readonly expanded = input(false);
  readonly toggled = output<string>();

  get phaseClass(): string {
    return phaseBadgeClass(this.pod.phase);
  }

  get unready(): boolean {
    return hasUnreadyContainer(this.pod);
  }

  get missing(): boolean {
    return hasMissingResources(this.pod);
  }

  get restarts(): number {
    return totalRestarts(this.pod);
  }
}
