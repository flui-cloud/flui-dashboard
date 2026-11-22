import { Injectable, inject, signal } from '@angular/core';
import { RepositoryService } from '../../service/repository.service';
import { RepoToasts } from './repositories-toasts';
import {
  allFailedMessage,
  errorText,
  importedMessage,
  partialImportMessage,
} from './repositories-format';

@Injectable()
export class RepositoriesImportStore {
  private readonly repoService = inject(RepositoryService);
  private readonly toasts = inject(RepoToasts);

  readonly available = this.repoService.availableRepositories;
  readonly isOpen = signal(false);
  readonly loadingAvailable = signal(false);
  readonly selected = signal<string[]>([]);
  readonly importing = signal(false);

  async open(): Promise<void> {
    this.isOpen.set(true);
    this.selected.set([]);
    await this.refresh();
  }

  close(): void {
    this.isOpen.set(false);
    this.selected.set([]);
  }

  async refresh(): Promise<void> {
    this.loadingAvailable.set(true);
    try {
      await this.repoService.loadAvailableRepositories();
    } catch (error) {
      console.error('Failed to load available repositories:', error);
    } finally {
      this.loadingAvailable.set(false);
    }
  }

  toggle(fullName: string): void {
    this.selected.update((selected) =>
      selected.includes(fullName)
        ? selected.filter((r) => r !== fullName)
        : [...selected, fullName],
    );
  }

  async importSelected(): Promise<void> {
    const selected = this.selected();
    if (selected.length === 0) return;

    this.importing.set(true);
    try {
      const { imported, failed, errors } = await this.repoService.importRepositories(
        selected,
        false,
      );
      const total = selected.length;

      if (imported === total && failed === 0) {
        await this.closeAndReload();
        this.toasts.show('success', 'Repositories imported', importedMessage(imported), 5000);
      } else if (imported === 0 && failed === total) {
        this.toasts.show('error', 'Import failed', allFailedMessage(failed, errors), 15000);
      } else if (imported > 0 && failed > 0) {
        await this.closeAndReload();
        this.toasts.show(
          'warning',
          'Import partly completed',
          partialImportMessage(imported, failed, errors),
          15000,
        );
      }
    } catch (error: unknown) {
      console.error('Failed to import repositories:', error);
      this.toasts.show(
        'error',
        'Import failed',
        errorText(error, 'An unexpected error occurred while importing repositories.'),
        10000,
      );
    } finally {
      this.importing.set(false);
    }
  }

  private async closeAndReload(): Promise<void> {
    this.close();
    try {
      await this.repoService.loadRepositories();
    } catch (error) {
      console.error('Failed to load repositories:', error);
    }
  }
}
