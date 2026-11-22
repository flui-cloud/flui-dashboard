import { Component, computed, input, signal } from '@angular/core';

type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const BOX: Record<IconSize, string> = {
  xs: 'h-5 w-5 rounded-fl-sm',
  sm: 'h-9 w-9 rounded-fl-md',
  md: 'h-12 w-12 rounded-fl-md',
  lg: 'h-16 w-16 rounded-fl-lg',
  xl: 'h-24 w-24 rounded-fl-lg',
};

const PAD: Record<IconSize, string> = {
  xs: 'p-0.5',
  sm: 'p-1',
  md: 'p-1.5',
  lg: 'p-2',
  xl: 'p-3',
};

const TEXT: Record<IconSize, string> = {
  xs: 'text-fl-overline',
  sm: 'text-fl-caption',
  md: 'text-fl-body-sm',
  lg: 'text-fl-section-title',
  xl: 'text-fl-page-title',
};

@Component({
  selector: 'app-catalog-icon',
  host: { class: 'inline-flex shrink-0' },
  template: `
    @if (iconUrl() && !imageFailed()) {
      <span
        class="flex items-center justify-center overflow-hidden border border-fl-border bg-fl-surface"
        [class]="box()"
      >
        <img
          [src]="iconUrl()"
          [alt]="name() + ' icon'"
          class="h-full w-full object-contain"
          [class]="pad()"
          (error)="onImageError()"
        />
      </span>
    } @else {
      <span
        class="flex items-center justify-center overflow-hidden border border-fl-border bg-fl-surface-subtle font-semibold text-fl-ink-secondary"
        [class]="box() + ' ' + text()"
        aria-hidden="true"
        >{{ size() === 'xs' ? initials().charAt(0) : initials() }}</span
      >
    }
  `,
})
export class CatalogIconComponent {
  readonly slug = input.required<string>();
  readonly name = input.required<string>();
  readonly iconUrl = input<string | undefined>(undefined);
  readonly size = input<IconSize>('md');

  private readonly _imageFailed = signal(false);
  readonly imageFailed = this._imageFailed.asReadonly();

  readonly initials = computed(() => {
    const source = this.name().trim();
    if (!source) return '??';
    const parts = source.split(/[\s\-_/]+/).filter(Boolean);
    const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
    return letters.toUpperCase();
  });

  protected readonly box = computed(() => BOX[this.size()]);
  protected readonly pad = computed(() => PAD[this.size()]);
  protected readonly text = computed(() => TEXT[this.size()]);

  onImageError(): void {
    this._imageFailed.set(true);
  }
}
