import { Component, computed, input, output } from '@angular/core';
import { categoryLabel } from './catalog-view';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-catalog-list-toolbar',
  imports: [FormsModule, FlButton, FlIcon],
  providers: [provideIcons({ lucideSearch, lucideX })],
  host: { class: 'fl-toolbar', role: 'toolbar', 'aria-label': 'Filters' },
  template: `
    <div class="fl-toolbar__group">
      <label class="fl-input">
        <fl-icon name="lucideSearch" [size]="14" />
        <span class="fl-sr">Search apps</span>
        <input
          type="search"
          aria-label="Search apps"
          placeholder="Search by name, tag or alternative"
          [ngModel]="search()"
          (ngModelChange)="searchChange.emit($event)"
        />
        @if (search()) {
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [iconOnly]="true"
            aria-label="Clear search"
            (click)="searchChange.emit('')"
          >
            <fl-icon name="lucideX" />
          </button>
        }
      </label>
      @if (categories().length > 0) {
        <span class="fl-select-wrap">
          <select
            class="fl-select fl-select--sm"
            aria-label="Category"
            [ngModel]="category() ?? ''"
            (ngModelChange)="categoryChange.emit($event || null)"
          >
            <option value="">Category: All</option>
            @for (cat of categories(); track cat) {
              <option [value]="cat">{{ categoryLabel(cat) }}</option>
            }
          </select>
        </span>
      }
      @if (tagOptions().length > 0) {
        <span class="fl-select-wrap">
          <select
            #tagSelect
            class="fl-select fl-select--sm"
            aria-label="Add a tag filter"
            (change)="addTag(tagSelect)"
          >
            <option value="">Tag: Any</option>
            @for (tag of tagOptions(); track tag) {
              <option [value]="tag">{{ tag }}</option>
            }
          </select>
        </span>
      }
      @if (activeTags().length > 0) {
        <div class="fl-row" role="group" aria-label="Active tags">
          @for (tag of activeTags(); track tag) {
            <button
              type="button"
              class="fl-chip"
              aria-pressed="true"
              [attr.aria-label]="'Remove tag ' + tag"
              (click)="tagToggle.emit(tag)"
            >
              {{ tag }}
              <fl-icon name="lucideX" [size]="13" />
            </button>
          }
          <button flButton="ghost" size="sm" type="button" (click)="tagsClear.emit()">
            Clear tags
          </button>
        </div>
      }
    </div>
    <div class="fl-toolbar__group">
      @if (systemToggle()) {
        <button flButton="ghost" size="sm" type="button" (click)="systemToggled.emit()">
          {{ showSystemApps() ? 'Hide' : 'Show' }} system apps
        </button>
      }
      <span class="fl-toolbar__info"
        >{{ resultCount() }} {{ resultCount() === 1 ? 'app' : 'apps' }}</span
      >
    </div>
  `,
})
export class CatalogListToolbar {
  protected readonly categoryLabel = categoryLabel;
  readonly search = input('');
  readonly category = input<string | null>(null);
  readonly categories = input<readonly string[]>([]);
  readonly tags = input<readonly string[]>([]);
  readonly activeTags = input<readonly string[]>([]);
  readonly resultCount = input(0);
  readonly systemToggle = input(false);
  readonly showSystemApps = input(false);

  readonly searchChange = output<string>();
  readonly categoryChange = output<string | null>();
  readonly tagToggle = output<string>();
  readonly tagsClear = output<void>();
  readonly systemToggled = output<void>();

  protected readonly tagOptions = computed(() => {
    const active = new Set(this.activeTags());
    return this.tags().filter((t) => !active.has(t));
  });

  protected addTag(select: HTMLSelectElement): void {
    const tag = select.value;
    select.value = '';
    if (tag) this.tagToggle.emit(tag);
  }
}
