import { Component, OnInit, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideGitBranch,
  lucideLock,
  lucideUnlock,
  lucideLoader,
  lucideAlertCircle,
  lucideRefreshCw,
  lucideDownload,
  lucideCheckCircle,
  lucideKey,
  lucideExternalLink,
  lucideX,
} from '@ng-icons/lucide';
import { RepositoriesService } from '../../../core/api/api/repositories.service';
import { AvailableRepositoryDto } from '../../../core/api/model/availableRepositoryDto';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-github-available-repos',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideSearch,
      lucideGitBranch,
      lucideLock,
      lucideUnlock,
      lucideLoader,
      lucideAlertCircle,
      lucideRefreshCw,
      lucideDownload,
      lucideCheckCircle,
      lucideKey,
      lucideExternalLink,
      lucideX,
    }),
  ],
  template: `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Your GitHub Repositories</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select repositories to import into the platform
          </p>
        </div>
        <button
          (click)="loadRepos()"
          [disabled]="isLoading()"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 transition-colors"
        >
          <ng-icon [name]="isLoading() ? 'lucideLoader' : 'lucideRefreshCw'" size="14"
            [class.animate-spin]="isLoading()" />
          <span>Refresh</span>
        </button>
      </div>

      <!-- Search -->
      <div class="relative">
        <ng-icon name="lucideSearch" size="14"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search repositories..."
          class="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- Loading state -->
      @if (isLoading() && repos().length === 0) {
        <div class="flex items-center justify-center py-12 text-slate-400">
          <ng-icon name="lucideLoader" size="24" class="animate-spin mr-2" />
          <span class="text-sm">Loading repositories...</span>
        </div>
      }

      <!-- Error state -->
      @if (error()) {
        <div class="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <ng-icon name="lucideAlertCircle" size="16" class="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p class="text-sm font-medium text-red-800 dark:text-red-300">Failed to load repositories</p>
            <p class="text-xs text-red-600 dark:text-red-400 mt-0.5">{{ error() }}</p>
          </div>
        </div>
      }

      <!-- Repository list -->
      @if (!isLoading() || repos().length > 0) {
        @if (filteredRepos().length === 0 && !isLoading()) {
          <div class="text-center py-10 space-y-3">
            <ng-icon name="lucideGitBranch" size="32" class="mx-auto text-slate-300 dark:text-slate-600" />
            @if (searchQuery) {
              <p class="text-sm text-slate-500 dark:text-slate-400">
                No repositories match "{{ searchQuery }}"
              </p>
            } @else if (authMethod() === 'pat') {
              <p class="text-sm font-medium text-slate-700 dark:text-slate-300">No repositories found</p>
              @if (!hideHint()) {
                <div class="relative inline-flex flex-col items-start gap-1.5 text-left bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 mx-auto max-w-xs">
                  <button
                    (click)="hideHint.set(true)"
                    class="absolute top-2 right-2 text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-200"
                    aria-label="Dismiss"
                  >
                    <ng-icon name="lucideX" size="13" />
                  </button>
                  <div class="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 pr-4">
                    <ng-icon name="lucideKey" size="13" />
                    Check your token permissions
                  </div>
                  <p class="text-xs text-amber-700 dark:text-amber-400">
                    Make sure the token has the <code class="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">repo</code> scope to access your repositories.
                  </p>
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:underline mt-0.5"
                  >
                    Manage tokens on GitHub
                    <ng-icon name="lucideExternalLink" size="11" />
                  </a>
                  <span class="text-amber-300 dark:text-amber-700">·</span>
                  <button
                    (click)="loadRepos()"
                    [disabled]="isLoading()"
                    class="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:underline disabled:opacity-50"
                  >
                    <ng-icon [name]="isLoading() ? 'lucideLoader' : 'lucideRefreshCw'" size="11" [class.animate-spin]="isLoading()" />
                    Retry
                  </button>
                </div>
              }
            } @else {
              }
            } @else {
              <p class="text-sm font-medium text-slate-700 dark:text-slate-300">No repositories found</p>
              @if (!hideHint()) {
                <div class="relative inline-flex flex-col items-start gap-1.5 text-left bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-3 mx-auto max-w-xs">
                  <button
                    (click)="hideHint.set(true)"
                    class="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label="Dismiss"
                  >
                    <ng-icon name="lucideX" size="13" />
                  </button>
                  <p class="text-xs text-slate-500 dark:text-slate-400 pr-4">
                    Make sure the GitHub OAuth App has been authorized to access your repositories. Try disconnecting and reconnecting.
                  </p>
                </div>
              }
            }
          </div>
        } @else {
          <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
            @for (repo of filteredRepos(); track repo.id) {
              <label
                [class]="getRepoRowClass(repo)"
                class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-150"
              >
                <input
                  type="checkbox"
                  [checked]="isSelected(repo)"
                  (change)="toggleSelection(repo)"
                  [disabled]="repo.isImported"
                  class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {{ repo.fullName }}
                    </span>
                    @if (repo.isImported) {
                      <span class="flex-shrink-0 px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">
                        Imported
                      </span>
                    }
                    @if (repo['private']) {
                      <ng-icon name="lucideLock" size="12" class="flex-shrink-0 text-slate-400" />
                    }
                  </div>
                  @if (repo.description) {
                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{{ repo.description }}</p>
                  }
                  <div class="flex items-center gap-3 mt-1">
                    @if (repo.language) {
                      <span class="text-xs text-slate-400">{{ repo.language }}</span>
                    }
                    <span class="text-xs text-slate-400">{{ repo.defaultBranch }}</span>
                  </div>
                </div>
              </label>
            }
          </div>

          <!-- Import actions -->
          @if (selectedIds().length > 0) {
            <div class="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
              <span class="text-xs text-slate-500 dark:text-slate-400">
                {{ selectedIds().length }} selected
              </span>
              <button
                (click)="importSelected()"
                [disabled]="isImporting()"
                class="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                @if (isImporting()) {
                  <ng-icon name="lucideLoader" size="14" class="animate-spin" />
                  <span>Importing...</span>
                } @else {
                  <ng-icon name="lucideDownload" size="14" />
                  <span>Import Selected</span>
                }
              </button>
            </div>
          }

          <!-- Import result -->
          @if (importResult()) {
            <div class="p-3 rounded-lg border"
              [class]="importResult()!.failed > 0
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'"
            >
              <div class="flex items-center gap-2">
                <ng-icon name="lucideCheckCircle" size="16"
                  [class]="importResult()!.failed > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-green-600 dark:text-green-400'" />
                <p class="text-xs font-medium"
                  [class]="importResult()!.failed > 0
                    ? 'text-amber-800 dark:text-amber-300'
                    : 'text-green-800 dark:text-green-300'"
                >
                  {{ importResult()!.imported }} imported
                  @if (importResult()!.failed > 0) {
                    , {{ importResult()!.failed }} failed
                  }
                </p>
              </div>
            </div>
          }
        }
      }
    </div>
  `,
})
export class GithubAvailableReposComponent implements OnInit {
  readonly authMethod = input<'oauth_app' | 'pat' | null>(null);
  readonly imported = output<void>();

