import { Component, computed, input } from '@angular/core';
import { ScalingDecision } from '../../model/scaling-group.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

interface DecisionRow {
  id: string;
  when: string;
  saw: string;
  did: string;
  outcome: string;
  tone: StatusTone;
}

/**
 * What Flui decided, whether or not it did anything. The engine writes a row
 * every time it looks; until now the dashboard had no answer to "so why did
 * nothing happen?".
 */
@Component({
  selector: 'app-scaling-decisions-table',
  imports: [FlPanel, FlTable, FlEmptyState, FlStatus],
  host: { class: 'block' },
  template: `
    <fl-panel
      title="What Flui decided"
      [count]="rows().length || null"
      [flush]="true"
      data-testid="decisions"
    >
      @if (groupId(); as id) {
        <a panelActions [href]="'/scaling/' + id + '/history'" class="fl-link text-fl-body-sm">
          Full history
        </a>
      }

      @if (rows().length === 0) {
        <fl-empty-state
          [compact]="true"
          title="Nothing decided yet"
          body="Flui writes a line here every time it looks at this cluster."
        />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col" class="is-fit">When</th>
                <th scope="col">What Flui saw</th>
                <th scope="col">What happened</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr>
                  <td class="fl-mono fl-num text-fl-ink-muted">{{ row.when }}</td>
                  <td class="whitespace-normal">{{ row.saw }}</td>
                  <td class="whitespace-normal">
                    <span class="flex flex-wrap items-center gap-2">
                      <fl-status [tone]="row.tone" [label]="row.outcome" />
                      <span class="text-fl-ink-muted">{{ row.did }}</span>
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
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
        outcome: outcomeLabel(d.outcome),
        tone: this.toneOf(d.outcome),
      })),
  );

  private toneOf(outcome: ScalingDecision['outcome']): StatusTone {
    if (
      outcome === 'added' ||
      outcome === 'replaced' ||
      outcome === 'removed' ||
      outcome === 'node-joined' ||
      outcome === 'node-removed'
    )
      return 'success';
    return outcome === 'alerted' || outcome === 'purchase-failed' ? 'warning' : 'neutral';
  }

  private clock(iso: string): string {
    const at = new Date(iso);
    return Number.isNaN(at.getTime())
      ? '—'
      : `${at.getHours().toString().padStart(2, '0')}:${at.getMinutes().toString().padStart(2, '0')}`;
  }
}

function outcomeLabel(outcome: string): string {
  const words = outcome.replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
