import { Component, HostListener, computed, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideChevronDown, lucideChevronUp, lucideSearch } from '@ng-icons/lucide';
import { AssistantModelSelectionService, EnrichedOption } from '../../service/assistant-model-selection.service';

@Component({
  selector: 'app-assistant-model-picker',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCheck, lucideChevronDown, lucideChevronUp, lucideSearch })],
  styles: [':host { display: contents; }'],
  template: `
    <div class="relative min-w-0" (click)="$event.stopPropagation()">
      @if (sel.pickerOptions().length > 1) {
        <button type="button" (click)="pickerOpen.set(!pickerOpen())"
          class="flex max-w-[220px] items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none">
          <span class="truncate">{{ sel.selectedLabel() }}</span>
          <ng-icon name="lucideChevronDown" class="h-3 w-3 shrink-0 transition-transform" [class.rotate-180]="pickerOpen()" />
        </button>
        @if (pickerOpen()) {
          <div class="absolute bottom-full left-0 mb-2 w-80 max-h-[360px] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-popover shadow-xl z-50 text-xs">
            <button type="button" (click)="select(0)"
              class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
              [class.bg-accent]="sel.selectedIdx() === 0">
              <div class="flex-1 min-w-0">
                <div class="font-medium text-foreground">Default (auto)</div>
                @if (sel.defaultModelLabel()) {
                  <div class="text-muted-foreground truncate">{{ sel.defaultModelLabel() }}</div>
                }
              </div>
              @if (sel.selectedIdx() === 0) {
                <ng-icon name="lucideCheck" class="h-3 w-3 text-blue-500 shrink-0" />
              }
            </button>
            @if (sel.featuredOptions().length) {
              <div class="h-px bg-border/60 mx-2"></div>
              @for (opt of sel.featuredOptions(); track opt.idx) {
                <button type="button" (click)="select(opt.idx)"
                  class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
                  [class.bg-accent]="sel.selectedIdx() === opt.idx">
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-foreground truncate">
                      @if (opt.provider) {
                        <span class="font-normal text-muted-foreground">{{ opt.provider }} — </span>
                      }{{ opt.modelId }}
                    </div>
                    @if (opt.description) {
                      <div class="text-muted-foreground truncate">{{ opt.description }}</div>
                    }
                    @if (opt.note) {
                      <div class="mt-1">
                        <span class="inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">{{ opt.note }}</span>
                      </div>
                    }
                  </div>
                  @if (sel.selectedIdx() === opt.idx) {
                    <ng-icon name="lucideCheck" class="h-3 w-3 text-blue-500 shrink-0" />
                  }
                </button>
              }
            }
            @if (sel.otherOptions().length) {
              <div class="h-px bg-border/60 mx-2"></div>
              <button type="button" (click)="pickerExpanded.set(!pickerExpanded())"
                class="w-full flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <ng-icon [name]="pickerExpanded() ? 'lucideChevronUp' : 'lucideChevronDown'" class="h-3 w-3 shrink-0" />
                {{ pickerExpanded() ? 'Show fewer' : sel.otherOptions().length + ' more' }}
              </button>
              @if (pickerExpanded()) {
                <div class="sticky top-0 z-10 bg-popover px-2 py-1.5">
                  <div class="relative">
                    <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input type="text" [value]="pickerSearch()" (input)="onSearch($event)"
                      placeholder="Search models…"
                      class="w-full rounded-md border border-input bg-muted/50 pl-7 pr-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                </div>
                @if (pickerSearch().trim()) {
                  @for (opt of filteredOtherOptions(); track opt.idx) {
                    <button type="button" (click)="select(opt.idx)"
                      class="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent transition-colors"
                      [class.bg-accent]="sel.selectedIdx() === opt.idx">
                      <div class="flex-1 min-w-0 truncate text-foreground">{{ opt.label }}</div>
                      @if (sel.selectedIdx() === opt.idx) {
                        <ng-icon name="lucideCheck" class="h-3 w-3 text-blue-500 shrink-0" />
                      }
                    </button>
                  } @empty {
                    <div class="px-3 py-2 text-xs text-muted-foreground">No models match.</div>
                  }
                } @else {
                  @for (group of sel.otherGroups(); track group.key) {
                    <button type="button" (click)="toggleGroup(group.key)"
                      class="w-full flex items-center gap-1.5 px-3 py-1.5 text-left text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                      <ng-icon [name]="expandedGroups().has(group.key) ? 'lucideChevronUp' : 'lucideChevronDown'" class="h-3 w-3 shrink-0" />
                      <span class="flex-1 truncate font-medium text-foreground">{{ group.label }}</span>
                      <span class="shrink-0 text-[10px] text-muted-foreground">{{ group.options.length }}</span>
                    </button>
                    @if (expandedGroups().has(group.key)) {
                      @for (opt of group.options; track opt.idx) {
                        <button type="button" (click)="select(opt.idx)"
                          class="w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left hover:bg-accent transition-colors"
                          [class.bg-accent]="sel.selectedIdx() === opt.idx">
                          <div class="flex-1 min-w-0 truncate text-foreground">{{ opt.modelId }}</div>
                          @if (sel.selectedIdx() === opt.idx) {
                            <ng-icon name="lucideCheck" class="h-3 w-3 text-blue-500 shrink-0" />
                          }
                        </button>
                      }
                    }
                  }
                }
              }
            }
            <div class="h-px bg-border/60 mx-2"></div>
            <button type="button" (click)="manageModels()"
              class="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <span>Manage models</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class AssistantModelPickerComponent {
  protected readonly sel = inject(AssistantModelSelectionService);
  private readonly router = inject(Router);

  readonly navigated = output<void>();

  protected readonly pickerOpen = signal(false);
  protected readonly pickerExpanded = signal(false);
  protected readonly pickerSearch = signal('');
  protected readonly expandedGroups = signal(new Set<string>());

  protected readonly filteredOtherOptions = computed<EnrichedOption[]>(() => {
    const q = this.pickerSearch().trim().toLowerCase();
    if (!q) return [];
    return this.sel.otherOptions().filter((o) => (o.opts?.model ?? o.label).toLowerCase().includes(q));
  });

  @HostListener('document:click')
  protected closePicker(): void {
    this.pickerOpen.set(false);
    this.pickerSearch.set('');
  }

  protected select(idx: number): void {
    this.sel.select(idx);
    this.pickerOpen.set(false);
    this.pickerSearch.set('');
  }

  protected onSearch(e: Event): void {
    this.pickerSearch.set((e.target as HTMLInputElement).value);
  }

  protected toggleGroup(key: string): void {
    this.expandedGroups.update((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected manageModels(): void {
    this.router.navigate(['/settings'], { fragment: 'inference-connections' });
    this.pickerOpen.set(false);
    this.navigated.emit();
  }
}
