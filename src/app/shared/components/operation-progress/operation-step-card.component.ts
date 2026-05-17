/**
 * Operation Step Card Component
 *
 * Displays a single operation step with status, progress, and details.
 * Reusable across cluster creation, build agent creation, etc.
 */

import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideLoader,
  lucideX,
  lucidePlay,
  lucideClock,
  lucideCircleAlert,
  lucideServer,
  lucideCloud,
  lucideNetwork,
  lucideSettings,
  lucideShield,
} from '@ng-icons/lucide';
import { ClusterCreationStep } from '../../../features/model/cluster.models';

@Component({
  selector: 'app-operation-step-card',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({
      lucideCheck,
      lucideLoader,
      lucideX,
      lucidePlay,
      lucideClock,
      lucideCircleAlert,
      lucideServer,
      lucideCloud,
      lucideNetwork,
      lucideSettings,
      lucideShield,
    }),
  ],
  template: `
    <div [class]="getStepCardClass()" class="border border-border rounded-lg p-6 transition-all duration-300 mb-2">
      <div class="flex items-start space-x-4">
        <!-- Step Icon/Status -->
        <div [class]="getStepIconClass()" class="flex-shrink-0">
          @switch (step().status) {
            @case ('completed') {
              <ng-icon name="lucideCheck" class="h-5 w-5" />
            }
            @case ('running') {
              <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin" />
            }
            @case ('error') {
              <ng-icon name="lucideX" class="h-5 w-5" />
            }
            @default {
              <ng-icon [name]="getStepIcon()" class="h-5 w-5" />
            }
          }
        </div>

        <!-- Step Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-2">
            <h3 [class]="getStepTitleClass()" class="font-medium">
              {{ step().title }}
            </h3>
            <div class="flex items-center space-x-2 text-sm">
              @if (step().status === 'running' && step().estimatedDuration) {
                <div class="flex items-center text-blue-600">
                  <ng-icon name="lucideClock" class="h-4 w-4 mr-1" />
                  <span>~{{ getRemainingTime() }}</span>
                </div>
              }
              @if (step().status === 'completed' && step().completedAt && step().startedAt) {
                <div class="flex items-center text-green-600">
                  <ng-icon name="lucideCheck" class="h-4 w-4 mr-1" />
                  <span>{{ getDuration(step().startedAt!, step().completedAt!) }}</span>
                </div>
              }
            </div>
          </div>

          <p [class]="getStepDescriptionClass()" class="text-sm mb-3">
            {{ step().description }}
          </p>

          <!-- Step Progress Bar (for running steps) -->
          @if (step().status === 'running' && currentStepProgress() !== undefined) {
            <div class="w-full bg-muted rounded-full h-1.5 mb-2">
              <div
                [class]="isFailed()
                  ? 'bg-red-500 h-1.5 rounded-full transition-all duration-500 ease-out relative overflow-hidden'
                  : 'bg-blue-500 h-1.5 rounded-full transition-all duration-500 ease-out relative overflow-hidden'"
                [style.width.%]="currentStepProgress()"
              >
                @if (!isFailed()) {
                  <!-- Shimmer effect -->
                  <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                }
              </div>
            </div>

            <!-- Progress info -->
            <div class="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Progress: {{ currentStepProgress() }}%</span>
            </div>
          }

          <!-- Additional Details -->
          @if (step().details) {
            <div class="mt-3 p-3 bg-muted/50 rounded-md">
              <p class="text-xs text-muted-foreground">{{ step().details }}</p>
            </div>
          }

          <!-- Error Details -->
          @if (step().status === 'error') {
            <div class="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
              <div class="flex items-center text-red-700 dark:text-red-300">
                <ng-icon name="lucideCircleAlert" class="h-4 w-4 mr-2" />
                <span class="text-sm font-medium">Step failed</span>
              </div>
              @if (step().details) {
                <p class="text-xs text-red-600 dark:text-red-400 mt-1">{{ step().details }}</p>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class OperationStepCardComponent {
  // Inputs
  step = input.required<ClusterCreationStep>();
  currentStepProgress = input<number>();
  isFailed = input<boolean>(false);

  // Computed styles
  getStepCardClass = computed(() => {
    const baseClass = 'bg-card';
    const status = this.step().status;

    switch (status) {
      case 'running':
        return `${baseClass} ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10`;
      case 'completed':
        return `${baseClass} ring-1 ring-green-500/20 bg-green-50/30 dark:bg-green-900/10`;
      case 'error':
        return `${baseClass} ring-1 ring-red-500/20 bg-red-50/30 dark:bg-red-900/10`;
      default:
        return `${baseClass} opacity-60`;
    }
  });

  getStepIconClass = computed(() => {
    const baseClass = 'flex items-center justify-center w-10 h-10 rounded-full';
    const status = this.step().status;

    switch (status) {
      case 'completed':
        return `${baseClass} bg-green-500 text-white`;
      case 'running':
        return `${baseClass} bg-blue-500 text-white`;
      case 'error':
        return `${baseClass} bg-red-500 text-white`;
      default:
        return `${baseClass} bg-muted text-muted-foreground`;
    }
  });

  getStepTitleClass = computed(() => {
    const status = this.step().status;

    switch (status) {
      case 'running':
        return 'text-blue-700 dark:text-blue-300';
      case 'completed':
        return 'text-green-700 dark:text-green-300';
      case 'error':
        return 'text-red-700 dark:text-red-300';
      default:
        return 'text-muted-foreground';
    }
  });

  getStepDescriptionClass = computed(() => {
    const status = this.step().status;

    switch (status) {
      case 'running':
        return 'text-blue-600 dark:text-blue-400';
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  });

  // Helper methods
  getStepIcon(): string {
    const stepId = this.step().id;

    // Generic step icons based on common patterns
    if (stepId.includes('validate')) return 'lucideShield';
    if (stepId.includes('infrastructure') || stepId.includes('server')) return 'lucideServer';
    if (stepId.includes('kubernetes') || stepId.includes('cluster')) return 'lucideCloud';
    if (stepId.includes('network')) return 'lucideNetwork';
    if (stepId.includes('finalize') || stepId.includes('configure')) return 'lucideSettings';

    return 'lucidePlay';
  }

  getRemainingTime(): string {
    const step = this.step();
    if (!step.startedAt || !step.estimatedDuration) return 'Unknown';

    const now = Date.now();
    const started = step.startedAt.getTime();
    const elapsed = (now - started) / 1000;
    const remaining = Math.max(0, step.estimatedDuration - elapsed);

    if (remaining < 60) return `${Math.ceil(remaining)}s`;
    return `${Math.ceil(remaining / 60)}m`;
  }

  getDuration(start: Date, end: Date): string {
    const duration = (end.getTime() - start.getTime()) / 1000;
    if (duration < 60) return `${Math.round(duration)}s`;
    return `${Math.round(duration / 60)}m ${Math.round(duration % 60)}s`;
  }
}
