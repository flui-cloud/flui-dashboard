import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, input, signal, effect, OnDestroy, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideMaximize2, lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';

/** Handed to the panel body so one template can serve both sizes. */
export interface ChartPanelContext {
  $implicit: 'inline' | 'expanded';
  mode: 'inline' | 'expanded';
  height: string;
}

@Component({
  selector: 'app-chart-panel',
  imports: [CdkTrapFocus, NgTemplateOutlet, FlButton, FlIcon],
  providers: [provideIcons({ lucideMaximize2, lucideX })],
  host: {
    '(document:keydown.escape)': 'collapse()',
  },
  template: `
    <div class="flex h-full flex-col gap-3 rounded-fl-lg border border-fl-border bg-fl-surface p-4">
      <div class="flex items-baseline justify-between gap-3">
        <div class="flex min-w-0 items-baseline gap-2">
          <h4 class="m-0 truncate text-fl-body-sm font-semibold text-fl-ink">{{ title() }}</h4>
          @if (subtitle()) {
            <span class="truncate text-fl-caption text-fl-ink-muted">{{ subtitle() }}</span>
          }
        </div>
        <div class="flex shrink-0 items-center gap-2">
          @if (value()) {
            <span class="fl-num font-mono text-fl-mono-sm text-fl-ink">{{ value() }}</span>
          }
          @if (expandable()) {
            <button
              flButton="ghost"
              size="sm"
              [iconOnly]="true"
              type="button"
              (click)="expand()"
              [attr.aria-label]="'Expand chart ' + title()"
            >
              <fl-icon name="lucideMaximize2" [size]="14" />
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
        class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
        (click)="collapse()"
      >
        <div
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          (click)="$event.stopPropagation()"
          class="flex max-h-full w-full max-w-6xl flex-col rounded-fl-lg border border-fl-border bg-fl-surface"
        >
          <header class="fl-dialog__header">
            <div class="flex min-w-0 flex-col gap-1">
              <h3 class="fl-dialog__title">{{ title() }}</h3>
              @if (subtitle()) {
                <p class="m-0 text-fl-caption text-fl-ink-muted">{{ subtitle() }}</p>
              }
            </div>
            <div class="flex shrink-0 items-center gap-3">
              @if (value()) {
                <span class="fl-num font-mono text-fl-mono-sm text-fl-ink">{{ value() }}</span>
              }
              <button
                type="button"
                class="fl-dialog__close"
                aria-label="Close"
                (click)="collapse()"
              >
                <fl-icon name="lucideX" />
              </button>
            </div>
          </header>

          <div class="fl-dialog__body">
            <ng-container
              [ngTemplateOutlet]="body()"
              [ngTemplateOutletContext]="context('expanded', expandedHeight())"
            />
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class ChartPanelComponent implements OnDestroy {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
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
