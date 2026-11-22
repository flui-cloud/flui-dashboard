import { Component, input, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronUp } from '@ng-icons/lucide';
import { NodeInstallLogComponent } from '../node-install-log/node-install-log.component';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

/** The install log of a purchase, opened in place and followed live: reading it is the point, the file is secondary. */
@Component({
  selector: 'app-purchase-log',
  imports: [NodeInstallLogComponent, FlButton, FlIcon],
  providers: [provideIcons({ lucideChevronDown, lucideChevronUp })],
  host: { class: 'flex flex-col gap-2' },
  template: `
    <div>
      <button
        flButton="ghost"
        size="sm"
        type="button"
        [attr.aria-expanded]="open()"
        (click)="open.set(!open())"
        data-testid="purchase-log"
      >
        <fl-icon [name]="open() ? 'lucideChevronUp' : 'lucideChevronDown'" [size]="14" />
        {{ open() ? 'Hide install log' : 'Install log' }}
      </button>
    </div>
    @if (open()) {
      <div class="rounded-fl-md bg-fl-topbar-bg p-3" data-testid="purchase-log-panel">
        <app-node-install-log [operationId]="operationId()" />
      </div>
    }
  `,
})
export class PurchaseLogComponent {
  readonly operationId = input.required<string>();

  protected readonly open = signal(false);
}
