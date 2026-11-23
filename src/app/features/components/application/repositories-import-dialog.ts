import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, computed, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideGitBranch, lucideSearch, lucideX } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { RepositoriesAvailableTable } from './repositories-available-table';
import { AvailableRepo, filterAvailableRepos } from './repositories-format';

@Component({
  selector: 'app-repositories-import-dialog',
  imports: [
    CdkTrapFocus,
    NgTemplateOutlet,
    FormsModule,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
    RepositoriesAvailableTable,
  ],
  providers: [provideIcons({ lucideExternalLink, lucideGitBranch, lucideSearch, lucideX })],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="closed.emit()"
    >
      <div
        class="fl-dialog fl-dialog--wide"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repositories-import-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="repositories-import-title">
            Import repositories from GitHub
          </h2>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="closed.emit()">
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-toolbar" role="toolbar" aria-label="Filters">
          <div class="fl-toolbar__group">
            <label class="fl-input">
              <fl-icon name="lucideSearch" [size]="14" />
              <span class="fl-sr">Search repositories</span>
              <input
                type="search"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
                placeholder="Search by name, description or language"
              />
            </label>
          </div>
          <div class="fl-toolbar__group">
            <span class="fl-toolbar__info">{{ shownLabel() }}</span>
          </div>
        </div>
        <div class="fl-dialog__body">
          @if (loading()) {
            <fl-loading-state [rows]="4" />
          } @else if (repos().length === 0) {
            <fl-empty-state [compact]="true" icon="lucideGitBranch" title="No repositories found" />
            @if (!hideHint()) {
              @if (authMethod() === 'github_app') {
                <fl-alert tone="info" title="Manage repository access">
                  The Flui GitHub App only sees the repositories you granted during installation.
                  Update its permissions on GitHub to add more.
                  <ng-container alertActions>
                    <a
                      flButton
                      size="sm"
                      [href]="configUrl()"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Configure repository access
                      <fl-icon name="lucideExternalLink" [size]="14" />
                    </a>
                    <ng-container *ngTemplateOutlet="hintActions" />
                  </ng-container>
                </fl-alert>
              } @else if (authMethod() === 'pat') {
                <fl-alert tone="warning" title="Check your token permissions">
                  The personal access token needs the <span class="fl-mono">repo</span> scope to
                  list your repositories.
                  <ng-container alertActions>
                    <a
                      flButton
                      size="sm"
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Manage tokens on GitHub
                      <fl-icon name="lucideExternalLink" [size]="14" />
                    </a>
                    <ng-container *ngTemplateOutlet="hintActions" />
                  </ng-container>
                </fl-alert>
              } @else {
                <fl-alert tone="info" title="No repositories visible">
                  The connected GitHub account gives access to no repository. Disconnect and
                  reconnect, or check the permissions of the OAuth app.
                  <button
                    alertActions
                    flButton="ghost"
                    size="sm"
                    type="button"
                    (click)="hideHint.set(true)"
                  >
                    Dismiss
                  </button>
                </fl-alert>
              }
            }
          } @else if (filtered().length === 0) {
            <fl-empty-state
              [compact]="true"
              icon="lucideSearch"
              title="No repositories match your search"
            >
              <button flButton size="sm" type="button" (click)="searchQuery.set('')">
                Clear search
              </button>
            </fl-empty-state>
            @if (authMethod() === 'github_app') {
              <p class="text-fl-caption text-fl-ink-muted">
                Cannot find a repository?
                <a class="fl-link" [href]="configUrl()" target="_blank" rel="noopener noreferrer"
                  >Update repository access on GitHub</a
                >
              </p>
            }
          } @else {
            <app-repositories-available-table
              [repos]="filtered()"
              [selected]="selected()"
              (toggled)="toggled.emit($event)"
            />
          }
        </div>
        <footer class="fl-dialog__footer">
          <span class="fl-toolbar__info mr-auto self-center">{{ selected().length }} selected</span>
          <button flButton="ghost" type="button" (click)="closed.emit()">Cancel</button>
          <button
            flButton="primary"
            type="button"
            [disabled]="selected().length === 0 || importing()"
            (click)="importSelected.emit()"
          >
            @if (importing()) {
              <fl-spinner label="Importing" />
              Importing…
            } @else {
              Import selected
            }
          </button>
        </footer>
      </div>
    </div>

    <ng-template #hintActions>
      <button flButton size="sm" type="button" [disabled]="loading()" (click)="retry.emit()">
        Retry
      </button>
      <button flButton="ghost" size="sm" type="button" (click)="hideHint.set(true)">Dismiss</button>
    </ng-template>
  `,
})
export class RepositoriesImportDialog {
  readonly repos = input.required<AvailableRepo[]>();
  readonly loading = input(false);
  readonly importing = input(false);
  readonly selected = input.required<readonly string[]>();
  readonly authMethod = input<string | null | undefined>(null);
  readonly configUrl = input.required<string>();
  readonly closed = output<void>();
  readonly toggled = output<string>();
  readonly importSelected = output<void>();
  readonly retry = output<void>();

  protected readonly searchQuery = signal('');
  protected readonly hideHint = signal(false);
  protected readonly filtered = computed(() =>
    filterAvailableRepos(this.repos(), this.searchQuery()),
  );
  protected readonly shownLabel = computed(() => {
    const total = this.repos().length;
    const shown = this.filtered().length;
    if (this.searchQuery().trim()) return `${shown} of ${total} shown`;
    return `${total} ${total === 1 ? 'repository' : 'repositories'}`;
  });
}
