import { Directive, computed, input } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { type VariantProps, cva } from 'class-variance-authority';
import type { ClassValue } from 'clsx';

export const cardVariants = cva(
  'rounded-fl-lg border border-fl-border bg-fl-surface text-fl-ink focus:outline-none focus-visible:shadow-fl-focus',
  {
    variants: {},
    defaultVariants: {},
  },
);
export type CardVariants = VariantProps<typeof cardVariants>;

@Directive({
  selector: '[hlmCard]',
  standalone: true,
  host: {
    '[class]': '_computedClass()',
  },
})
export class HlmCardDirective {
  public readonly userClass = input<ClassValue>('', { alias: 'class' });
  protected _computedClass = computed(() => hlm(cardVariants(), this.userClass()));
}
