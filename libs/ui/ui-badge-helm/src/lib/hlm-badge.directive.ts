import type { BooleanInput } from '@angular/cdk/coercion';
import { Directive, booleanAttribute, computed, input } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { type VariantProps, cva } from 'class-variance-authority';
import type { ClassValue } from 'clsx';

export const badgeVariants = cva(
  'inline-flex h-[18px] items-center whitespace-nowrap rounded-fl-sm border px-1.5 text-[11.5px] focus:outline-none focus-visible:shadow-fl-focus',
  {
    variants: {
      variant: {
        default: 'border-fl-border bg-fl-surface text-fl-ink-secondary',
        secondary: 'border-fl-border bg-fl-surface text-fl-ink-secondary',
        destructive: 'border-fl-danger-border bg-fl-surface text-fl-danger',
        outline: 'border-fl-border bg-fl-surface text-fl-ink-secondary',
      },
      size: {
        default: '',
        lg: 'h-5 text-fl-caption',
      },
      static: { true: '', false: '' },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      static: false,
    },
  },
);
export type BadgeVariants = VariantProps<typeof badgeVariants>;

@Directive({
  selector: '[hlmBadge]',
  standalone: true,
  host: {
    '[class]': '_computedClass()',
  },
})
export class HlmBadgeDirective {
  protected readonly _computedClass = computed(() =>
    hlm(
      badgeVariants({ variant: this.variant(), size: this.size(), static: this.static() }),
      this.userClass(),
    ),
  );

  public readonly userClass = input<ClassValue>('', { alias: 'class' });
  public readonly variant = input<BadgeVariants['variant']>('default');
  public readonly static = input<BadgeVariants['static'], BooleanInput>(false, {
    transform: booleanAttribute,
  });
  public readonly size = input<BadgeVariants['size']>('default');
}
