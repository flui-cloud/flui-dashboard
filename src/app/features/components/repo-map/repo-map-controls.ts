import { Component, input, model, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideGitBranch, lucideRefreshCw } from '@ng-icons/lucide';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { RepoBranch } from '../../service/repo-map.service';

export interface RepoMapClusterOption {
  id?: string;
  name?: string;
}

@Component({
  selector: 'app-repo-map-controls',
  imports: [FlPanel, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideGitBranch, lucideRefreshCw })],
  template: `
    <fl-panel>
      <div class="flex flex-wrap items-start gap-3">
        <div class="fl-field">
          <label class="fl-field__label" for="repo-map-branch">Branch</label>
          @if (branches().length > 0) {
            <span class="fl-select-wrap">
              <select
                id="repo-map-branch"
                class="fl-select fl-select--sm"
                [value]="branch()"
                (change)="branch.set(valueOf($event))"
              >
                @for (b of branches(); track b.name) {
                  <option [value]="b.name" [selected]="b.name === branch()">
                    {{ b.name }}
                  </option>
                }
              </select>
            </span>
          } @else {
            <span class="fl-input">
              <fl-icon name="lucideGitBranch" [size]="14" />
              <input
                id="repo-map-branch"
                type="text"
                [attr.aria-describedby]="branchesError() ? 'repo-map-branch-hint' : null"
                [value]="branch()"
                (input)="branch.set(valueOf($event))"
                [placeholder]="defaultBranch() || 'default branch'"
              />
            </span>
          }
          @if (branchesError()) {
            <span id="repo-map-branch-hint" class="fl-field__hint max-w-64">
              Branches could not be listed. Type one, or leave it empty for the repository's
              default.
            </span>
          }
        </div>
        <div class="fl-field">
          <label class="fl-field__label" for="repo-map-cluster">Cluster</label>
          <span class="fl-select-wrap">
            <select
              id="repo-map-cluster"
              class="fl-select fl-select--sm"
              [value]="clusterId()"
              (change)="clusterId.set(valueOf($event))"
            >
              <option value="" [selected]="clusterId() === ''">Choose a cluster</option>
              @for (c of clusters(); track c.id) {
                <option [value]="c.id" [selected]="c.id === clusterId()">
                  {{ c.name || c.id }}
                </option>
              }
            </select>
          </span>
        </div>
        <div class="fl-field">
          <span class="fl-field__label hidden sm:block" aria-hidden="true">&nbsp;</span>
          <button flButton size="sm" type="button" (click)="check.emit()" [disabled]="loading()">
            @if (loading()) {
              <fl-spinner />
            } @else {
              <fl-icon name="lucideRefreshCw" />
            }
            {{ hasRun() ? 'Check again' : 'Check' }}
          </button>
        </div>
      </div>
    </fl-panel>
  `,
})
export class RepoMapControls {
  readonly branch = model.required<string>();
  readonly clusterId = model.required<string>();
  readonly branches = input<readonly RepoBranch[]>([]);
  readonly clusters = input<readonly RepoMapClusterOption[]>([]);
  readonly defaultBranch = input<string | undefined>(undefined);
  readonly branchesError = input<unknown>(null);
  readonly loading = input(false);
  readonly hasRun = input(false);
  readonly check = output<void>();

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }
}
