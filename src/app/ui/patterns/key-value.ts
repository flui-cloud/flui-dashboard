import { Component, input } from '@angular/core';

@Component({
  selector: 'fl-key-value',
  host: { class: 'fl-kv' },
  template: `<ng-content />`,
})
export class FlKeyValue {}

@Component({
  selector: 'fl-kv-item',
  host: { class: 'fl-kv__item' },
  template: `
    <span class="fl-kv__key">{{ key() }}</span>
    <span class="fl-kv__value" [class.fl-mono]="mono()"><ng-content /></span>
  `,
})
export class FlKvItem {
  readonly key = input.required<string>();
  readonly mono = input(false);
}
