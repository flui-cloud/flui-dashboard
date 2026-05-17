import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideMemoryStick,
  lucideRefreshCw,
  lucideSettings,
  lucideImageOff,
  lucideActivity,
  lucideCalendarX,
  lucideCircleHelp,
  lucideCircleCheck,
  lucideChevronRight,
  lucideWand,
} from '@ng-icons/lucide';
import {
  AutoFixActionPayload,
  CrashDiagnosis,
  autoFixPayload,
  categoryIcon,
  categoryLabel,
  isAutoRemediated,
  severityBadgeClass,
} from '../../../model/crash-diagnosis.models';

@Component({
  selector: 'app-diagnosis-row',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideMemoryStick,
      lucideRefreshCw,
      lucideSettings,
      lucideImageOff,
      lucideActivity,
      lucideCalendarX,
      lucideCircleHelp,
      lucideCircleCheck,
      lucideChevronRight,
      lucideWand,
    }),
  ],
  template: `
    <button
      type="button"
      (click)="clicked.emit(diagnosis)"
      class="w-full flex items-start gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors text-left"
    >
      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-900/40 flex-shrink-0">
        <ng-icon [name]="icon" class="h-4 w-4 text-gray-600 dark:text-gray-300" />
      </div>
      <div class="flex-1 min-w-0 space-y-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span [class]="severityClass">{{ diagnosis.severity }}</span>
          <span class="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300">
            {{ category }}
          </span>
          @if (autoRemediated) {
            <span class="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 font-medium">
              <ng-icon name="lucideWand" class="h-3 w-3" />
              Auto-remediated
            </span>
          }
          @if (autoFix && autoFix!.previousMemoryLimit && autoFix!.newMemoryLimit) {
            <span class="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 font-mono">
              Memory {{ autoFix!.previousMemoryLimit }} → {{ autoFix!.newMemoryLimit }}
            </span>
          }
          @if (diagnosis.resolvedAt) {
            <span class="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <ng-icon name="lucideCircleCheck" class="h-3 w-3" />
              resolved
            </span>
          }
        </div>
        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
          {{ diagnosis.title }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
          Pod: <span class="font-mono">{{ diagnosis.podName }}</span>
          @if (diagnosis.containerName) {
            · <span class="font-mono">{{ diagnosis.containerName }}</span>
          }
          · {{ formatDate(diagnosis.createdAt) }}
        </p>
      </div>
      <ng-icon name="lucideChevronRight" class="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
    </button>
  `,
})
export class DiagnosisRowComponent {
  @Input({ required: true }) diagnosis!: CrashDiagnosis;
  @Output() clicked = new EventEmitter<CrashDiagnosis>();

  get icon(): string {
    return categoryIcon(this.diagnosis.category);
  }

  get category(): string {
    return categoryLabel(this.diagnosis.category);
  }

  get severityClass(): string {
    return severityBadgeClass(this.diagnosis.severity);
  }

  get autoRemediated(): boolean {
    return isAutoRemediated(this.diagnosis);
  }

  get autoFix(): AutoFixActionPayload | null {
    return autoFixPayload(this.diagnosis);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }
}
