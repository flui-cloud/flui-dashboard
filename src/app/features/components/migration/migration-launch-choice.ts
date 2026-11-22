import { Component, computed, input, model } from '@angular/core';
import { LaunchOption } from './migration-launch-options';

@Component({
  selector: 'app-migration-launch-choice',
  host: { class: 'block' },
  template: `
    <fieldset class="fl-fieldset">
      <legend>{{ legend() }}</legend>
      <div [class]="grid()">
        @for (option of options(); track option.value) {
          <label class="fl-radiocard" [attr.data-testid]="name() + '-' + option.value">
            <input
              type="radio"
              [name]="name()"
              [value]="option.value"
              [checked]="value() === option.value"
              (change)="value.set(option.value)"
            />
            <span class="fl-radiocard__text">
              <span class="fl-radiocard__title">{{ option.label }}</span>
              <span class="fl-radiocard__desc">{{ option.description }}</span>
            </span>
          </label>
        }
      </div>
    </fieldset>
  `,
})
export class MigrationLaunchChoice<T extends string> {
  readonly legend = input.required<string>();
  readonly name = input.required<string>();
  readonly options = input.required<readonly LaunchOption<T>[]>();
  readonly value = model.required<T>();
  protected readonly grid = computed(() =>
    this.options().length > 2 ? 'grid gap-2 sm:grid-cols-3' : 'grid gap-2 sm:grid-cols-2',
  );
}
