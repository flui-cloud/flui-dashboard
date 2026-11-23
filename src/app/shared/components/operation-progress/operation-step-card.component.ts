import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { ClusterCreationStep } from '../../../features/model/cluster.models';

const TONES: Record<string, StatusTone> = {
  completed: 'success',
  running: 'progress',
  error: 'error',
};

const STATES: Record<string, string> = {
  completed: 'Done',
  running: 'Running',
  error: 'Failed',
};

@Component({
  selector: 'app-operation-step-card',
  imports: [FlStatus],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex items-start gap-3 px-4 py-2.5">
      <div class="w-24 shrink-0">
        <fl-status [tone]="tone()" [label]="state()" />
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-baseline justify-between gap-4">
          <span
            class="text-fl-body-sm"
            [class]="step().status === 'pending' ? 'text-fl-ink-muted' : 'text-fl-ink'"
          >
            {{ step().title }}
          </span>
          <span class="fl-num shrink-0 font-mono text-fl-caption text-fl-ink-muted">
            @if (step().status === 'running' && step().estimatedDuration) {
              ~{{ getRemainingTime() }} left
            } @else if (step().status === 'completed' && getStepDurationSeconds() >= 1) {
              {{ getDuration(step().startedAt!, step().completedAt!) }}
            }
          </span>
        </div>

        @if (step().status === 'running' && currentStepProgress() !== undefined) {
          <span class="fl-bar" aria-hidden="true"
            ><span
              class="transition-all duration-500 ease-out"
              [style.width.%]="currentStepProgress()"
            ></span
          ></span>
        }

        @if (step().details) {
          <p
            class="m-0 text-fl-caption"
            [class]="step().status === 'error' ? 'text-fl-danger' : 'text-fl-ink-muted'"
          >
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

  protected readonly tone = computed<StatusTone>(() => TONES[this.step().status] ?? 'neutral');
  protected readonly state = computed(() => STATES[this.step().status] ?? 'Waiting');

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
