import { Component, input, output } from '@angular/core';

export interface ChoiceOption<T extends string> {
  value: T;
  title: string;
  description: string;
  disabled?: boolean;
  tooltip?: string;
}

let nextGroup = 0;

@Component({
  selector: 'app-endpoint-choice-group',
  host: { class: 'block' },
  template: `
    <fieldset class="fl-fieldset">
      <legend>{{ legend() }}</legend>
      <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
        @for (option of options(); track option.value) {
          <label
            class="fl-radiocard"
            [class.is-checked]="option.value === value()"
            [class.opacity-50]="option.disabled"
            [class.cursor-not-allowed]="option.disabled"
            [attr.title]="option.tooltip || null"
          >
            <input
              type="radio"
              [name]="name"
              [value]="option.value"
              [checked]="option.value === value()"
              [disabled]="!!option.disabled"
              (change)="valueChange.emit(option.value)"
            />
            <span class="fl-radiocard__text">
              <span class="fl-radiocard__title">{{ option.title }}</span>
              <span class="fl-radiocard__desc">{{ option.description }}</span>
            </span>
          </label>
        }
      </div>
      <ng-content />
    </fieldset>
  `,
})
export class EndpointChoiceGroup<T extends string> {
  readonly legend = input.required<string>();
  readonly options = input.required<readonly ChoiceOption<T>[]>();
  readonly value = input.required<T>();
  readonly valueChange = output<T>();
  protected readonly name = `endpoint-choice-${nextGroup++}`;
}