  private readonly repositoriesApi = inject(RepositoriesService);

  readonly hideHint = signal(false);

  readonly repos = signal<AvailableRepositoryDto[]>([]);
  readonly isLoading = signal(false);
  readonly isImporting = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedIds = signal<string[]>([]);
  readonly importResult = signal<{ imported: number; failed: number } | null>(null);

  searchQuery = '';

  readonly filteredRepos = computed(() => {
    const q = this.searchQuery.toLowerCase();
    if (!q) return this.repos();
    return this.repos().filter(
      r => r.fullName.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.loadRepos();
  }

  async loadRepos(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.hideHint.set(false);

    try {
      const repos = await firstValueFrom(
        this.repositoriesApi.repositoriesControllerListAvailableRepositories()
      );
      this.repos.set(repos);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Failed to load repositories.');
    } finally {
      this.isLoading.set(false);
    }
  }

  isSelected(repo: AvailableRepositoryDto): boolean {
    return this.selectedIds().includes(repo.fullName);
  }

  toggleSelection(repo: AvailableRepositoryDto): void {
    if (repo.isImported) return;
    this.selectedIds.update(ids => {
      const exists = ids.includes(repo.fullName);
      return exists ? ids.filter(id => id !== repo.fullName) : [...ids, repo.fullName];
    });
  }

  getRepoRowClass(repo: AvailableRepositoryDto): string {
    if (repo.isImported) {
      return 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-70 cursor-default';
    }
    if (this.isSelected(repo)) {
      return 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
    return 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50';
  }

  async importSelected(): Promise<void> {
    const ids = this.selectedIds();
    if (ids.length === 0) return;

    this.isImporting.set(true);
    this.importResult.set(null);

    try {
      const result = await firstValueFrom(
        this.repositoriesApi.repositoriesControllerImportRepositories({
          repositoryIds: ids,
          autoDeployEnabled: false,
        })
      );
      this.importResult.set({ imported: result.imported, failed: result.failed });
      this.selectedIds.set([]);
      // Reload to update isImported flags
      await this.loadRepos();
      this.imported.emit();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Import failed. Please try again.');
    } finally {
      this.isImporting.set(false);
    }
  }
}
