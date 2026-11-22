import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface TabLink {
  readonly label: string;
  readonly link: string | readonly unknown[];
  readonly exact?: boolean;
}

@Component({
  selector: 'fl-tabs',
  imports: [RouterLink, RouterLinkActive],
  host: { class: 'fl-tabs', role: 'navigation', '[attr.aria-label]': 'label()' },
  template: `
    @for (tab of tabs(); track tab.label) {
      <a
        class="fl-tab"
        [routerLink]="tab.link"
        routerLinkActive
        ariaCurrentWhenActive="page"
        [routerLinkActiveOptions]="{ exact: tab.exact ?? false }"
        >{{ tab.label }}</a
      >
    }
  `,
})
export class FlTabs {
  readonly tabs = input.required<readonly TabLink[]>();
  readonly label = input('Sections');
}
