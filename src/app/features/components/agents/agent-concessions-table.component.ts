import { Component, computed, input, output } from '@angular/core';
import { AgentConcession, splitAction, standingConcessions } from '../../model/agent-cycle.models';
import { formatTimeSince } from '../../model/dns.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';

@Component({
  selector: 'app-agent-concessions-table',
  imports: [FlPanel, FlTable, FlEmptyState, FlButton],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Granted permanently" [flush]="true">
      @if (note() !== null) {
        <span panelActions class="text-fl-caption text-fl-ink-muted" data-testid="granted-count">
          {{ note() }}
        </span>
      }

      @if (rows().length === 0) {
        <fl-empty-state
          [compact]="true"
          title="Nothing stands"
          body="Every action your agents take is asked for one at a time."
          data-testid="no-concessions"
        />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">What it can do</th>
                <th scope="col">On what</th>
                <th scope="col">Granted</th>
                <th scope="col">Last used</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr data-testid="concession">
                  <td class="is-wrap font-medium">{{ row.sentence }}</td>
                  <td class="fl-mono text-fl-ink-secondary">{{ row.scope }}</td>
                  <td class="fl-num text-fl-ink-secondary">{{ row.granted }}</td>
                  <td class="fl-num text-fl-ink-secondary">{{ row.lastUsed }}</td>
                  <td class="is-fit">
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [disabled]="busy() === row.id"
                      (click)="revoke.emit(row.source)"
                      data-testid="revoke"
                    >
                      Revoke
                    </button>
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
export class AgentConcessionsTableComponent {
  readonly concessions = input<AgentConcession[]>([]);
  readonly busy = input<string | null>(null);
  readonly note = input<string | null>(null);

  readonly revoke = output<AgentConcession>();

  protected readonly rows = computed(() =>
    standingConcessions(this.concessions()).map((source) => ({
      id: source.id,
      source,
      sentence: source.sentence,
      scope: scopeOf(source),
      granted: formatTimeSince(source.createdAt),
      lastUsed: source.lastUsedAt ? formatTimeSince(source.lastUsedAt) : 'Never used',
    })),
  );
}

function scopeOf(concession: AgentConcession): string {
  const bound = Object.entries(concession.binding ?? {});
  if (!bound.length) return splitAction(concession.action).pattern;
  return bound.map(([key, value]) => `${key}=${value}`).join(' · ');
}
