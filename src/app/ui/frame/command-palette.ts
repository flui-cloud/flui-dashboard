import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { Component, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { FlIcon } from '../primitives/icon';

export interface PaletteEntry {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly link: string;
  readonly icon: string;
  readonly keywords?: readonly string[];
}

function matches(entry: PaletteEntry, query: string): boolean {
  if (!query) return true;
  const haystack = [entry.label, entry.group, ...(entry.keywords ?? [])].join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

@Component({
  selector: 'fl-command-palette',
  imports: [FlIcon],
  providers: [provideIcons({ lucideSearch })],
  host: { class: 'fl-palette' },
  template: `
    <div class="fl-palette__search">
      <fl-icon name="lucideSearch" [size]="16" />
      <input
        type="text"
        role="combobox"
        aria-label="Search the console"
        aria-controls="fl-palette-list"
        aria-expanded="true"
        [attr.aria-activedescendant]="results().length ? 'fl-palette-' + active() : null"
        placeholder="Search pages and settings"
        autocomplete="off"
        spellcheck="false"
        (input)="onInput($event)"
        (keydown)="onKey($event)"
      />
    </div>
    <ul class="fl-palette__list" id="fl-palette-list" role="listbox" aria-label="Results">
      @for (entry of results(); track entry.id; let i = $index) {
        <li
          role="option"
          class="fl-palette__item"
          [id]="'fl-palette-' + i"
          [attr.aria-selected]="i === active()"
          (mousemove)="active.set(i)"
          (mousedown)="pick($event, entry)"
        >
          <fl-icon [name]="entry.icon" />
          <span class="fl-palette__label">{{ entry.label }}</span>
          <span class="fl-palette__group">{{ entry.group }}</span>
        </li>
      } @empty {
        <li class="fl-palette__empty" role="presentation">No page matches “{{ query() }}”.</li>
      }
    </ul>
  `,
})
export class FlCommandPalette {
  private readonly ref = inject<DialogRef<string>>(DialogRef);
  private readonly entries = inject<readonly PaletteEntry[]>(DIALOG_DATA);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly results = computed(() =>
    this.entries.filter((e) => matches(e, this.query().trim())).slice(0, 12),
  );

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.active.set((this.active() + 1) % count);
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.active.set((this.active() - 1 + count) % count);
    } else if (event.key === 'Enter') {
      const entry = this.results()[this.active()];
      if (entry) this.choose(entry);
    }
  }

  protected pick(event: MouseEvent, entry: PaletteEntry): void {
    event.preventDefault();
    this.choose(entry);
  }

  protected choose(entry: PaletteEntry): void {
    this.ref.close(entry.link);
  }
}

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly dialog = inject(Dialog);
  private open = false;

  async pick(entries: readonly PaletteEntry[]): Promise<string | undefined> {
    if (this.open) return undefined;
    this.open = true;
    const ref = this.dialog.open<string, readonly PaletteEntry[]>(FlCommandPalette, {
      data: entries,
      backdropClass: 'fl-backdrop',
      panelClass: 'fl-palette-pane',
      ariaLabel: 'Search',
      autoFocus: 'first-tabbable',
    });
    const link = await firstValueFrom(ref.closed);
    this.open = false;
    return link;
  }
}
