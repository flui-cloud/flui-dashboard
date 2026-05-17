import { Component, Output, EventEmitter, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideLoader,
  lucideStar,
  lucideCircleAlert,
  lucideGitBranch,
} from '@ng-icons/lucide';
import { RepositoryService } from '../../service/repository.service';
import { PublicRepoSearchResultDto } from '../../../core/api/model/publicRepoSearchResultDto';

@Component({
  selector: 'app-public-repo-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({ lucideSearch, lucideLoader, lucideStar, lucideCircleAlert, lucideGitBranch }),
  ],
  template: `
    <div class="space-y-3">
      <!-- Search input -->
      <div class="relative">
        <ng-icon name="lucideSearch" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          [(ngModel)]="searchQuery"
          (ngModelChange)="onQueryChange($event)"
          placeholder="Search public GitHub repositories..."
          class="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <!-- Loading -->
      @if (searching()) {
        <div class="flex items-center gap-2 py-4 text-muted-foreground text-sm justify-center">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          <span>Searching...</span>
        </div>
      }

      <!-- Error -->
      @if (searchError()) {
        <div class="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 py-2">
          <ng-icon name="lucideCircleAlert" class="h-4 w-4 shrink-0" />
          <span>{{ searchError() }}</span>
        </div>
      }

      <!-- Results -->
      @if (!searching() && results().length > 0) {
        <div class="border border-border rounded-md divide-y divide-border overflow-hidden">
          @for (repo of results(); track repo.full_name) {
            <button
              type="button"
              (click)="selectRepo(repo)"
              class="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-sm">{{ repo.full_name }}</span>
                    @if (repo.language) {
                      <span class="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{{ repo.language }}</span>
                    }
                    <span class="text-xs text-muted-foreground flex items-center gap-1">
                      <ng-icon name="lucideGitBranch" class="h-3 w-3" />{{ repo.default_branch }}
                    </span>
                  </div>
                  @if (repo.description) {
                    <p class="text-xs text-muted-foreground mt-1 truncate">{{ repo.description }}</p>
                  }
                </div>
                <div class="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <ng-icon name="lucideStar" class="h-3 w-3" />
                  {{ formatStars(repo.stars) }}
                </div>
              </div>
            </button>
          }
        </div>
      }

      <!-- Empty state after search -->
      @if (!searching() && searchQuery.length > 1 && results().length === 0 && !searchError()) {
        <p class="text-sm text-muted-foreground text-center py-4">No repositories found for "{{ searchQuery }}"</p>
      }

      <!-- Hint before search -->
      @if (!searching() && searchQuery.length <= 1 && results().length === 0) {
        <p class="text-sm text-muted-foreground text-center py-4">Type at least 2 characters to search</p>
      }
    </div>
  `,
})
export class PublicRepoPickerComponent implements OnInit, OnDestroy {
  @Output() repoSelected = new EventEmitter<PublicRepoSearchResultDto>();

  private readonly repoService = inject(RepositoryService);

  searchQuery = '';
  searching = signal(false);
  results = signal<PublicRepoSearchResultDto[]>([]);
  searchError = signal<string | null>(null);

  private readonly querySubject = new Subject<string>();

  ngOnInit(): void {
    this.querySubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe(q => this.doSearch(q));
  }

  ngOnDestroy(): void {
    this.querySubject.complete();
  }

  onQueryChange(value: string): void {
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
      this.searchError.set('Search failed. Please try again.');
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
