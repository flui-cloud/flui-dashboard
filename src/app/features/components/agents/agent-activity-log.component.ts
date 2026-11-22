import { Component, computed, input, signal } from '@angular/core';
import {
  AgentActivityEntry,
  AgentIdentityActivity,
  ActivityScope,
  actedOn,
  namedActor,
  operationNote,
  underLabel,
} from '../../model/agent-activity.models';
import { formatTimeSince } from '../../model/dns.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { AgentActorsTable } from './agent-actors-table';
import { actorRow, underTone } from './agent-activity-format';

@Component({
  selector: 'app-agent-activity-log',
  imports: [FlPanel, FlTable, FlEmptyState, FlStatus, FlButton, AgentActorsTable],
  host: { class: 'fl-stack' },
  template: `
    @if (identities().length) {
      <app-agent-actors-table [actors]="actors()" />
    }

    <fl-panel title="Activity" [flush]="true">
      @if (note() !== null) {
        <span panelActions class="text-fl-caption text-fl-ink-muted" data-testid="activity-count">
          {{ note() }}
        </span>
      }

      @if (rows().length === 0) {
        <fl-empty-state
          [compact]="true"
          title="Nothing has been done through an agent yet"
          body="This fills itself in as they work: it is written by the act, not by anyone reporting one."
          data-testid="no-activity"
        />
      } @else {
        <div class="fl-table-wrap" data-testid="activity-log">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">What</th>
                <th scope="col">Operation</th>
                <th scope="col">Permission</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Message</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr data-testid="activity-row">
                  <td class="fl-mono text-fl-ink-muted" [attr.title]="row.at">{{ row.when }}</td>
                  <td class="is-wrap" data-testid="activity-what">
                    <span class="fl-mono text-fl-ink">{{ row.tool }}</span>
                    @if (row.on) {
                      on <span class="font-medium">{{ row.on }}</span>
                    }
                    @if (row.who) {
                      <div class="text-fl-caption text-fl-ink-muted">{{ row.who }}</div>
                    }
                  </td>
                  <td class="is-wrap text-fl-ink-secondary">
                    @if (row.note) {
                      <span data-testid="activity-operation">{{ row.note }}</span>
                    }
                  </td>
                  <td>
                    <fl-status
                      [tone]="row.tone"
                      [label]="row.under"
                      [attr.title]="row.underDetail"
                      data-testid="activity-under"
                    />
                  </td>
                  <td class="is-fit">
                    @if (row.error) {
                      <button
                        flButton="ghost"
                        size="sm"
                        type="button"
                        [attr.aria-expanded]="shown() === row.id"
                        (click)="toggleError(row.id)"
                        data-testid="activity-error-toggle"
                      >
                        {{ shown() === row.id ? 'Hide message' : 'Show message' }}
                      </button>
                    }
                  </td>
                </tr>
                @if (row.error && shown() === row.id) {
                  <tr>
                    <td colspan="5" class="is-wrap">
                      <pre
                        class="fl-mono m-0 whitespace-pre-wrap break-words text-fl-ink-secondary"
                        data-testid="activity-error"
                        >{{ row.error }}</pre>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        @if (scope() === 'instance' || more() > 0) {
          <div
            class="flex flex-col gap-1 border-t border-fl-border-subtle px-4 py-2 text-fl-caption text-fl-ink-muted"
          >
            @if (scope() === 'instance') {
              <p class="m-0" data-testid="activity-scope">
                You administer access here, so this is every agent on the instance, not only yours.
              </p>
            }
            @if (more() > 0) {
              <p class="m-0" data-testid="activity-more">
                Showing the {{ rows().length }} most recent of {{ total() }}.
              </p>
            }
          </div>
        }
      }
    </fl-panel>
  `,
})
export class AgentActivityLogComponent {
  readonly entries = input<AgentActivityEntry[]>([]);
  readonly identities = input<AgentIdentityActivity[]>([]);
  readonly scope = input<ActivityScope>('own');
  readonly total = input(0);
  readonly keyNames = input<Record<string, string>>({});
  readonly identityNames = input<Record<string, string>>({});
  readonly note = input<string | null>(null);

  protected readonly shown = signal<string | null>(null);

  protected readonly more = computed(() => Math.max(0, this.total() - this.entries().length));

  protected readonly rows = computed(() =>
    this.entries().map((entry) => {
      const label = underLabel(entry);
      return {
        id: entry.id,
        at: entry.at,
        when: formatTimeSince(entry.at),
        tool: entry.tool,
        on: actedOn(entry),
        note: operationNote(entry),
        who: this.nameOf(entry),
        under: label.text,
        underDetail: label.detail,
        tone: underTone(label.tone),
        error: entry.allowed ? null : entry.error,
      };
    }),
  );

  protected readonly actors = computed(() =>
    this.identities().map((identity) => actorRow(identity, this.nameOf(identity))),
  );

  protected toggleError(id: string): void {
    this.shown.update((open) => (open === id ? null : id));
  }

  private nameOf(entry: {
    actorKeyId: string | null;
    actorKeyName?: string | null;
    userId: string;
  }): string | null {
    return namedActor(entry, this.keyNames(), this.identityNames());
  }
}
