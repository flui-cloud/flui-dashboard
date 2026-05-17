import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({
      lucideBox,
      lucideChevronDown,
      lucideChevronRight,
      lucideTriangleAlert,
      lucideCircleAlert,
    }),
  ],
  template: `
    <button
      type="button"
      (click)="toggled.emit(pod.name)"
      class="w-full flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors text-left"
    >
      <ng-icon
        [name]="expanded ? 'lucideChevronDown' : 'lucideChevronRight'"
        class="h-4 w-4 text-gray-400 flex-shrink-0"
      />
      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-900/40 flex-shrink-0">
        <ng-icon name="lucideBox" class="h-4 w-4 text-gray-600 dark:text-gray-300" />
      </div>
      <div class="flex-1 min-w-0 space-y-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span [class]="phaseClass">{{ pod.phase }}</span>
          @if (unready) {
            <span class="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
              <ng-icon name="lucideCircleAlert" class="h-3 w-3" />
              container not ready
            </span>
          }
          @if (missing) {
            <span class="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
              <ng-icon name="lucideTriangleAlert" class="h-3 w-3" />
              missing resource
            </span>
          }
        </div>
        <p class="text-sm font-mono font-medium text-gray-900 dark:text-white truncate">
          {{ pod.name }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
          {{ pod.containers.length }} container · {{ restarts }} restart@if (restarts !== 1) { s }
          @if (pod.nodeName) { · node: <span class="font-mono">{{ pod.nodeName }}</span> }
        </p>
      </div>
    </button>
  `,
})
export class PodCardComponent {
  @Input({ required: true }) pod!: PodDebugInfo;
  @Input() expanded = false;
  @Output() toggled = new EventEmitter<string>();

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
