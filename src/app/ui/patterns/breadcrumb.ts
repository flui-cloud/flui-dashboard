import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb {
  readonly label: string;
  readonly link?: string | readonly unknown[];
}

@Component({
  selector: 'fl-breadcrumb',
  imports: [RouterLink],
  host: { class: 'fl-breadcrumb', role: 'navigation', 'aria-label': 'Breadcrumb' },
  template: `
    @for (crumb of items(); track $index; let last = $last) {
      @if (crumb.link && !last) {
        <a [routerLink]="crumb.link">{{ crumb.label }}</a>
        <span aria-hidden="true">/</span>
      } @else {
        <span [attr.aria-current]="last ? 'page' : null">{{ crumb.label }}</span>
        @if (!last) {
          <span aria-hidden="true">/</span>
        }
      }
    }
  `,
})
export class FlBreadcrumb {
  readonly items = input.required<readonly Crumb[]>();
}
