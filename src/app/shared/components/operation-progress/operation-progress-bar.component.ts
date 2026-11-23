import { Component, input, computed } from '@angular/core';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

@Component({
  selector: 'app-operation-progress-bar',
  imports: [FlStatus],
  template: `
    <div class="flex flex-col gap-3 px-4 py-3">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div class="flex items-center gap-3">
          <h2 class="m-0 text-fl-body-sm font-semibold text-fl-ink">{{ title() }}</h2>
          <fl-status role="status" [tone]="tone()" [label]="stateLabel()" />
        </div>
        <span class="fl-num font-mono text-fl-caption text-fl-ink-muted">{{ status() }}</span>
      </div>
      <span
        class="fl-bar"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="progress()"
        [attr.aria-label]="title()"
        ><span
          class="transition-all duration-500 ease-out"
          [class]="barClass()"
          [style.width.%]="progress()"
        ></span
      ></span>
    </div>
  `,
})
export class OperationProgressBarComponent {
  title = input<string>('Progress');
  progress = input.required<number>();
  totalSteps = input.required<number>();
  currentStep = input.required<number>();
  startedTime = input<string>();
  isFailed = input<boolean>(false);
  isCompleted = input<boolean>(false);

  readonly status = computed(() => {
    const started = this.startedTime() ? `Started ${this.startedTime()}` : '';
    let state = '';
    if (this.isCompleted()) state = `${this.totalSteps()} of ${this.totalSteps()} steps`;
    else if (this.isFailed()) state = 'Failed';
    else if (this.totalSteps() > 0) state = `Step ${this.currentStep()} of ${this.totalSteps()}`;
    return [started, state].filter(Boolean).join(' · ');
  });

  readonly tone = computed<StatusTone>(() => {
    if (this.isFailed()) return 'error';
    if (this.isCompleted()) return 'success';
    return 'progress';
  });

  readonly stateLabel = computed(() => {
    if (this.isFailed()) return 'Failed';
    if (this.isCompleted()) return 'Completed';
    return 'In progress';
  });

  readonly barClass = computed(() => {
    if (this.isFailed()) return 'bg-fl-danger';
    if (this.isCompleted()) return 'bg-fl-success';
    return 'bg-fl-accent';
  });
}
