import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronRight,
  lucideFolder,
  lucideKeyRound,
  lucidePlus,
  lucideSearch,
} from '@ng-icons/lucide';
import { SecretsConsoleStateService } from './secrets-console-state.service';
import { joinPath } from './secrets-format';

@Component({
  selector: 'app-secrets-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, FormsModule],
  providers: [
    provideIcons({
      lucideChevronRight,
      lucideFolder,
      lucideKeyRound,
      lucidePlus,
      lucideSearch,
    }),
  ],
  template: `
    <div class="w-full shrink-0 rounded-xl border border-border bg-card lg:w-80">
      <div class="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <ng-icon
          name="lucideSearch"
          class="h-4 w-4 shrink-0 text-muted-foreground"
        />
        <input
          type="text"
          [(ngModel)]="filter"
          (ngModelChange)="filterValue.set($event)"
          placeholder="Filter this folder…"
          class="h-7 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          (click)="s.startNew()"
          [disabled]="s.readOnly()"
          title="New secret (use a path like team/db to nest into folders)"
          class="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          <ng-icon name="lucidePlus" class="h-3.5 w-3.5" /> Secret
        </button>
      </div>
      <div
        class="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2 text-xs"
      >
        <button
          type="button"
          (click)="goTo('')"
          class="font-medium text-muted-foreground hover:text-foreground"
        >
          {{ s.server()?.mount || 'secret' }}
        </button>
        @for (seg of crumbs(); track $index) {
          <ng-icon
            name="lucideChevronRight"
            class="h-3 w-3 text-muted-foreground"
          />
          <button
            type="button"
            (click)="goTo(crumbPrefix($index))"
            class="truncate text-muted-foreground hover:text-foreground"
          >
            {{ seg }}
          </button>
        }
      </div>
      <div class="max-h-[60vh] overflow-auto p-1.5">
        @if (s.listing() && s.entries().length === 0) {
          @for (i of skel; track i) {
            <div class="mx-1 my-1.5 h-8 animate-pulse rounded-lg bg-muted/60"></div>
          }
        } @else if (filteredEntries().length === 0) {
          <p class="px-2 py-3 text-sm text-muted-foreground">
            {{ s.entries().length ? 'No match.' : 'Empty.' }}
          </p>
        } @else {
          <div class="transition-opacity" [class.opacity-50]="s.listing()">
            @for (e of filteredEntries(); track e.name) {
              <button
                type="button"
                (click)="
                  e.isFolder ? s.enterFolder(e.name) : s.openSecret(e.name)
                "
                class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
                [class.bg-muted]="
                  !e.isFolder && s.selectedPath() === join(s.prefix(), e.name)
                "
              >
                <ng-icon
                  [name]="e.isFolder ? 'lucideFolder' : 'lucideKeyRound'"
                  class="h-4 w-4 shrink-0"
                  [class.text-amber-500]="e.isFolder"
                  [class.text-muted-foreground]="!e.isFolder"
                />
                <span class="truncate font-mono text-foreground">{{ e.name }}</span>
                @if (e.isFolder) {
                  <ng-icon
                    name="lucideChevronRight"
                    class="ml-auto h-3.5 w-3.5 text-muted-foreground"
                  />
                }
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class SecretsTreeComponent {
  protected readonly s = inject(SecretsConsoleStateService);

  readonly skel = [0, 1, 2, 3, 4];
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

  protected readonly join = joinPath;

  crumbs(): string[] {
    return this.s.prefix().split('/').filter(Boolean);
  }
  crumbPrefix(index: number): string {
    return this.crumbs().slice(0, index + 1).join('/');
  }
  goTo(prefix: string): void {
    this.s.navigate(prefix);
  }
}
