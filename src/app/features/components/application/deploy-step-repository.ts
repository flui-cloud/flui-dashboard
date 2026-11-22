import { Component, input, output } from '@angular/core';
import { ConnectedRepository } from '../../service/repository.service';
import { PublicRepoSearchResultDto } from '../../../core/api/model/publicRepoSearchResultDto';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { PublicRepoPickerComponent } from './public-repo-picker.component';

export type RepoTab = 'mine' | 'public';

@Component({
  selector: 'app-deploy-step-repository',
  imports: [FlEmptyState, FlLoadingState, FlTable, FlButton, FlStatus, PublicRepoPickerComponent],
  host: { class: 'fl-stack' },
  template: `
    <div class="fl-segmented self-start" role="group" aria-label="Repositories">
      <button type="button" [attr.aria-pressed]="tab() === 'mine'" (click)="tabChange.emit('mine')">
        My repositories
      </button>
      <button
        type="button"
        [attr.aria-pressed]="tab() === 'public'"
        (click)="tabChange.emit('public')"
      >
        Public repositories
      </button>
    </div>

    @if (tab() === 'mine') {
      @if (loading()) {
        <fl-loading-state [rows]="4" />
      } @else if (repos().length === 0) {
        <fl-empty-state title="No repositories connected" body="Connect a Git repository to start.">
          <button flButton type="button" (click)="connectRepos.emit()">Connect a repository</button>
        </fl-empty-state>
      } @else {
        <div class="fl-table-wrap rounded-fl-lg border border-fl-border">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col" class="is-fit"><span class="fl-sr">Selected</span></th>
                <th scope="col">Repository</th>
                <th scope="col">Visibility</th>
                <th scope="col">Last commit</th>
              </tr>
            </thead>
            <tbody>
              @for (repo of repos(); track repo.id) {
                <tr
                  class="cursor-pointer"
                  [class.is-selected]="selectedId() === repo.id"
                  (click)="repoSelect.emit(repo)"
                >
                  <td class="is-fit">
                    <input
                      type="radio"
                      name="deploy-repository"
                      [checked]="selectedId() === repo.id"
                      [attr.aria-label]="'Select ' + repo.name"
                    />
                  </td>
                  <td>
                    <span class="flex flex-col">
                      <span class="font-medium">{{ repo.name }}</span>
                      <span class="fl-mono fl-muted">{{ repo.fullName }}</span>
                    </span>
                  </td>
                  <td>{{ repo.private ? 'Private' : 'Public' }}</td>
                  <td class="is-wrap fl-muted">{{ repo.lastCommit?.message ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          Missing a repository?
          <button type="button" class="fl-link" (click)="connectRepos.emit()">Import it</button>
        </p>
      }
    }

    @if (tab() === 'public') {
      @if (publicRepo(); as repo) {
        <div
          class="flex flex-wrap items-center gap-3 rounded-fl-lg border border-fl-border bg-fl-surface-subtle px-4 py-3"
        >
          <fl-status tone="success" label="Selected" />
          <span class="fl-mono min-w-0 break-all">{{ repo.full_name }}</span>
          <button flButton size="sm" type="button" class="ml-auto" (click)="clearPublic.emit()">
            Change
          </button>
        </div>
      }
      <app-public-repo-picker (repoSelected)="publicRepoSelect.emit($event)" />
    }
  `,
})
export class DeployStepRepository {
  readonly tab = input<RepoTab>('mine');
  readonly loading = input(false);
  readonly repos = input.required<readonly ConnectedRepository[]>();
  readonly selectedId = input<string | null>(null);
  readonly publicRepo = input<PublicRepoSearchResultDto | null>(null);
  readonly tabChange = output<RepoTab>();
  readonly repoSelect = output<ConnectedRepository>();
  readonly publicRepoSelect = output<PublicRepoSearchResultDto>();
  readonly clearPublic = output<void>();
  readonly connectRepos = output<void>();
}
