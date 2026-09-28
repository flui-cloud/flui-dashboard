import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
import { NodeInstallLogComponent } from '../node-install-log/node-install-log.component';

/** The install log of a purchase, opened in place and followed live: reading it is the point, the file is secondary. */
@Component({
  selector: 'app-purchase-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NodeInstallLogComponent],
  template: `
    <button
      type="button"
      class="text-[13px] font-medium underline underline-offset-2"
      (click)="open.set(!open())"
      data-testid="purchase-log"
    >
      {{ open() ? 'Hide install log' : 'Install log' }}
    </button>
    @if (open()) {
      <div
        class="mt-2 w-full basis-full rounded-md bg-gray-900 p-3 dark:bg-black"
        data-testid="purchase-log-panel"
      >
        <app-node-install-log [operationId]="operationId()" />
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class PurchaseLogComponent {
  readonly operationId = input.required<string>();

  protected readonly open = signal(false);
}
