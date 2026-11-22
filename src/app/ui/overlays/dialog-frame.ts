import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlIcon } from '../primitives/icon';

let nextId = 0;

@Component({
  selector: 'fl-dialog',
  imports: [FlIcon],
  providers: [provideIcons({ lucideX })],
  host: {
    class: 'fl-dialog',
    '[class.fl-dialog--wide]': 'wide()',
    '[attr.aria-labelledby]': 'titleId',
  },
  template: `
    <header class="fl-dialog__header">
      <h2 class="fl-dialog__title" [id]="titleId">{{ title() }}</h2>
      <button type="button" class="fl-dialog__close" aria-label="Close" (click)="close()">
        <fl-icon name="lucideX" />
      </button>
    </header>
    <div class="fl-dialog__body"><ng-content /></div>
    <footer class="fl-dialog__footer"><ng-content select="[dialogFooter]" /></footer>
  `,
})
export class FlDialog {
  private readonly ref = inject(DialogRef, { optional: true });
  readonly title = input.required<string>();
  readonly wide = input(false);
  protected readonly titleId = `fl-dialog-title-${nextId++}`;

  protected close(): void {
    this.ref?.close();
  }
}
