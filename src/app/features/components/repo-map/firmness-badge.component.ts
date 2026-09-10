import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type FirmnessLevel = 'declared' | 'derived' | 'circumstantial';

@Component({
  selector: 'app-firmness-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium leading-none"
      [class]="classes()"
      [attr.title]="hint()"
    >
      {{ label() }}
    </span>
  `,
})
export class FirmnessBadgeComponent {
  readonly level = input.required<FirmnessLevel>();

  readonly label = computed(() => {
    switch (this.level()) {
      case 'declared': return 'declared';
      case 'derived': return 'derived';
      default: return 'circumstantial';
    }
  });

  readonly hint = computed(() => {
    switch (this.level()) {
      case 'declared':
        return 'The repository states this directly (a Dockerfile line, a config key, a lockfile entry).';
      case 'derived':
        return 'Computed from other declared facts, not read directly.';
      default:
        return 'A weak signal — a library import, a filename pattern. Worth checking before you trust it.';
    }
  });

  readonly classes = computed(() => {
    switch (this.level()) {
      case 'declared':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'derived':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400';
      default:
        return 'bg-amber-50 text-amber-800 border border-dashed border-amber-400 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700';
    }
  });
}
