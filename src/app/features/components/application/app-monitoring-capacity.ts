import { Component, computed, input, output, signal } from '@angular/core';
import type { AdviceView, AppCapacityAdvice } from '../../service/app-capacity-advice.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

export type CapacityAdviceView = AppCapacityAdvice & AdviceView;

const TONES: Record<AdviceView['tone'], StatusTone> = {
  ok: 'success',
  act: 'warning',
  wait: 'neutral',
};

@Component({
  selector: 'app-monitoring-capacity',
  imports: [FlPanel, FlButton, FlStatus],
  host: { class: 'block' },
  template: `
    @let a = advice();
    <fl-panel title="Capacity" data-testid="capacity-advice">
      @if (a.advice === 'add_replicas') {
        <button
          panelActions
          flButton
          size="sm"
          type="button"
          [disabled]="busy()"
          (click)="apply.emit()"
          data-testid="capacity-advice-apply"
        >
          Run {{ a.desired + 1 }} copies
        </button>
      }
      <div class="flex flex-col gap-2 text-fl-body-sm">
        <fl-status [tone]="tone()" [label]="a.title" />
        <p class="m-0">{{ a.sentence }}</p>
        @if (a.reasons.length || a.next_copy) {
          <button
            type="button"
            class="fl-link self-start"
            (click)="open.set(!open())"
            data-testid="capacity-advice-why"
            [attr.aria-expanded]="open()"
          >
            {{ open() ? 'Hide why' : 'Why' }}
          </button>
          @if (open()) {
            <ul class="m-0 list-disc pl-4 fl-muted" data-testid="capacity-advice-reasons">
              @for (reason of a.reasons; track reason) {
                <li>{{ reason }}</li>
              }
              @if (a.next_copy; as next) {
                <li>{{ next.sentence }}</li>
              }
            </ul>
            <p class="m-0 fl-muted">
              Judged on the last {{ a.thresholds.window_minutes }} minutes.
            </p>
          }
        }
      </div>
    </fl-panel>
  `,
})
export class AppMonitoringCapacity {
  readonly advice = input.required<CapacityAdviceView>();
  readonly busy = input(false);
  readonly apply = output<void>();

  protected readonly open = signal(false);
  protected readonly tone = computed(() => TONES[this.advice().tone]);
}
