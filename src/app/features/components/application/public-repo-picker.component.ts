import { Component, signal, inject, OnInit, OnDestroy, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { RepositoryService } from '../../service/repository.service';
import { PublicRepoSearchResultDto } from '../../../core/api/model/publicRepoSearchResultDto';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-public-repo-picker',
  imports: [FormsModule, FlAlert, FlField, FlEmptyState, FlLoadingState, FlTable, FlIcon],
  providers: [provideIcons({ lucideSearch })],
  host: { class: 'fl-stack' },
  template: `
    <fl-field
      label="Public repository"
      for="public-repo-search"
      hint="Type at least 2 characters to search GitHub"
    >
      <span class="fl-input fl-input--lg">
        <fl-icon name="lucideSearch" />
        <input
          id="public-repo-search"
          type="search"
          placeholder="Search public GitHub repositories"
          [ngModel]="searchQuery()"
          (ngModelChange)="onQueryChange($event)"
        />
      </span>
    </fl-field>

    @if (searching()) {
      <fl-loading-state />
    } @else if (searchError()) {
      <fl-alert tone="error" title="Search failed">{{ searchError() }}</fl-alert>
    } @else if (results().length > 0) {
      <div class="fl-table-wrap rounded-fl-md border border-fl-border">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Repository</th>
              <th scope="col">Description</th>
              <th scope="col">Language</th>
              <th scope="col">Branch</th>
              <th scope="col" class="is-num">Stars</th>
            </tr>
          </thead>
          <tbody>
            @for (repo of results(); track repo.full_name) {
              <tr class="cursor-pointer" (click)="selectRepo(repo)">
                <td>
                  <button
                    type="button"
                    class="fl-link fl-mono"
                    (click)="$event.stopPropagation(); selectRepo(repo)"
                  >
                    {{ repo.full_name }}
                  </button>
                </td>
                <td class="is-wrap text-fl-ink-muted">{{ repo.description }}</td>
                <td class="text-fl-ink-secondary">{{ repo.language }}</td>
                <td class="fl-mono text-fl-ink-muted">{{ repo.default_branch }}</td>
                <td class="is-num">{{ formatStars(repo.stars) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else if (searchQuery().length > 1) {
      <fl-empty-state [compact]="true" [title]="'No repositories match ' + searchQuery()" />
    }
  `,
})
export class PublicRepoPickerComponent implements OnInit, OnDestroy {
  readonly repoSelected = output<PublicRepoSearchResultDto>();

  private readonly repoService = inject(RepositoryService);

  readonly searchQuery = signal('');
  searching = signal(false);
  results = signal<PublicRepoSearchResultDto[]>([]);
  searchError = signal<string | null>(null);

  private readonly querySubject = new Subject<string>();

  ngOnInit(): void {
    this.querySubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe((q) => this.doSearch(q));
  }

  ngOnDestroy(): void {
    this.querySubject.complete();
  }

  onQueryChange(value: string): void {
    this.searchQuery.set(value);
    this.querySubject.next(value);
  }

  private async doSearch(query: string): Promise<void> {
    if (query.length < 2) {
      this.results.set([]);
      return;
    }
    this.searching.set(true);
    this.searchError.set(null);
    try {
      const res = await this.repoService.searchPublicRepositories(query, 15);
      this.results.set(res);
    } catch {
      this.searchError.set('GitHub did not answer. Try again in a moment.');
      this.results.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  selectRepo(repo: PublicRepoSearchResultDto): void {
    this.repoSelected.emit(repo);
  }

  formatStars(count: number): string {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return String(count);
  }
}
