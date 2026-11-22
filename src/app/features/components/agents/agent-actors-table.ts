import { Component, input } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

export interface AgentActorRow {
  readonly ref: string;
  readonly name: string;
  readonly kind: string;
  readonly through: string;
  readonly activity: string;
  readonly lastActive: string;
  readonly lastActiveAt: string;
  readonly tone: StatusTone;
  readonly state: string;
}

@Component({
  selector: 'app-agent-actors-table',
  imports: [FlPanel, FlTable, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Agents" [count]="actors().length" [flush]="true">
      <div class="fl-table-wrap" data-testid="activity-actors">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Kind</th>
              <th scope="col">Acts through</th>
              <th scope="col">Activity</th>
              <th scope="col">Last active</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            @for (actor of actors(); track actor.ref) {
              <tr data-testid="activity-actor">
                <td class="fl-cell-name font-medium">{{ actor.name }}</td>
                <td class="text-fl-ink-secondary">{{ actor.kind }}</td>
                <td class="text-fl-ink-secondary">{{ actor.through }}</td>
                <td class="fl-num text-fl-ink-secondary">{{ actor.activity }}</td>
                <td class="fl-num text-fl-ink-secondary" [attr.title]="actor.lastActiveAt">
                  {{ actor.lastActive }}
                </td>
                <td><fl-status [tone]="actor.tone" [label]="actor.state" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>
  `,
})
export class AgentActorsTable {
  readonly actors = input.required<readonly AgentActorRow[]>();
}
