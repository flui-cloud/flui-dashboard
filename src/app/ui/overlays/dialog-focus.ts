import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Directive, inject, output } from '@angular/core';

@Directive({
  selector: '[flDialogFocus]',
  hostDirectives: [CdkTrapFocus],
  host: { '(keydown.escape)': 'onEscape($event)' },
})
export class FlDialogFocus {
  readonly dismissed = output<void>();

  constructor() {
    inject(CdkTrapFocus).autoCapture = true;
  }

  protected onEscape(event: Event): void {
    event.stopPropagation();
    this.dismissed.emit();
  }
}
