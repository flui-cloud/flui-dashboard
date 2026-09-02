import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  ViewChild,
} from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';
import { hlm } from '@spartan-ng/brain/core';
import { BrnSidebarSearchService } from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';

@Component({
  selector: 'hlm-sidebar-search',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideSearch, lucideX })],
  host: {
    '[class]': '_computedClass()',
  },
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="relative flex items-center">
      <ng-icon
        name="lucideSearch"
        class="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground"
      />
      <input
        #searchInput
        type="text"
        [value]="_searchService.query()"
        (input)="onInput($event)"
        (keydown.escape)="onEscape()"
        placeholder="Search..."
        class="h-9 w-full rounded-md border border-input bg-input/30 pl-8 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        [class.pr-8]="_searchService.query()"
        [class.pr-3]="!_searchService.query()"
      />
      @if (_searchService.query()) {
      <button
        type="button"
        class="absolute right-2 flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
        (click)="onClear()"
      >
        <ng-icon name="lucideX" class="h-3.5 w-3.5" />
      </button>
      }
    </div>
  `,
})
export class HlmSidebarSearchComponent {
  protected readonly _searchService = inject(BrnSidebarSearchService);

  public readonly userClass = input<ClassValue>('');
  protected readonly _computedClass = computed(() => hlm('block px-3 py-2', this.userClass()));

  @ViewChild('searchInput') private readonly _searchInput!: ElementRef<HTMLInputElement>;

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this._searchService.setQuery(value);
  }

  onClear(): void {
    this._searchService.setQuery('');
    this._searchInput?.nativeElement.focus();
  }

  onEscape(): void {
    this._searchService.setQuery('');
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (event.key !== '/') return;

    const target = event.target as HTMLElement | null;
    const isEditableTarget =
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || !!target?.isContentEditable;

    if (isEditableTarget) return;

    event.preventDefault();
    this._searchInput?.nativeElement.focus();
  }
}
