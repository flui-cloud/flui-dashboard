/**
 * Operation Progress Bar Component
 *
 * Displays overall progress of an operation with step count and time information.
 * Reusable across all long-running operations.
 */

import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-operation-progress-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-card border border-border rounded-lg p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">{{ title() }}</h2>
        <div class="text-sm font-medium">
          @if (isCompleted()) {
            <span class="text-green-600">Completed · {{ totalSteps() }}/{{ totalSteps() }} steps</span>
          } @else if (isFailed()) {
            <span class="text-red-600">Failed</span>
          } @else if (totalSteps() > 0) {
            <span class="text-muted-foreground">Step <span class="text-blue-600">{{ currentStep() }}</span> of {{ totalSteps() }}</span>
          }
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="w-full bg-muted rounded-full h-2 mb-4">
        <div
          [class]="isFailed()
            ? 'bg-red-500 h-2 rounded-full transition-all duration-500 ease-out'
            : 'bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out'"
          [style.width.%]="progress()"
        ></div>
      </div>

      <div class="text-sm">
        <span class="text-muted-foreground">Started:</span>
        <span class="font-medium ml-2">{{ startedTime() || 'Unknown' }}</span>
      </div>
    </div>
  `,
})
export class OperationProgressBarComponent {
  title = input<string>('Deployment Progress');
  progress = input.required<number>();
  totalSteps = input.required<number>();
  currentStep = input.required<number>(); // Current step number (1-indexed)
  startedTime = input<string>();
  isFailed = input<boolean>(false);
  isCompleted = input<boolean>(false);
}
