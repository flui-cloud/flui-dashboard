import { Directive, computed, input } from '@angular/core';

export type ButtonVariant = 'secondary' | 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

@Directive({
  selector: 'button[flButton], a[flButton]',
  host: { '[class]': 'classes()' },
})
export class FlButton {
  readonly variant = input<ButtonVariant | ''>('secondary', { alias: 'flButton' });
  readonly size = input<ButtonSize>('md');
  readonly iconOnly = input(false);
  readonly block = input(false);

  protected readonly classes = computed(() => {
    const variant = this.variant() || 'secondary';
    return [
      'fl-btn',
      variant === 'secondary' ? '' : `fl-btn--${variant}`,
      this.size() === 'sm' ? 'fl-btn--sm' : '',
      this.iconOnly() ? 'fl-btn--icon' : '',
      this.block() ? 'fl-btn--block' : '',
    ]
      .filter(Boolean)
      .join(' ');
  });
}
