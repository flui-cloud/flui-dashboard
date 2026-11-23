import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-provider-mark',
  template: `
    <span
      class="inline-flex shrink-0 select-none items-center justify-center rounded-fl-md border border-fl-border bg-fl-surface font-semibold leading-none text-fl-ink-secondary"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.font-size.px]="size() * 0.5"
      [attr.aria-label]="name()"
      role="img"
      >{{ initial() }}</span
    >
  `,
})
export class ProviderMarkComponent {
  name = input.required<string>();
  size = input(24);

  readonly initial = computed(() => (this.name().trim().charAt(0) || '?').toUpperCase());
}
