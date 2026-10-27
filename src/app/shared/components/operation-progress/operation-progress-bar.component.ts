import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-operation-progress-bar',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="px-5 py-4">
      <div class="flex items-baseline justify-between gap-4">
        <h2 class="text-sm font-medium">{{ title() }}</h2>
        <span class="text-xs text-muted-foreground tabular-nums">{{ status() }}</span>
      </div>
      <div class="mt-3 h-1 w-full rounded-full bg-muted">
        <div class="h-1 rounded-full transition-all duration-500 ease-out" [class]="barClass()" [style.width.%]="progress()"></div>
      </div>
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

  readonly barClass = computed(() => {
    if (this.isFailed()) return 'bg-destructive';
    if (this.isCompleted()) return 'bg-[hsl(var(--ok))]';
    return 'bg-primary';
  });
}
