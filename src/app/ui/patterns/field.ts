import { Component, input } from '@angular/core';

@Component({
  selector: 'fl-field',
  host: { class: 'fl-field', '[class.is-invalid]': '!!error()' },
  template: `
    <label class="fl-field__label" [attr.for]="for()" [attr.id]="for() + '-label'">{{
      label()
    }}</label>
    <ng-content />
    @if (error()) {
      <span class="fl-field__error" role="alert">{{ error() }}</span>
    } @else if (hint()) {
      <span class="fl-field__hint">{{ hint() }}</span>
    }
  `,
})
export class FlField {
  readonly label = input.required<string>();
  readonly for = input.required<string>();
  readonly hint = input<string>();
  readonly error = input<string | null>(null);
}
