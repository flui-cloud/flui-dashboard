import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucidePinOff } from '@ng-icons/lucide';
import { hlm } from '@spartan-ng/brain/core';
import { HighlightSegment, splitLabelByQuery } from './utils/highlight-segments';
import { BrnSidebarPinService, BrnSidebarSearchService, SidebarNavItem } from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';

interface PinnedRow {
  item: SidebarNavItem;
  id: string;
  segments: HighlightSegment[];
}

function itemId(item: SidebarNavItem): string {
  return item.id || item.link;
}

@Component({
  selector: 'hlm-sidebar-pinned',
  standalone: true,
  imports: [RouterModule, NgIconComponent],
  providers: [provideIcons({ lucidePinOff })],
  host: {
    '[class]': '_computedClass()',
  },
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (_rows().length > 0) {
    <div class="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      Pinned
    </div>
    <div class="flex flex-col gap-1 px-3 pb-2">
      @for (row of _rows(); track row.id) {
      <div class="group relative flex h-9 w-full items-center">
        <a
          [attr.href]="row.item.link ? null : 'javascript:void(0)'"
          [routerLink]="row.item.link || null"
          [routerLinkActive]="row.item.routerLinkActive || ''"
          class="relative flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 pl-2"
        >
          @if (row.item.icon) {
          <ng-icon [name]="row.item.icon" class="h-4 w-4 shrink-0 text-muted-foreground" />
          }
          <!-- kept on one line, no whitespace between segments: a newline/indent
          between branches renders as a literal space, splitting the label apart -->
          <span class="text-foreground overflow-hidden truncate text-sm">@for (segment of row.segments; track $index) {@if (segment.matched) {<mark class="rounded-sm bg-primary/30 text-inherit">{{ segment.text }}</mark>} @else {{{ segment.text }}}}</span>
        </a>
        <button
          type="button"
          class="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
          (click)="onUnpin($event, row.id)"
        >
          <ng-icon name="lucidePinOff" class="h-3.5 w-3.5" />
        </button>
      </div>
      }
    </div>
    }
  `,
})
export class HlmSidebarPinnedComponent {
  private readonly _pinService = inject(BrnSidebarPinService);
  private readonly _searchService = inject(BrnSidebarSearchService);

  public readonly items = input.required<SidebarNavItem[]>();
  public readonly userClass = input<ClassValue>('');

  protected readonly _computedClass = computed(() => hlm('flex flex-col', this.userClass()));

  protected readonly _rows = computed<PinnedRow[]>(() => {
    const pinnedIds = this._pinService.pinnedIds();
    const query = this._searchService.query();

    return this.items()
      .filter((item) => pinnedIds.includes(itemId(item)) && this._searchService.matches(item))
      .map((item) => ({
        item,
        id: itemId(item),
        segments: splitLabelByQuery(item.label, query),
      }));
  });

  onUnpin(event: Event, id: string): void {
    event.preventDefault();
    event.stopPropagation();
    this._pinService.toggle(id);
  }
}
