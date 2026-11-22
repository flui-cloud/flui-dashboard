import { Component, computed, input } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlStatus } from '../../../ui/primitives/status';
import {
  MonitorPhase,
  TIMELINE_STEPS,
  TimelineStep,
  isBuildPhase,
  stepStatusState,
  timelineStepStatus,
} from './github-actions-monitor-model';

@Component({
  selector: 'app-github-actions-monitor-steps',
  imports: [FlPanel, FlStatus],
  template: `
    <fl-panel title="Workflow run" [flush]="true">
      <span panelActions class="fl-num text-fl-body-sm text-fl-ink-muted">
        {{ completedCount() }} of {{ steps.length }} completed
      </span>
      <ol class="m-0 list-none p-0">
        @for (step of steps; track step.phase) {
          @let status = statusOf(step);
          @let state = stateOf(step);
          <li
            class="flex flex-col gap-2 border-b border-fl-border-subtle px-4 py-3 last:border-b-0"
            [attr.aria-current]="status === 'active' ? 'step' : null"
          >
            <div class="flex items-center gap-4">
              <p
                class="m-0 min-w-0 flex-1 text-fl-body"
                [class.font-medium]="status === 'active'"
                [class.text-fl-ink]="status === 'active'"
                [class.text-fl-ink-secondary]="status === 'done'"
                [class.text-fl-ink-muted]="status === 'pending'"
              >
                {{ step.label }}
              </p>
              <fl-status class="w-24" [tone]="state.tone" [label]="state.label" />
              <span class="fl-mono fl-num w-16 text-right text-fl-ink-muted">{{
                durationOf(step, status)
              }}</span>
            </div>
            @if (step.phase === 'deploying' && phase() === 'deploying') {
              @if (deployProgress() > 0) {
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between text-fl-caption text-fl-ink-muted">
                    <span>{{ deployMessage() ?? 'Deploying' }}</span>
                    <span class="fl-num">{{ deployProgress() }}%</span>
                  </div>
                  <span
                    class="fl-bar"
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-label="Deploy progress"
                    [attr.aria-valuenow]="deployProgress()"
                    ><span [style.width.%]="deployProgress()"></span
                  ></span>
                </div>
              } @else if (deployMessage()) {
                <p class="m-0 text-fl-caption text-fl-ink-muted">{{ deployMessage() }}</p>
              }
            }
          </li>
        }
      </ol>
      @if (note() && phase() !== 'live') {
        <p class="m-0 border-t border-fl-border-subtle px-4 py-3 text-fl-caption text-fl-ink-muted">
          {{ note() }}
        </p>
      }
    </fl-panel>
  `,
})
export class GithubActionsMonitorSteps {
  readonly phase = input.required<MonitorPhase>();
  readonly elapsed = input<string | null>(null);
  readonly deployProgress = input(0);
  readonly deployMessage = input<string | null>(null);
  readonly note = input<string | null>(null);

  protected readonly steps = TIMELINE_STEPS;

  protected readonly completedCount = computed(
    () => this.steps.filter((s) => timelineStepStatus(s, this.phase()) === 'done').length,
  );

  protected statusOf(step: TimelineStep) {
    return timelineStepStatus(step, this.phase());
  }

  protected stateOf(step: TimelineStep) {
    return stepStatusState(this.statusOf(step));
  }

  protected durationOf(step: TimelineStep, status: string): string {
    if (status !== 'active' || step.phase !== this.phase() || !isBuildPhase(step.phase)) return '';
    return this.elapsed() ?? '';
  }
}
