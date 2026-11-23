import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideCheck,
  lucideChevronDown,
  lucideChevronRight,
  lucideSearch,
} from '@ng-icons/lucide';
import { FlIcon } from '../../../ui/primitives/icon';
import {
  AssistantModelSelectionService,
  EnrichedOption,
} from '../../service/assistant-model-selection.service';

const OPTION =
  'flex w-full items-center gap-2 px-4 py-2 text-left text-fl-body-sm hover:bg-fl-surface-hover';
const TOGGLE =
  'flex w-full items-center gap-2 px-4 py-2 text-left text-fl-body-sm text-fl-ink-secondary hover:bg-fl-surface-hover';

@Component({
  selector: 'app-assistant-model-picker',
  imports: [FlIcon],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideCheck,
      lucideChevronDown,
      lucideChevronRight,
      lucideSearch,
    }),
  ],
  host: { class: 'block min-w-0 max-w-full', '(document:click)': 'closePicker()' },
  template: `
    <div class="relative min-w-0 max-w-full" (click)="$event.stopPropagation()">
      @if (sel.pickerOptions().length > 1) {
        <span class="fl-select-wrap">
          <button
            type="button"
            class="fl-select fl-select--sm min-w-0 max-w-56 text-left"
            aria-haspopup="listbox"
            aria-label="Model"
            [attr.aria-expanded]="pickerOpen()"
            (click)="pickerOpen.set(!pickerOpen())"
          >
            <span class="block truncate">{{ sel.selectedLabel() }}</span>
          </button>
        </span>
        @if (pickerOpen()) {
          <div
            class="fl-popover max-h-96 w-80"
            [class]="
              placement() === 'below'
                ? 'left-0 right-auto'
                : 'bottom-full left-0 right-auto top-auto mb-2'
            "
            role="dialog"
            aria-label="Choose a model"
          >
            <div class="fl-popover__body" role="listbox" aria-label="Models">
              <button
                type="button"
                role="option"
                [class]="option"
                [class.bg-fl-accent-row]="sel.selectedIdx() === 0"
                [attr.aria-selected]="sel.selectedIdx() === 0"
                (click)="select(0)"
              >
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="font-medium text-fl-ink">Default (auto)</span>
                  @if (sel.defaultModelLabel()) {
                    <span class="truncate text-fl-caption text-fl-ink-muted">{{
                      sel.defaultModelLabel()
                    }}</span>
                  }
                </span>
                @if (sel.selectedIdx() === 0) {
                  <fl-icon name="lucideCheck" [size]="14" class="text-fl-accent" />
                }
              </button>
              @if (sel.featuredOptions().length) {
                <div>
                  @for (opt of sel.featuredOptions(); track opt.idx) {
                    <button
                      type="button"
                      role="option"
                      [class]="option"
                      [class.bg-fl-accent-row]="sel.selectedIdx() === opt.idx"
                      [attr.aria-selected]="sel.selectedIdx() === opt.idx"
                      (click)="select(opt.idx)"
                    >
                      <span class="flex min-w-0 flex-1 flex-col">
                        <span class="truncate font-medium text-fl-ink">
                          @if (opt.provider) {
                            <span class="font-normal text-fl-ink-muted">{{ opt.provider }}, </span>
                          }
                          {{ opt.modelId }}
                        </span>
                        @if (opt.description) {
                          <span class="truncate text-fl-caption text-fl-ink-muted">{{
                            opt.description
                          }}</span>
                        }
                        @if (opt.note) {
                          <span class="text-fl-caption text-fl-ink-secondary">{{ opt.note }}</span>
                        }
                      </span>
                      @if (sel.selectedIdx() === opt.idx) {
                        <fl-icon name="lucideCheck" [size]="14" class="text-fl-accent" />
                      }
                    </button>
                  }
                </div>
              }
              @if (sel.otherOptions().length) {
                <div>
                  <button
                    type="button"
                    [class]="toggle"
                    [attr.aria-expanded]="pickerExpanded()"
                    (click)="pickerExpanded.set(!pickerExpanded())"
                  >
                    <fl-icon
                      [name]="pickerExpanded() ? 'lucideChevronDown' : 'lucideChevronRight'"
                      [size]="14"
                    />
                    {{ pickerExpanded() ? 'Show fewer' : sel.otherOptions().length + ' more' }}
                  </button>
                  @if (pickerExpanded()) {
                    <div class="sticky top-0 z-10 bg-fl-surface px-4 py-2">
                      <label class="fl-input">
                        <fl-icon name="lucideSearch" [size]="14" />
                        <input
                          type="text"
                          placeholder="Search models"
                          aria-label="Search models"
                          [value]="pickerSearch()"
                          (input)="onSearch($event)"
                        />
                      </label>
                    </div>
                    @if (pickerSearch().trim()) {
                      @for (opt of filteredOtherOptions(); track opt.idx) {
                        <button
                          type="button"
                          role="option"
                          [class]="option"
                          [class.bg-fl-accent-row]="sel.selectedIdx() === opt.idx"
                          [attr.aria-selected]="sel.selectedIdx() === opt.idx"
                          (click)="select(opt.idx)"
                        >
                          <span class="min-w-0 flex-1 truncate text-fl-ink">{{ opt.label }}</span>
                          @if (sel.selectedIdx() === opt.idx) {
                            <fl-icon name="lucideCheck" [size]="14" class="text-fl-accent" />
                          }
                        </button>
                      } @empty {
                        <p class="px-4 py-2 text-fl-caption text-fl-ink-muted">No models match.</p>
                      }
                    } @else {
                      @for (group of sel.otherGroups(); track group.key) {
                        <button
                          type="button"
                          [class]="toggle"
                          [attr.aria-expanded]="expandedGroups().has(group.key)"
                          (click)="toggleGroup(group.key)"
                        >
                          <fl-icon
                            [name]="
                              expandedGroups().has(group.key)
                                ? 'lucideChevronDown'
                                : 'lucideChevronRight'
                            "
                            [size]="14"
                          />
                          <span class="flex-1 truncate font-medium text-fl-ink">{{
                            group.label
                          }}</span>
                          <span class="fl-num shrink-0 text-fl-caption text-fl-ink-muted">{{
                            group.options.length
                          }}</span>
                        </button>
                        @if (expandedGroups().has(group.key)) {
                          @for (opt of group.options; track opt.idx) {
                            <button
                              type="button"
                              role="option"
                              [class]="option + ' pl-10'"
                              [class.bg-fl-accent-row]="sel.selectedIdx() === opt.idx"
                              [attr.aria-selected]="sel.selectedIdx() === opt.idx"
                              (click)="select(opt.idx)"
                            >
                              <span class="min-w-0 flex-1 truncate font-mono text-fl-ink">{{
                                opt.modelId
                              }}</span>
                              @if (sel.selectedIdx() === opt.idx) {
                                <fl-icon name="lucideCheck" [size]="14" class="text-fl-accent" />
                              }
                            </button>
                          }
                        }
                      }
                    }
                  }
                </div>
              }
            </div>
            <div class="fl-popover__footer">
              <button
                type="button"
                class="fl-link inline-flex items-center gap-1"
                (click)="manageModels()"
              >
                Manage models
                <fl-icon name="lucideArrowRight" [size]="13" />
              </button>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class AssistantModelPickerComponent {
  protected readonly sel = inject(AssistantModelSelectionService);
  private readonly router = inject(Router);

  readonly placement = input<'above' | 'below'>('above');
  readonly navigated = output<void>();

  protected readonly option = OPTION;
  protected readonly toggle = TOGGLE;

  protected readonly pickerOpen = signal(false);
  protected readonly pickerExpanded = signal(false);
  protected readonly pickerSearch = signal('');
  protected readonly expandedGroups = signal(new Set<string>());

  protected readonly filteredOtherOptions = computed<EnrichedOption[]>(() => {
    const q = this.pickerSearch().trim().toLowerCase();
    if (!q) return [];
    return this.sel
      .otherOptions()
      .filter((o) => (o.opts?.model ?? o.label).toLowerCase().includes(q));
  });

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
