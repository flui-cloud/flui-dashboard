import { Component, computed, input } from '@angular/core';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlTabs, TabLink } from '../../../ui/patterns/tabs';

const BASE = '/management/mail';

@Component({
  selector: 'app-mail-section-nav',
  imports: [FlPageHeader, FlTabs],
  host: { class: 'block' },
  template: `
    <fl-page-header title="Mail">
      <span headerMeta
        >Whether your applications' mail is arriving, and what to do when it is not.</span
      >
      <ng-container headerActions><ng-content select="[headerActions]" /></ng-container>
      <fl-tabs label="Mail sections" [tabs]="tabs()" />
    </fl-page-header>
  `,
})
export class MailSectionNavComponent {
  readonly toFix = input(0);

  protected readonly tabs = computed<TabLink[]>(() => [
    { label: 'Overview', link: `${BASE}/overview` },
    { label: 'Activity', link: `${BASE}/activity` },
    { label: 'Domains', link: `${BASE}/domains` },
    { label: 'Suppressions', link: `${BASE}/suppressions` },
    { label: 'Providers', link: `${BASE}/providers` },
    { label: this.toFix() > 0 ? `Setup (${this.toFix()})` : 'Setup', link: `${BASE}/setup` },
  ]);
}
