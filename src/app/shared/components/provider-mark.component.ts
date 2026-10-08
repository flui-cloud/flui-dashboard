import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Providers are shown by name only: their logos are trademarks whose owners restrict use in third-party products.
@Component({
  selector: 'app-provider-mark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center justify-center shrink-0 rounded-md border border-border bg-muted text-muted-foreground font-semibold leading-none select-none"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.font-size.px]="size() * 0.5"
      [attr.aria-label]="name()"
      role="img"
    >{{ initial() }}</span>
  `,
})
export class ProviderMarkComponent {
  name = input.required<string>();
  size = input(24);

  readonly initial = computed(() => (this.name().trim().charAt(0) || '?').toUpperCase());
}
