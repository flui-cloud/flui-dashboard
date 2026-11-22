import { Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

export type IconSize = 13 | 14 | 16 | 18 | 20;

@Component({
  selector: 'fl-icon',
  imports: [NgIcon],
  host: { class: 'fl-icon', 'aria-hidden': 'true' },
  template: `<ng-icon [name]="name()" [size]="px()" />`,
})
export class FlIcon {
  readonly name = input.required<string>();
  readonly size = input<IconSize>(16);
  protected readonly px = computed(() => `${this.size()}px`);
}
