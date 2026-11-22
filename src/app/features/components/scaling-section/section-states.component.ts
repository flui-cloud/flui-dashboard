import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideRotateCw } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-section-skeleton',
  imports: [FlLoadingState],
  host: { class: 'block' },
  template: `
    <fl-loading-state [rows]="rows()" [attr.data-testid]="'skeleton-' + testid()" />
    <span class="fl-sr">Loading {{ label() }}</span>
  `,
})
export class SectionSkeletonComponent {
  readonly variant = input<'cards' | 'table' | 'lines'>('lines');
  readonly count = input(3);
  readonly label = input('');
  readonly testid = input('block');

  protected readonly rows = computed(() =>
    this.variant() === 'table' ? this.count() + 1 : this.count(),
  );
}

@Component({
  selector: 'app-section-failure',
  imports: [FlAlert, FlButton, FlIcon],
  providers: [provideIcons({ lucideRotateCw })],
  host: { class: 'block' },
  template: `
    <fl-alert tone="error" title="Could not load" [attr.data-testid]="'failure-' + testid()">
      <span class="block">{{ message() }}</span>
      <span class="block">Nothing on the cluster changed. Only the reading is missing.</span>
      <button
        alertActions
        flButton
        size="sm"
        type="button"
        [attr.data-testid]="'retry-' + testid()"
        (click)="retry.emit()"
      >
        <fl-icon name="lucideRotateCw" [size]="14" />
        Try again
      </button>
    </fl-alert>
  `,
})
export class SectionFailureComponent {
  readonly message = input.required<string>();
  readonly testid = input('block');
  readonly retry = output<void>();
}
