import { Component, input, output, signal } from '@angular/core';
import { DbPooledClient, DbPoolerView } from '../../service/db-sessions.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { formatAge, pooledClientWho } from './app-sessions-view';

@Component({
  selector: 'app-sessions-pooler',
  imports: [FlPanel, FlTable, FlAlert, FlButton, FlActionsMenu],
  template: `
    <fl-panel title="Pooler" [flush]="true">
      <button
        panelActions
        flButton="ghost"
        size="sm"
        type="button"
        [attr.aria-expanded]="open()"
        data-testid="sessions-pooler-toggle"
        (click)="open.set(!open())"
      >
        {{ open() ? 'Hide details' : 'Show details' }}
      </button>
      <p class="px-4 py-3 text-fl-body-sm text-fl-ink-muted" data-testid="sessions-pooler-summary">
        {{ summary() }}
      </p>
      @if (open()) {
        <div class="flex flex-col border-t border-fl-border" data-testid="sessions-pooler">
          <div class="fl-table-wrap relative">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Pool</th>
                  <th scope="col" class="is-num">Clients</th>
                  <th scope="col" class="is-num">Waiting</th>
                  <th scope="col" class="is-num">Servers</th>
                  <th scope="col" class="is-num">Longest wait</th>
                </tr>
              </thead>
              <tbody>
                @for (pool of pooler().pools; track pool.pod + pool.database + pool.user) {
                  <tr>
                    <td class="fl-mono">{{ pool.database }} · {{ pool.user }}</td>
                    <td class="is-num">{{ pool.clientsActive }}</td>
                    <td class="is-num">{{ pool.clientsWaiting }}</td>
                    <td class="is-num">
                      {{ pool.serversActive }} / {{ pool.serversActive + pool.serversIdle }}
                    </td>
                    <td class="is-num">{{ age(pool.maxWaitMs) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (pooler().reason) {
            <div class="border-t border-fl-border-subtle p-4" data-testid="sessions-pooler-reason">
              <fl-alert tone="warning" title="Pooler details incomplete">{{
                pooler().reason
              }}</fl-alert>
            </div>
          }
          @if (pooler().clients.length) {
            <div class="fl-table-wrap border-t border-fl-border">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">Pooled client</th>
                    <th scope="col">State</th>
                    <th scope="col" class="is-num">Waiting</th>
                    <th scope="col" class="is-num">Session</th>
                    <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of pooler().clients; track c.pod + ':' + c.id) {
                    <tr [attr.data-testid]="'pooled-client-' + c.id">
                      <td>{{ clientWho(c) }}</td>
                      <td>{{ c.state }}</td>
                      <td class="is-num">{{ c.waitMs ? age(c.waitMs) : '—' }}</td>
                      <td class="is-num fl-mono">{{ c.serverPid ?? '—' }}</td>
                      <td class="is-fit">
                        <fl-actions-menu
                          label="Connection actions"
                          [compact]="true"
                          [items]="actionsFor(c)"
                          [attr.data-testid]="'pooled-client-actions-' + c.id"
                          (action)="closeClient.emit(c)"
                        />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </fl-panel>
  `,
})
export class SessionsPooler {
  readonly pooler = input.required<DbPoolerView>();
  readonly summary = input('');
  readonly busyClient = input<string | null>(null);
  readonly closeClient = output<DbPooledClient>();

  protected readonly open = signal(false);
  protected readonly age = formatAge;
  protected readonly clientWho = pooledClientWho;

  protected actionsFor(c: DbPooledClient): MenuAction[] {
    return [
      {
        id: 'close',
        label: 'Close connection',
        danger: true,
        disabled: !c.canClose || this.busyClient() === `${c.pod}:${c.id}`,
      },
    ];
  }
}
