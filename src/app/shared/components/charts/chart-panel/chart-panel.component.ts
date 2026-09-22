import {
  Component,
  input,
  signal,
  effect,
  OnDestroy,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideMaximize2, lucideX } from '@ng-icons/lucide';

/** Handed to the panel body so one template can serve both sizes. */
export interface ChartPanelContext {
  $implicit: 'inline' | 'expanded';
  mode: 'inline' | 'expanded';
  height: string;
}

/**
 * Chart Panel Component
 * The card a time-series chart lives in: title, current reading, and — for
 * charts with more detail than a grid cell can hold — an expand control that
 * re-renders the same body full screen.
 *
 * The body is a template, not projected content, so it can be rendered in
 * both places and told which size it is drawing at.
 *
 * @example
 * ```html
 * <app-chart-panel title="CPU" subtitle="per node" value="15.0%" [body]="cpuBody">
 *   <ng-template #cpuBody let-mode let-height="height">
 *     <app-time-series-line [data]="cpuHistory()" [config]="{ height }" />
 *   </ng-template>
 * </app-chart-panel>
 * ```
 */
@Component({
  selector: 'app-chart-panel',
  standalone: true,
  imports: [NgTemplateOutlet, NgIconComponent],
  providers: [provideIcons({ lucideMaximize2, lucideX })],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: {
    '(document:keydown.escape)': 'collapse()',
  },
  template: `
    <div class="card-surface p-4 flex flex-col gap-3 h-full">
      <div class="flex items-baseline justify-between gap-3">
        <div class="flex items-baseline gap-2 min-w-0">
          <h4 class="text-sm font-semibold text-foreground truncate">{{ title() }}</h4>
          @if (subtitle()) {
            <span class="text-[11px] text-sub truncate">{{ subtitle() }}</span>
          }
        </div>
        <div class="flex items-center gap-2 shrink-0">
          @if (value()) {
            <span class="font-mono text-sm text-foreground">{{ value() }}</span>
          }
          @if (expandable()) {
            <button
              type="button"
              (click)="expand()"
              [attr.aria-label]="'Expand chart ' + title()"
              class="inline-flex items-center justify-center h-6 w-6 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ng-icon name="lucideMaximize2" class="h-3 w-3" />
            </button>
          }
        </div>
      </div>

      <ng-container
        [ngTemplateOutlet]="body()"
        [ngTemplateOutletContext]="context('inline', inlineHeight())"
      />
    </div>

    @if (expanded()) {
      <div
        class="fixed inset-0 z-50 bg-background/90 p-4 sm:p-8 flex items-center justify-center"
        (click)="collapse()"
      >
        <div
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          (click)="$event.stopPropagation()"
          class="card-surface shadow-xl w-full max-w-6xl max-h-full overflow-y-auto p-6 flex flex-col gap-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1 min-w-0">
              <h3 class="text-lg font-semibold text-foreground">{{ title() }}</h3>
              @if (subtitle()) {
                <p class="text-sm text-sub">{{ subtitle() }}</p>
              }
            </div>
            <div class="flex items-center gap-3 shrink-0">
              @if (value()) {
                <span class="font-mono text-base text-foreground">{{ value() }}</span>
              }
              <button
                type="button"
                (click)="collapse()"
                aria-label="Close"
                class="inline-flex items-center justify-center h-8 w-8 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ng-icon name="lucideX" class="h-4 w-4" />
              </button>
            </div>
          </div>

          <ng-container
            [ngTemplateOutlet]="body()"
            [ngTemplateOutletContext]="context('expanded', expandedHeight())"
          />
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class ChartPanelComponent implements OnDestroy {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  /** Current reading, already formatted — shown beside the title in both sizes. */
  readonly value = input<string>('');
  readonly body = input.required<TemplateRef<ChartPanelContext>>();
  readonly expandable = input<boolean>(true);
  readonly inlineHeight = input<string>('190px');
  readonly expandedHeight = input<string>('min(62vh, 560px)');

  private readonly isExpanded = signal(false);
  readonly expanded = this.isExpanded.asReadonly();

  constructor() {
    effect(() => {
      if (typeof document === 'undefined') return;
      document.body.style.overflow = this.isExpanded() ? 'hidden' : '';
    });
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  }

  expand(): void {
    this.isExpanded.set(true);
  }

  collapse(): void {
    this.isExpanded.set(false);
  }

  context(mode: 'inline' | 'expanded', height: string): ChartPanelContext {
    return { $implicit: mode, mode, height };
  }
}
