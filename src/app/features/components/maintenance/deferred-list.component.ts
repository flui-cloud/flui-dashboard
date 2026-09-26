import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DeferredAction, openingLabel } from '../../service/maintenance.service';

/** Changes held for a window, and what became of each. */
@Component({
  selector: 'app-deferred-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length) {
      <ul class="m-0 list-none space-y-1.5 p-0 text-[13px]" data-testid="deferred-list">
        @for (row of rows(); track row.id) {
          <li class="flex flex-wrap items-baseline gap-x-2">
            <span class="text-foreground">{{ row.says }}</span>
            @if (row.status === 'pending') {
              <span class="text-amber-600 dark:text-amber-400">waits for {{ label(row.runAt) }}</span>
              @if (cancellable()) {
                <button type="button" class="text-[12px] text-muted-foreground hover:text-destructive" (click)="cancelAction.emit(row)"
                  [attr.data-testid]="'deferred-cancel-' + row.id">Cancel</button>
              }
            } @else {
              <span class="text-muted-foreground">{{ row.status }}</span>
            }
            <span class="text-[12px] text-muted-foreground">asked by {{ row.requestedBy }}</span>
            @if (row.outcome) {
              <span class="block w-full text-[12px] text-muted-foreground">{{ row.outcome }}</span>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class DeferredListComponent {
  readonly rows = input<DeferredAction[]>([]);
  readonly cancellable = input(false);
  readonly cancelAction = output<DeferredAction>();
  protected label = openingLabel;
}
