import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronRight,
  lucideFolder,
  lucideKeyRound,
  lucidePlus,
  lucideSearch,
} from '@ng-icons/lucide';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { SecretsConsoleStateService } from './secrets-console-state.service';
import { joinPath } from './secrets-format';

@Component({
  selector: 'app-secrets-tree',
  imports: [FormsModule, FlButton, FlEmptyState, FlIcon, FlLoadingState, FlPanel],
  providers: [
    provideIcons({ lucideChevronRight, lucideFolder, lucideKeyRound, lucidePlus, lucideSearch }),
  ],
  host: { class: 'block' },
  template: `
    <fl-panel title="Secrets" [count]="s.entries().length" [flush]="true">
      <button
        panelActions
        flButton="ghost"
        size="sm"
        type="button"
        [disabled]="s.readOnly()"
        title="Use a path like team/db to nest into folders"
        (click)="s.startNew()"
      >
        <fl-icon name="lucidePlus" [size]="14" />
        New
      </button>

      <div panelToolbar class="flex flex-col gap-2 border-b border-fl-border px-4 py-3">
        <label class="fl-input">
          <fl-icon name="lucideSearch" [size]="14" />
          <span class="fl-sr">Filter this folder</span>
          <input
            type="text"
            placeholder="Filter this folder"
            [(ngModel)]="filter"
            (ngModelChange)="filterValue.set($event)"
          />
        </label>
        <nav class="fl-row text-fl-caption" aria-label="Secret path">
          <button type="button" class="fl-link fl-mono" (click)="goTo('')">
            {{ s.server()?.mount || 'secret' }}
          </button>
          @for (seg of crumbs(); track $index; let last = $last) {
            <span class="text-fl-ink-muted" aria-hidden="true">/</span>
            <button
              type="button"
              class="fl-link fl-mono"
              [attr.aria-current]="last ? 'page' : null"
              (click)="goTo(crumbPrefix($index))"
            >
              {{ seg }}
            </button>
          }
        </nav>
      </div>

      @if (s.listing() && s.entries().length === 0) {
        <fl-loading-state [rows]="5" />
      } @else if (filteredEntries().length === 0) {
        <fl-empty-state
          [compact]="true"
          [title]="s.entries().length ? 'No match' : 'This folder is empty'"
        />
      } @else {
        <ul class="max-h-screen overflow-auto py-1" [attr.aria-busy]="s.listing()">
          @for (e of filteredEntries(); track e.name) {
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-2 px-4 py-2 text-left text-fl-body-sm hover:bg-fl-surface-hover"
                [class.bg-fl-accent-soft]="isSelected(e)"
                [attr.aria-current]="isSelected(e) ? 'true' : null"
                (click)="e.isFolder ? s.enterFolder(e.name) : s.openSecret(e.name)"
              >
                <fl-icon
                  class="text-fl-ink-muted"
                  [name]="e.isFolder ? 'lucideFolder' : 'lucideKeyRound'"
                  [size]="14"
                />
                <span class="fl-mono min-w-0 flex-1 truncate">{{ e.name }}</span>
                @if (e.isFolder) {
                  <fl-icon class="text-fl-ink-muted" name="lucideChevronRight" [size]="14" />
                }
              </button>
            </li>
          }
        </ul>
      }
    </fl-panel>
  `,
})
export class SecretsTreeComponent {
  protected readonly s = inject(SecretsConsoleStateService);

  filter = '';
  protected readonly filterValue = signal('');

  constructor() {
    effect(() => {
      this.s.navSeq();
      this.filter = '';
      this.filterValue.set('');
    });
  }

  readonly filteredEntries = computed(() => {
    const f = this.filterValue().trim().toLowerCase();
    const es = this.s.entries();
    return f ? es.filter((e) => e.name.toLowerCase().includes(f)) : es;
  });

  protected isSelected(e: { name: string; isFolder: boolean }): boolean {
    return !e.isFolder && this.s.selectedPath() === joinPath(this.s.prefix(), e.name);
  }

  crumbs(): string[] {
    return this.s.prefix().split('/').filter(Boolean);
  }
  crumbPrefix(index: number): string {
    return this.crumbs()
      .slice(0, index + 1)
      .join('/');
  }
  goTo(prefix: string): void {
    this.s.navigate(prefix);
  }
}
