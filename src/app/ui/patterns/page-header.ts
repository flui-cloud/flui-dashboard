import { Component, input } from '@angular/core';
import { Crumb, FlBreadcrumb } from './breadcrumb';

@Component({
  selector: 'fl-page-header',
  imports: [FlBreadcrumb],
  host: { class: 'flex flex-col gap-3' },
  template: `
    @if (breadcrumb().length) {
      <fl-breadcrumb [items]="breadcrumb()" />
    }
    <div class="fl-pagehead">
      <div class="fl-pagehead__main">
        <div class="fl-pagehead__line">
          <h1 class="fl-pagehead__title">{{ title() }}</h1>
          <ng-content select="[headerStatus]" />
        </div>
        <div class="fl-pagehead__meta"><ng-content select="[headerMeta]" /></div>
      </div>
      <div class="fl-pagehead__actions"><ng-content select="[headerActions]" /></div>
    </div>
    <ng-content select="fl-tabs" />
  `,
})
export class FlPageHeader {
  readonly title = input.required<string>();
  readonly breadcrumb = input<readonly Crumb[]>([]);
}
