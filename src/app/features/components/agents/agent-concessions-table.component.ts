import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import {
  AgentConcession,
  splitAction,
  standingConcessions,
} from '../../model/agent-cycle.models';
import { formatTimeSince } from '../../model/dns.models';

@Component({
  selector: 'app-agent-concessions-table',
  standalone: true,
  imports: [HlmButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length === 0) {
      <p class="m-0 text-sm text-muted-foreground" data-testid="no-concessions">
        Nothing stands. Every action your agents take is asked for one at a time.
      </p>
    } @else {
      <div class="overflow-x-auto">
        <table class="w-full min-w-[660px] border-collapse">
          <thead>
            <tr>
              <th class="border-b border-border pb-2.5 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                What it can do
              </th>
              <th class="border-b border-border pb-2.5 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                On what
              </th>
              <th class="border-b border-border pb-2.5 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Granted
              </th>
              <th class="border-b border-border pb-2.5 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last used
              </th>
              <th class="border-b border-border pb-2.5"></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr data-testid="concession">
                <td class="border-b border-border/60 py-3 pr-3 align-top text-sm font-medium text-foreground">
                  {{ row.sentence }}
                </td>
                <td class="border-b border-border/60 py-3 pr-3 align-top font-mono text-[12.5px] text-muted-foreground">
                  {{ row.scope }}
                </td>
                <td class="border-b border-border/60 py-3 pr-3 align-top font-mono text-[12.5px] tabular-nums text-muted-foreground">
                  {{ row.granted }}
                </td>
                <td class="border-b border-border/60 py-3 pr-3 align-top font-mono text-[12.5px] tabular-nums text-muted-foreground">
                  {{ row.lastUsed }}
                </td>
                <td class="border-b border-border/60 py-3 text-right align-top">
                  <button
                    hlmBtn
                    type="button"
                    variant="ghost"
                    size="sm"
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
  `,
})
export class AgentConcessionsTableComponent {
  readonly concessions = input<AgentConcession[]>([]);
  readonly busy = input<string | null>(null);

  readonly revoke = output<AgentConcession>();

  protected readonly rows = computed(() =>
    standingConcessions(this.concessions()).map((source) => ({
      id: source.id,
      source,
      sentence: source.sentence,
      scope: scopeOf(source),
      granted: formatTimeSince(source.createdAt),
      lastUsed: source.lastUsedAt
        ? formatTimeSince(source.lastUsedAt)
        : 'Never used',
    })),
  );
}

function scopeOf(concession: AgentConcession): string {
  const bound = Object.entries(concession.binding ?? {});
  if (!bound.length) return splitAction(concession.action).pattern;
  return bound.map(([key, value]) => `${key}=${value}`).join(' · ');
}
