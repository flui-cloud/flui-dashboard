import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideBan,
  lucideBell,
  lucideCircleCheck,
  lucideCircleDashed,
  lucideEuro,
  lucidePause,
  lucideX,
} from '@ng-icons/lucide';
import { LadderRow } from './ladder-rows';

/**
 * The ladder, one rung at a time.
 *
 * The same five rungs on one page read as a wall: five verdicts, five reasons,
 * and in the common case they all say the same thing. Stepping them puts the
 * reader in front of one decision at a time, which is how the engine took them.
 */
@Component({
  selector: 'app-scaling-ladder-dialog',
  standalone: true,
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideBan,
      lucideBell,
      lucideCircleCheck,
      lucideCircleDashed,
      lucideEuro,
      lucidePause,
      lucideX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4"
      (click)="closed.emit()"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="If a node were needed now"
        (click)="$event.stopPropagation()"
        class="card-surface flex w-full max-w-lg flex-col gap-5 p-6 shadow-xl"
        data-testid="ladder-dialog"
      >
        <div class="flex items-start gap-4">
          <div class="flex flex-col gap-1">
            <h3 class="m-0 text-lg font-semibold text-foreground">
              If a node were needed now
            </h3>
            <p class="m-0 text-[13px] text-sub">{{ subtitle() }}</p>
          </div>
          <button
            type="button"
            class="ml-auto -mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
            data-testid="ladder-dialog-close"
            (click)="closed.emit()"
          >
            <ng-icon name="lucideX" class="h-4 w-4" />
          </button>
        </div>

        <ol class="m-0 flex list-none gap-1.5 p-0">
          @for (row of rows(); track row.rung.step; let i = $index) {
            <li class="flex-1">
              <button
                type="button"
                class="flex h-1.5 w-full rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [class]="
                  i === at()
                    ? 'bg-primary'
                    : 'bg-border hover:bg-muted-foreground/40'
                "
                [attr.aria-label]="'Step ' + row.rung.step"
                [attr.aria-current]="i === at() ? 'step' : null"
                [attr.data-testid]="'ladder-dot-' + row.rung.step"
                (click)="at.set(i)"
              ></button>
            </li>
          }
        </ol>

        @if (current(); as row) {
          <div
            class="flex flex-col gap-3"
            [attr.data-testid]="'ladder-step-' + row.rung.step"
          >
            <p
              class="m-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Step {{ row.rung.step }} of {{ rows().length }}
            </p>

            <p class="m-0 text-[15px] font-medium leading-snug text-foreground">
              {{ row.rung.describes }}
            </p>

            @if (row.offer) {
              <p
                class="m-0 font-mono text-[13px] tabular-nums text-sub"
                data-testid="ladder-step-offer"
              >
                {{ row.offer }}
              </p>
            }

            <div
              class="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3.5"
            >
              <span
                class="inline-flex items-center gap-1.5 text-[13px] font-medium"
                [class]="row.tone"
              >
                <ng-icon [name]="row.icon" class="h-4 w-4" />
                {{ row.verdict }}
              </span>
              <span
                class="text-[13px] leading-relaxed text-sub"
                data-testid="ladder-step-why"
              >
                {{ row.why }}
              </span>
            </div>
          </div>
        }

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-foreground disabled:opacity-40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            [disabled]="at() === 0"
            data-testid="ladder-prev"
            (click)="at.set(at() - 1)"
          >
            <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-foreground disabled:opacity-40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            [disabled]="at() >= rows().length - 1"
            data-testid="ladder-next"
            (click)="at.set(at() + 1)"
          >
            Next
            <ng-icon name="lucideArrowRight" class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="ml-auto rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            (click)="closed.emit()"
          >
            Done
          </button>
        </div>
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
