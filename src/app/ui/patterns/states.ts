import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideInbox } from '@ng-icons/lucide';
import { RemoteData } from '../../core/state/remote-data';
import { FlButton } from '../primitives/button';
import { FlIcon } from '../primitives/icon';

@Component({
  selector: 'fl-empty-state',
  imports: [FlIcon],
  providers: [provideIcons({ lucideInbox })],
  host: { class: 'fl-state', '[class.fl-state--compact]': 'compact()' },
  template: `
    <fl-icon class="fl-state__icon" [name]="icon()" [size]="20" />
    <p class="fl-state__title">{{ title() }}</p>
    @if (body()) {
      <p class="fl-state__body">{{ body() }}</p>
    }
    <div class="fl-state__actions"><ng-content /></div>
  `,
})
export class FlEmptyState {
  readonly title = input.required<string>();
  readonly body = input<string>();
  readonly icon = input('lucideInbox');
  readonly compact = input(false);
}

@Component({
  selector: 'fl-error-state',
  imports: [FlIcon, FlButton],
  providers: [provideIcons({ lucideCircleAlert })],
  host: {
    class: 'fl-state fl-state--error',
    role: 'alert',
    '[class.fl-state--compact]': 'compact()',
  },
  template: `
    <fl-icon class="fl-state__icon" name="lucideCircleAlert" [size]="20" />
    <p class="fl-state__title">{{ title() }}</p>
    @if (reason()) {
      <p class="fl-state__body">{{ sentence() }}</p>
    }
    <div class="fl-state__actions">
      <button flButton size="sm" type="button" (click)="retry.emit()">Try again</button>
    </div>
  `,
})
export class FlErrorState {
  readonly title = input('Could not load');
  readonly reason = input<string | null>(null);
  readonly compact = input(false);
  readonly retry = output<void>();
  protected readonly sentence = computed(() => {
    const reason = this.reason() ?? '';
    return reason.charAt(0).toUpperCase() + reason.slice(1) + (reason.endsWith('.') ? '' : '.');
  });
}

function skeletonWidth(index: number): string {
  if (index % 3 === 2) return 'w-1/2';
  return index % 2 ? 'w-3/4' : 'w-full';
}

@Component({
  selector: 'fl-loading-state',
  host: { class: 'fl-skeleton-rows', role: 'status', 'aria-label': 'Loading' },
  template: `
    @for (row of rowList(); track $index) {
      <span class="fl-skeleton" [class]="row"></span>
    }
  `,
})
export class FlLoadingState {
  readonly rows = input(3);
  protected readonly rowList = computed(() =>
    Array.from({ length: this.rows() }, (_, i) => skeletonWidth(i)),
  );
}

@Component({
  selector: 'fl-remote',
  imports: [FlEmptyState, FlErrorState, FlLoadingState],
  template: `
    @switch (state().status) {
      @case ('loading') {
        <fl-loading-state [rows]="loadingRows()" />
      }
      @case ('error') {
        <fl-error-state [title]="errorTitle()" [reason]="state().error" (retry)="retry.emit()" />
      }
      @case ('empty') {
        <fl-empty-state [title]="emptyTitle()" [body]="emptyBody()">
          <ng-content select="[emptyActions]" />
        </fl-empty-state>
      }
      @default {
        <ng-content />
      }
    }
  `,
})
export class FlRemote {
  readonly state = input.required<RemoteData<unknown>>();
  readonly emptyTitle = input('Nothing here yet');
  readonly emptyBody = input<string>();
  readonly errorTitle = input('Could not load');
  readonly loadingRows = input(3);
  readonly retry = output<void>();
}
