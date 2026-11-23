import { Component, input } from '@angular/core';

@Component({
  selector: 'fl-panel',
  host: { class: 'fl-panel', role: 'region', '[attr.aria-label]': 'title()' },
  template: `
    @if (title()) {
      <header class="fl-panel__header">
        <h2 class="fl-panel__title" [class.fl-panel__title--mono]="monoTitle()">
          {{ title() }}
          @if (count() !== null && count() !== undefined) {
            <span class="fl-panel__count">({{ count() }})</span>
          }
        </h2>
        <div class="fl-panel__actions"><ng-content select="[panelActions]" /></div>
      </header>
    }
    <ng-content select="[panelToolbar]" />
    <div [class.fl-panel__body]="!flush()"><ng-content /></div>
  `,
})
export class FlPanel {
  readonly title = input<string>();
  readonly count = input<number | null>();
  readonly flush = input(false);
  readonly monoTitle = input(false);
}
