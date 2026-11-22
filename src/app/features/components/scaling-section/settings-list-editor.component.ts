import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowUp, lucidePlus, lucideX } from '@ng-icons/lucide';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { ListMove } from './group-draft';
import {
  ArchitectureBadgeComponent,
  architectureLabel,
  architectureWarning,
} from '../../../shared/components/architecture-badge.component';

/**
 * One thing that may be added, described rather than spelled.
 *
 * A provider's codes are not names: `fsn1` and `hel1` tell a reader nothing
 * about where they are, and a list of them is a quiz. `unavailable` marks
 * rather than blocks — availability moves, and the reading here is minutes old
 * at best, so a region down now may well be up when scaling next fires.
 */
export interface ListChoice {
  value: string;
  label: string;
  note?: string;
  unavailable?: boolean;
  architecture?: string | null;
  warning?: string | null;
}

@Component({
  selector: 'app-settings-list-editor',
  imports: [FormsModule, FlButton, FlIcon, ArchitectureBadgeComponent],
  providers: [provideIcons({ lucideArrowDown, lucideArrowUp, lucidePlus, lucideX })],
  host: { class: 'flex flex-col gap-2' },
  template: `
    @if (items().length) {
      <ul class="m-0 flex list-none flex-col rounded-fl-md border border-fl-border p-0">
        @for (item of items(); track item; let i = $index; let last = $last) {
          <li
            class="flex items-center gap-2 px-3 py-1.5"
            [class.border-b]="!last"
            [class.border-fl-border-subtle]="!last"
            [attr.data-testid]="kind() + '-' + item"
          >
            @if (ordered()) {
              <span class="fl-mono fl-num w-4 text-fl-ink-muted">{{ i + 1 }}</span>
            }
            <span class="fl-mono">{{ item }}</span>
            <app-architecture-badge [architecture]="architectures()[item]" />
            @if (label(item) !== item) {
              <span class="min-w-0 flex-1 truncate text-fl-caption text-fl-ink-muted">{{
                label(item)
              }}</span>
            } @else {
              <span class="flex-1"></span>
            }
            @if (ordered()) {
              <button
                flButton="ghost"
                size="sm"
                type="button"
                [iconOnly]="true"
                (click)="move.emit({ index: i, by: -1 })"
                [disabled]="i === 0"
                [attr.aria-label]="'Prefer ' + item + ' sooner'"
                [attr.data-testid]="kind() + '-up-' + item"
              >
                <fl-icon name="lucideArrowUp" [size]="14" />
              </button>
              <button
                flButton="ghost"
                size="sm"
                type="button"
                [iconOnly]="true"
                (click)="move.emit({ index: i, by: 1 })"
                [disabled]="last"
                [attr.aria-label]="'Prefer ' + item + ' later'"
                [attr.data-testid]="kind() + '-down-' + item"
              >
                <fl-icon name="lucideArrowDown" [size]="14" />
              </button>
            }
            <button
              flButton="ghost"
              size="sm"
              type="button"
              [iconOnly]="true"
              (click)="remove.emit(item)"
              [attr.aria-label]="'Remove ' + item"
              [attr.data-testid]="kind() + '-remove-' + item"
            >
              <fl-icon name="lucideX" [size]="14" />
            </button>
          </li>
        }
      </ul>
    } @else {
      <span class="text-fl-body-sm text-fl-ink-muted" [attr.data-testid]="'no-' + kind() + 's'">
        {{ emptyNote() }}
      </span>
    }

    @if (listedWarning(); as warning) {
      <span class="text-fl-caption text-fl-ink-muted" [attr.data-testid]="kind() + '-warning'">{{
        warning
      }}</span>
    }

    <span class="flex flex-wrap items-center gap-2">
      @if (choices(); as all) {
        @if (all.length) {
          <span class="fl-select-wrap">
            <select
              class="fl-select fl-select--sm"
              [ngModel]="draft()"
              (ngModelChange)="draft.set($event)"
              [attr.aria-label]="'Add a ' + kind()"
              [attr.data-testid]="kind() + '-add-select'"
            >
              <option value="">
                {{ available().length ? 'Choose…' : 'All listed' }}
              </option>
              @for (choice of all; track choice.value) {
                <option
                  [value]="choice.value"
                  [disabled]="listed(choice.value)"
                  [attr.title]="choice.warning ?? null"
                  [attr.data-testid]="kind() + '-option-' + choice.value"
                >
                  {{ optionText(choice) }}
                </option>
              }
            </select>
          </span>
        } @else {
          <span
            class="text-fl-caption text-fl-ink-muted"
            [attr.data-testid]="kind() + '-all-listed'"
          >
            {{ exhausted() }}
          </span>
        }
      } @else {
        <span class="fl-input">
          <input
            class="fl-mono"
            [placeholder]="kind()"
            [ngModel]="draft()"
            (ngModelChange)="draft.set($event)"
            (keydown.enter)="submit()"
            [attr.aria-label]="'Add a ' + kind()"
            [attr.data-testid]="kind() + '-add-input'"
          />
        </span>
      }
      <button
        flButton
        size="sm"
        type="button"
        [disabled]="!!choices() && !available().length"
        (click)="submit()"
        [attr.data-testid]="kind() + '-add'"
      >
        <fl-icon name="lucidePlus" [size]="14" />
        Add
      </button>
    </span>
  `,
})
export class SettingsListEditorComponent {
  readonly items = input.required<readonly string[]>();

  readonly kind = input.required<string>();

  readonly ordered = input(false);

  /**
   * The only values that may be added, or null where anything goes.
   *
   * An empty list is not the same as null: it means the choices are known and
   * there are none, which is a state worth saying out loud rather than one to
   * offer a free field for.
   */
  readonly choices = input<readonly ListChoice[] | null>(null);

  /** How a value already chosen should read, where a bare code would not. */
  readonly labels = input<Record<string, string>>({});

  /** The CPU architecture of a value, shown beside it where known. */
  readonly architectures = input<Record<string, string | null>>({});

  /** Said where the list of choices is known and empty. */
  readonly exhausted = input('nothing to choose from');

  readonly emptyNote = input('nothing here');

  readonly add = output<string>();
  readonly remove = output<string>();
  readonly move = output<ListMove>();

  protected readonly draft = signal('');

  protected readonly available = computed(() => {
    const all = this.choices();
    if (!all) return [];
    return all.filter((choice) => !this.items().includes(choice.value));
  });

  protected readonly listedWarning = computed(() => {
    const known = new Map(
      (this.choices() ?? []).map((choice) => [choice.value, choice.architecture]),
    );
    for (const item of this.items()) {
      const warning = architectureWarning(this.architectures()[item] ?? known.get(item));
      if (warning) return warning;
    }
    return null;
  });

  /**
   * Kept in the menu and greyed out rather than hidden: a machine missing from
   * the list reads as one that does not exist.
   */
  protected listed(value: string): boolean {
    return this.items().includes(value);
  }

  protected label(value: string): string {
    return this.labels()[value] ?? value;
  }

  protected optionText(choice: ListChoice): string {
    const marks = [
      architectureLabel(choice.architecture),
      choice.note,
      choice.unavailable ? 'unavailable' : null,
      this.listed(choice.value) ? 'already in the list' : null,
    ].filter(Boolean);
    return marks.length ? `${choice.label} — ${marks.join(' · ')}` : choice.label;
  }

  protected submit(): void {
    const value = this.draft().trim();
    if (!value) return;
    this.draft.set('');
    this.add.emit(value);
  }
}
