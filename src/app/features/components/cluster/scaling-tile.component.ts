import { Component, input, ChangeDetectionStrategy } from '@angular/core';

/**
 * One reading in the scaling strip. The four tiles never change name or
 * position — only what is inside them — so the page reads the same whether or
 * not this cluster has scaling set up.
 */
@Component({
  selector: 'app-scaling-tile',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="card-surface p-4 flex flex-col gap-2 h-full"
      [attr.data-testid]="'tile-' + testid()"
    >
      <div class="text-[10px] font-semibold uppercase tracking-wider text-sub">
        {{ label() }}
      </div>

      <div class="flex items-baseline gap-1.5">
        <span
          class="text-2xl font-semibold tracking-tight"
          [class]="
            attention()
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-foreground'
          "
          [attr.data-testid]="'tile-value-' + testid()"
        >
          {{ value() }}
        </span>
        @if (unit()) {
          <span class="text-xs text-sub">{{ unit() }}</span>
        }
      </div>

      <p class="m-0 mt-auto text-[11px] leading-relaxed text-sub">
        {{ note() }}
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class ScalingTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly unit = input<string>('');
  readonly note = input<string>('');
  readonly attention = input<boolean>(false);
  readonly testid = input<string>('');
}
