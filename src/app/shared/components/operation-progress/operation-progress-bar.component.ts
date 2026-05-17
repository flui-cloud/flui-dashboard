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
        <!-- Clear message showing completed steps and current step in progress -->
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <span class="flex items-center gap-1">
            <span class="text-green-600 font-medium">{{ completedSteps() }}</span>
            <span>/</span>
            <span>{{ totalSteps() }} steps</span>
          </span>
          @if (currentStep() <= totalSteps()) {
            <span class="text-blue-600">• Step {{ currentStep() }} in progress</span>
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

      <!-- Time Information - Dynamic layout, hides "Estimated completion" when empty -->
      <div [class]="estimatedCompletion() ? 'grid grid-cols-2 gap-4 text-sm' : 'text-sm'">
        <div>
          <span class="text-muted-foreground">Started:</span>
          <span class="font-medium ml-2">{{ startedTime() || 'Unknown' }}</span>
        </div>
        @if (estimatedCompletion()) {
          <div>
            <span class="text-muted-foreground">Estimated completion:</span>
            <span class="font-medium ml-2">{{ estimatedCompletion() }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class OperationProgressBarComponent {
  // Inputs
  title = input<string>('Deployment Progress');
  progress = input.required<number>();
  completedSteps = input.required<number>();
  totalSteps = input.required<number>();
  currentStep = input.required<number>(); // NEW: Current step number (1-indexed)
  startedTime = input<string>();
  estimatedCompletion = input<string>();
  isFailed = input<boolean>(false);
}
