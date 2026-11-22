import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlTabs, TabLink } from '../../../ui/patterns/tabs';

const BASE = '/infrastructure/domains';

@Component({
  selector: 'app-dns-shell',
  imports: [RouterOutlet, FlPageHeader, FlTabs],
  template: `
    <div class="fl-page">
      <fl-page-header title="Domains">
        <span headerMeta
          >DNS zones from your provider accounts, certificate issuers and internal hosting</span
        >
        <fl-tabs [tabs]="tabs" label="Domains sections" />
      </fl-page-header>
      <router-outlet />
    </div>
  `,
})
export class DnsShellComponent {
  protected readonly tabs: readonly TabLink[] = [
    { label: 'Zones', link: `${BASE}/zones` },
    { label: 'Certificate issuers', link: `${BASE}/issuers` },
    { label: 'Internal hosting', link: `${BASE}/internal-hosting` },
  ];
}
