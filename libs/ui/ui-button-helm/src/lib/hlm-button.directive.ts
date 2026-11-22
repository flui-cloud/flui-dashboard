import { Directive, computed, input, signal } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { type VariantProps, cva } from 'class-variance-authority';
import type { ClassValue } from 'clsx';
import { injectBrnButtonConfig } from './hlm-button.token';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-fl-md border text-fl-body-sm focus-visible:outline-none focus-visible:shadow-fl-focus disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default:
          'border-fl-accent bg-fl-accent font-medium text-fl-on-accent hover:border-fl-accent-strong hover:bg-fl-accent-strong',
        destructive:
          'border-fl-danger bg-fl-danger font-medium text-fl-on-accent hover:brightness-95',
        outline: 'border-fl-border-button bg-fl-surface text-fl-ink hover:bg-fl-surface-hover',
        secondary: 'border-fl-border-button bg-fl-surface text-fl-ink hover:bg-fl-surface-hover',
        ghost:
          'border-transparent text-fl-ink-secondary hover:bg-fl-surface-hover hover:text-fl-ink',
        link: 'border-transparent font-medium text-fl-accent underline-offset-4 hover:text-fl-accent-strong hover:underline',
      },
      size: {
        default: 'h-[var(--fl-control-height)] px-3',
        sm: 'h-[var(--fl-control-height-sm)] px-3',
        lg: 'h-[var(--fl-control-height)] px-4',
        icon: 'h-[var(--fl-control-height)] w-[var(--fl-control-height)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
export type ButtonVariants = VariantProps<typeof buttonVariants>;

@Directive({
  selector: '[hlmBtn]',
  standalone: true,
  exportAs: 'hlmBtn',
  host: {
    '[class]': '_computedClass()',
  },
})
export class HlmButtonDirective {
  private readonly _config = injectBrnButtonConfig();

  private readonly _additionalClasses = signal<ClassValue>('');

  public readonly userClass = input<ClassValue>('', { alias: 'class' });

  protected readonly _computedClass = computed(() =>
    hlm(
      buttonVariants({ variant: this.variant(), size: this.size() }),
      this.userClass(),
      this._additionalClasses(),
    ),
  );

  public readonly variant = input<ButtonVariants['variant']>(this._config.variant);

  public readonly size = input<ButtonVariants['size']>(this._config.size);

  setClass(classes: string): void {
    this._additionalClasses.set(classes);
  }
}
