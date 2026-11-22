import { Component, Directive, input, model } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { FlIcon } from '../primitives/icon';

@Component({
  selector: 'fl-toolbar',
  host: { class: 'fl-toolbar', role: 'toolbar', '[attr.aria-label]': 'label()' },
  template: `
    <div class="fl-toolbar__group"><ng-content /></div>
    <div class="fl-toolbar__group"><ng-content select="[toolbarEnd]" /></div>
  `,
})
export class FlToolbar {
  readonly label = input('Filters');
}

let nextId = 0;

@Component({
  selector: 'fl-search-input',
  imports: [FlIcon],
  providers: [provideIcons({ lucideSearch })],
  host: { class: 'fl-input' },
  template: `
    <fl-icon name="lucideSearch" [size]="14" />
    <label class="fl-sr" [for]="id">{{ label() }}</label>
    <input
      [id]="id"
      type="search"
      [placeholder]="placeholder()"
      [value]="value()"
      (input)="onInput($event)"
    />
  `,
})
export class FlSearchInput {
  readonly value = model('');
  readonly label = input('Search');
  readonly placeholder = input('Search');
  protected readonly id = `fl-search-${nextId++}`;

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}

@Directive({
  selector: 'button[flChip]',
  host: {
    class: 'fl-chip',
    type: 'button',
    '[attr.aria-pressed]': 'pressed()',
    '(click)': 'pressed.set(!pressed())',
  },
})
export class FlChip {
  readonly pressed = model(false);
}

export interface SegmentOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
}

@Component({
  selector: 'fl-segmented',
  host: { class: 'fl-segmented', role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        [attr.aria-pressed]="option.value === value()"
        (click)="value.set(option.value)"
      >
        {{ option.label }}
      </button>
    }
  `,
})
export class FlSegmented {
  readonly options = input.required<readonly SegmentOption[]>();
  readonly value = model.required<string>();
  readonly label = input.required<string>();
}
