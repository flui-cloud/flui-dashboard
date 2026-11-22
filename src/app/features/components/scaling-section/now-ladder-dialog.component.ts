import { Component, computed, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideArrowRight, lucideX } from '@ng-icons/lucide';
import { LadderRow } from './ladder-rows';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';

/**
 * The ladder, one rung at a time.
 *
 * The same five rungs on one page read as a wall: five verdicts, five reasons,
 * and in the common case they all say the same thing. Stepping them puts the
 * reader in front of one decision at a time, which is how the engine took them.
 */
@Component({
  selector: 'app-scaling-ladder-dialog',
  imports: [FlButton, FlIcon, FlStatus],
  providers: [provideIcons({ lucideArrowLeft, lucideArrowRight, lucideX })],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="closed.emit()"
    >
      <div
        class="fl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ladder-dialog-title"
        data-testid="ladder-dialog"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="ladder-dialog-title">If a node were needed now</h2>
          <button
            type="button"
            class="fl-dialog__close"
            aria-label="Close"
            data-testid="ladder-dialog-close"
            (click)="closed.emit()"
          >
            <fl-icon name="lucideX" />
          </button>
        </header>

        <div class="fl-dialog__body">
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">{{ subtitle() }}</p>

          <ol class="m-0 flex list-none gap-1.5 p-0" aria-label="Steps">
            @for (row of rows(); track row.rung.step; let i = $index) {
              <li class="flex-1">
                <button
                  type="button"
                  class="flex h-1.5 w-full rounded-fl-sm"
                  [class]="i === at() ? 'bg-fl-accent' : 'bg-fl-track'"
                  [attr.aria-label]="'Step ' + row.rung.step"
                  [attr.aria-current]="i === at() ? 'step' : null"
                  [attr.data-testid]="'ladder-dot-' + row.rung.step"
                  (click)="at.set(i)"
                ></button>
              </li>
            }
          </ol>

          @if (current(); as row) {
            <div class="flex flex-col gap-3" [attr.data-testid]="'ladder-step-' + row.rung.step">
              <p class="m-0 text-fl-caption text-fl-ink-muted">
                Step {{ row.rung.step }} of {{ rows().length }}
              </p>

              <p class="m-0 font-medium text-fl-ink">{{ row.rung.describes }}</p>

              @if (row.offer) {
                <p class="m-0 fl-mono fl-num text-fl-ink-secondary" data-testid="ladder-step-offer">
                  {{ row.offer }}
                </p>
              }

              <div
                class="flex flex-col gap-1 rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3"
              >
                <fl-status [tone]="row.tone" [label]="row.verdict" />
                <span class="text-fl-body-sm text-fl-ink-secondary" data-testid="ladder-step-why">
                  {{ row.why }}
                </span>
              </div>
            </div>
          }
        </div>

        <footer class="fl-dialog__footer">
          <button
            flButton
            type="button"
            [disabled]="at() === 0"
            data-testid="ladder-prev"
            (click)="at.set(at() - 1)"
          >
            <fl-icon name="lucideArrowLeft" />
            Back
          </button>
          <button
            flButton
            type="button"
            [disabled]="at() >= rows().length - 1"
            data-testid="ladder-next"
            (click)="at.set(at() + 1)"
          >
            Next
            <fl-icon name="lucideArrowRight" />
          </button>
          <button flButton="primary" type="button" (click)="closed.emit()">Done</button>
        </footer>
      </div>
    </div>
  `,
})
export class ScalingLadderDialogComponent {
  readonly rows = input.required<LadderRow[]>();

  /** One line of context: what the rungs were measured against. */
  readonly subtitle = input.required<string>();

  readonly closed = output<void>();

  /** Opens on the rung that decided, so the answer comes before the search. */
  protected readonly at = signal(0);

  protected readonly current = computed(() => this.rows()[this.at()] ?? null);

  constructor() {
    queueMicrotask(() => {
      const chosen = this.rows().findIndex((r) => r.chosen);
      if (chosen > 0) this.at.set(chosen);
    });
  }
}
