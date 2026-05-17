import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

const PALETTE = [
  'bg-rose-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
];

@Component({
  selector: 'app-catalog-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (iconUrl() && !imageFailed()) {
      <div [class]="containerClass() + ' bg-white dark:bg-white/90 ring-1 ring-border'">
        <img
          [src]="iconUrl()"
          [alt]="name() + ' icon'"
          class="h-full w-full object-contain p-2"
          (error)="onImageError()"
        />
      </div>
    } @else {
      <div
        [class]="
          containerClass() +
          ' bg-muted flex items-center justify-center text-white font-semibold ' +
          paletteClass()
        "
      >
        <span [class]="textSizeClass()">{{ initials() }}</span>
      </div>
    }
  `,
})
export class CatalogIconComponent {
  readonly slug = input.required<string>();
  readonly name = input.required<string>();
  readonly iconUrl = input<string | undefined>(undefined);
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');

  private readonly _imageFailed = signal(false);
  readonly imageFailed = this._imageFailed.asReadonly();

  readonly initials = computed(() => {
    const source = this.name().trim();
    if (!source) return '??';
    const parts = source.split(/[\s\-_/]+/).filter(Boolean);
    const letters =
      parts.length >= 2
        ? `${parts[0][0]}${parts[1][0]}`
        : source.slice(0, 2);
    return letters.toUpperCase();
  });

  readonly paletteClass = computed(() => {
    const hash = this.hashSlug(this.slug());
    return PALETTE[hash % PALETTE.length];
  });

  readonly containerClass = computed(() => {
    const base = 'rounded-xl overflow-hidden shrink-0';
    switch (this.size()) {
      case 'sm':
        return `${base} h-9 w-9`;
      case 'lg':
        return `${base} h-16 w-16`;
      case 'xl':
        return `${base} h-24 w-24`;
      default:
        return `${base} h-12 w-12`;
    }
  });

  readonly textSizeClass = computed(() => {
    switch (this.size()) {
      case 'sm':
        return 'text-xs';
      case 'lg':
        return 'text-xl';
      case 'xl':
        return 'text-3xl';
      default:
        return 'text-sm';
    }
  });

  onImageError(): void {
    this._imageFailed.set(true);
  }

  private hashSlug(slug: string): number {
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
      hash = (hash << 5) - hash + slug.codePointAt(i)!;
      hash = Math.trunc(hash);
    }
    return Math.abs(hash);
  }
}
