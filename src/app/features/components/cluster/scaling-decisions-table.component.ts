import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ScalingDecision } from '../../model/scaling-group.models';

type Tone = 'acted' | 'alerted' | 'quiet';

interface DecisionRow {
  id: string;
  when: string;
  saw: string;
  did: string;
  outcome: string;
  tone: Tone;
}

/**
 * What Flui decided, whether or not it did anything. The engine writes a row
 * every time it looks; until now the dashboard had no answer to "so why did
 * nothing happen?".
 */
@Component({
  selector: 'app-scaling-decisions-table',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="card-surface" data-testid="decisions">
      <div class="flex items-baseline justify-between gap-4 px-5 pt-4 pb-3">
        <h3 class="m-0 text-sm font-semibold text-foreground">
          What Flui decided
        </h3>
        @if (groupId(); as id) {
          <a
            [href]="'/scaling/' + id + '/history'"
            class="text-xs font-semibold text-primary hover:underline"
          >
            Full history →
          </a>
        }
      </div>

      @if (rows().length === 0) {
        <p class="m-0 px-5 pb-5 text-sm text-sub">
          Nothing decided yet. Flui writes a line here every time it looks at
          this cluster.
        </p>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] text-left">
            <thead>
              <tr
                class="text-[10px] font-semibold uppercase tracking-wider text-sub"
              >
                <th scope="col" class="px-5 pb-2 font-semibold w-[96px]">
                  When
                </th>
                <th scope="col" class="px-3 pb-2 font-semibold">
                  What Flui saw
                </th>
                <th scope="col" class="px-5 pb-2 font-semibold w-[280px]">
                  What happened
                </th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr class="border-t border-border align-middle">
                  <td
                    class="px-5 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap"
                  >
                    {{ row.when }}
                  </td>
                  <td class="px-3 py-3 text-[13px] text-foreground">
                    {{ row.saw }}
                  </td>
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-2">
                      <span
                        class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        [class]="badge(row.tone)"
                      >
                        {{ row.outcome }}
                      </span>
                      <span class="text-xs text-muted-foreground">{{
                        row.did
                      }}</span>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
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
export class ScalingDecisionsTableComponent {
  readonly decisions = input<ScalingDecision[]>([]);
  readonly groupId = input<string | null>(null);

  readonly rows = computed<DecisionRow[]>(() =>
    this.decisions()
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        when: this.clock(d.at),
        saw: d.saw,
        did: d.did,
        outcome: d.outcome,
        tone: this.toneOf(d.outcome),
      })),
  );

  badge(tone: Tone): string {
    switch (tone) {
      case 'acted':
        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
      case 'alerted':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }

  private toneOf(outcome: ScalingDecision['outcome']): Tone {
    if (outcome === 'added' || outcome === 'replaced' || outcome === 'removed')
      return 'acted';
    return outcome === 'alerted' ? 'alerted' : 'quiet';
  }

  private clock(iso: string): string {
    const at = new Date(iso);
    return Number.isNaN(at.getTime())
      ? '—'
      : `${at.getHours().toString().padStart(2, '0')}:${at.getMinutes().toString().padStart(2, '0')}`;
  }
}
