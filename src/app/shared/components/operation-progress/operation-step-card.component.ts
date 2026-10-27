import { Component, input, ChangeDetectionStrategy } from '@angular/core';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircle, lucideCircleCheck, lucideCircleX, lucideLoader } from '@ng-icons/lucide';
import { ClusterCreationStep } from '../../../features/model/cluster.models';

@Component({
  selector: 'app-operation-step-card',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCircle, lucideCircleCheck, lucideCircleX, lucideLoader })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex items-start gap-3 px-5 py-3">
      <div class="mt-0.5 flex-shrink-0">
        @switch (step().status) {
          @case ('completed') {
            <ng-icon name="lucideCircleCheck" class="h-4 w-4 text-[hsl(var(--ok))]" />
          }
          @case ('running') {
            <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin text-primary" />
          }
          @case ('error') {
            <ng-icon name="lucideCircleX" class="h-4 w-4 text-destructive" />
          }
          @default {
            <ng-icon name="lucideCircle" class="h-4 w-4 text-muted-foreground/50" />
          }
        }
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-baseline justify-between gap-4">
          <p class="text-sm" [class]="step().status === 'pending' ? 'text-muted-foreground' : 'text-foreground'">
            {{ step().title }}
          </p>
          <span class="flex-shrink-0 text-xs text-muted-foreground tabular-nums">
            @if (step().status === 'running' && step().estimatedDuration) {
              ~{{ getRemainingTime() }} left
            } @else if (step().status === 'completed' && getStepDurationSeconds() >= 1) {
              {{ getDuration(step().startedAt!, step().completedAt!) }}
            }
          </span>
        </div>

        @if (step().status === 'running' && currentStepProgress() !== undefined) {
          <div class="mt-2 h-1 w-full rounded-full bg-muted">
            <div class="h-1 rounded-full bg-primary transition-all duration-500 ease-out" [style.width.%]="currentStepProgress()"></div>
          </div>
        }

        @if (step().details) {
          <p class="mt-1 text-xs" [class]="step().status === 'error' ? 'text-destructive' : 'text-muted-foreground'">
            {{ step().details }}
          </p>
        }
      </div>
    </div>
  `,
})
export class OperationStepCardComponent {
  step = input.required<ClusterCreationStep>();
  currentStepProgress = input<number>();
  isFailed = input<boolean>(false);

  getRemainingTime(): string {
    const step = this.step();
    if (!step.startedAt || !step.estimatedDuration) return 'Unknown';

    const elapsed = (Date.now() - step.startedAt.getTime()) / 1000;
    const remaining = Math.max(0, step.estimatedDuration - elapsed);

    if (remaining < 60) return `${Math.ceil(remaining)}s`;
    return `${Math.ceil(remaining / 60)}m`;
  }

  getStepDurationSeconds(): number {
    const step = this.step();
    if (!step.startedAt || !step.completedAt) return 0;
    return (step.completedAt.getTime() - step.startedAt.getTime()) / 1000;
  }

  getDuration(start: Date, end: Date): string {
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    if (duration < 60) return `${duration}s`;
    return `${Math.floor(duration / 60)}m ${duration % 60}s`;
  }
}
