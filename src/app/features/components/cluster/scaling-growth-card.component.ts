import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ClusterScalingRow } from '../../model/scaling-section.models';

/**
 * The sentence that says what will happen to this cluster without anyone
 * watching, and the controls that change it. One paragraph, then buttons —
 * the long version lives behind them, not on the page.
 */
@Component({
  selector: 'app-scaling-growth-card',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="card-surface p-5 flex flex-col gap-3" data-testid="growth-card">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="m-0 text-sm font-semibold text-foreground">
          How this cluster grows
        </h3>
        @if (row()?.mode; as mode) {
          <span
            class="rounded-md px-2 py-0.5 text-xs font-semibold"
            [class]="mode.attention
              ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
              : 'bg-primary/10 text-primary'"
            data-testid="growth-mode"
          >{{ mode.label }}</span>
        }
      </div>

      <p
        class="m-0 max-w-[62ch] text-sm leading-relaxed text-foreground"
        data-testid="growth-sentence"
      >
        {{ sentence() }}
      </p>

      <div class="flex flex-wrap items-center gap-2">
        @if (row()?.groupCount === 0) {
          <button
            type="button"
            (click)="setUp.emit()"
            class="min-h-11 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
            data-testid="set-up-scaling"
          >
            Set up scaling
          </button>
        } @else {
          <button
            type="button"
            (click)="setUp.emit()"
            class="min-h-11 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
            data-testid="edit-scaling"
          >
            Edit
          </button>
        }
        @if (row()?.groupCount === 0) {
          <button
            type="button"
            (click)="editLimits.emit()"
            class="min-h-11 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
            data-testid="edit-limits"
          >
            Edit limits
          </button>
        }

        @if (row()?.groupId; as groupId) {
          <a
            [href]="'/scaling/' + groupId + '/market'"
            class="ml-1 text-[13px] font-semibold text-primary hover:underline"
          >
            What it would buy →
          </a>
        }
      </div>
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
export class ScalingGrowthCardComponent {
  readonly row = input.required<ClusterScalingRow | null>();
  readonly editLimits = output<void>();
  readonly setUp = output<void>();

  readonly sentence = computed(() => {
    const row = this.row();
    if (!row) return '';

    if (row.groupCount === 0) {
      return row.capability.canProvision
        ? 'Nothing grows it. Flui can buy a node on ' +
            row.capability.provider +
            ', but today one appears only when a person adds it.'
        : 'Nothing grows it, and Flui cannot buy a node on ' +
            row.capability.provider +
            ': a node appears only when a person adds it.';
    }

    if (row.groupCount > 1) {
      return `This cluster has ${row.groupCount} scaling groups, set up outside the dashboard. Open the scaling section to see them.`;
    }

    if (!row.acts) {
      return row.capability.canProvision
        ? 'Flui names the machine that would fit when an app has nowhere to run, and buys nothing: the group is manual. Switch it to automatic in the scaling section, or add the machine yourself.'
        : 'Flui raises an alarm when an app has nowhere to run, and names the machine that would fit. It cannot buy one here.';
    }

    const ceiling = row.bounds
      ? `up to ${row.bounds.max} nodes`
      : 'within its limits';
    const cap =
      row.monthlyCap != null
        ? ` and €${row.monthlyCap.toFixed(0)} a month`
        : '';
    return `Flui buys a node when an app has nowhere to run, ${ceiling}${cap}, without asking you. It gives one back when the work fits without it.`;
  });
}
