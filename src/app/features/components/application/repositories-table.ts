import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlTable } from '../../../ui/patterns/table';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { ConnectedRepository } from '../../service/repository.service';
import { formatRelativeDate, frameworkLabel } from './repositories-format';

const ROW_ACTIONS: MenuAction[] = [
  { id: 'map', label: 'Open readiness map' },
  { id: 'github', label: 'View on GitHub' },
  { id: 'remove', label: 'Remove', danger: true, separatorBefore: true },
];

@Component({
  selector: 'app-repositories-table',
  imports: [RouterLink, FlTable, FlActionsMenu, FlButton, FlStatus, FlTag],
  host: { class: 'block' },
  template: `
    <div class="fl-table-wrap" data-testid="repositories-table">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">Repository</th>
            <th scope="col">Default branch</th>
            <th scope="col">Visibility</th>
            <th scope="col">Language</th>
            <th scope="col">Last commit</th>
            <th scope="col">Webhook</th>
            <th scope="col">Auto-deploy</th>
            <th scope="col" class="is-num">Imported</th>
            <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (repo of repos(); track repo.id) {
            <tr>
              <td class="fl-cell-name">
                <a
                  class="fl-link fl-mono"
                  [routerLink]="['/apps/repositories', repo.id, 'map']"
                  [attr.title]="repo.description || null"
                  >{{ repo.fullName }}</a
                >
              </td>
              <td class="fl-mono">{{ repo.branch }}</td>
              <td>
                <fl-tag>{{ repo.private ? 'Private' : 'Public' }}</fl-tag>
              </td>
              <td>{{ language(repo) }}</td>
              <td>
                @if (repo.lastCommit; as commit) {
                  <span class="fl-mono">{{ commit.sha.slice(0, 7) }}</span>
                  <span class="text-fl-ink-muted"> {{ when(commit.timestamp) }}</span>
                } @else {
                  <span class="text-fl-ink-muted">—</span>
                }
              </td>
              <td>
                <fl-status
                  [tone]="repo.webhookEnabled ? 'success' : 'neutral'"
                  [label]="repo.webhookEnabled ? 'Active' : 'Inactive'"
                />
              </td>
              <td>
                <fl-status
                  [tone]="repo.autoDeployEnabled ? 'success' : 'neutral'"
                  [label]="repo.autoDeployEnabled ? 'On' : 'Off'"
                />
              </td>
              <td class="is-num">{{ repo.connectedAt ? when(repo.connectedAt) : '—' }}</td>
              <td class="is-fit">
                <div class="fl-row flex-nowrap">
                  <button
                    flButton
                    size="sm"
                    type="button"
                    [disabled]="checking()"
                    (click)="deploy.emit(repo)"
                  >
                    Deploy
                  </button>
                  <fl-actions-menu
                    [compact]="true"
                    [label]="'Actions for ' + repo.fullName"
                    [items]="actions"
                    (action)="onAction($event, repo)"
                  />
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class RepositoriesTable {
  readonly repos = input.required<ConnectedRepository[]>();
  readonly checking = input(false);
  readonly deploy = output<ConnectedRepository>();
  readonly openMap = output<ConnectedRepository>();
  readonly remove = output<ConnectedRepository>();

  protected readonly actions = ROW_ACTIONS;
  protected readonly when = formatRelativeDate;

  protected language(repo: ConnectedRepository): string {
    if (repo.detectedFramework) return frameworkLabel(repo.detectedFramework);
    return repo.language || '—';
  }

  protected onAction(id: string, repo: ConnectedRepository): void {
    if (id === 'map') this.openMap.emit(repo);
    else if (id === 'github') globalThis.open(repo.url, '_blank', 'noopener');
    else if (id === 'remove') this.remove.emit(repo);
  }
}
