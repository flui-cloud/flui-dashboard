import { Component } from '@angular/core';
import tokens from '../../../theme/tokens.json';
import { FlPanel } from '../patterns/panel';

@Component({
  selector: 'fl-kit-foundations',
  host: { class: 'fl-stack' },
  imports: [FlPanel],
  template: `
    <fl-panel title="Color roles" [count]="roles.length">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        @for (role of roles; track role) {
          <div class="flex items-center gap-3">
            <span
              class="h-8 w-8 flex-none rounded-fl-md border border-fl-border"
              [style.background]="'var(--fl-' + role + ')'"
            ></span>
            <span class="font-mono text-fl-mono-sm">{{ role }}</span>
          </div>
        }
      </div>
    </fl-panel>
    <fl-panel title="Type styles">
      <div class="flex flex-col gap-3">
        <span class="text-fl-page-title">Page title · 22/28 semibold</span>
        <span class="text-fl-section-title">Section title · 15/20 semibold</span>
        <span class="text-fl-metric tabular-nums">12.4%</span>
        <span class="text-fl-body">Body · 14/20 for page text and alert titles</span>
        <span class="text-fl-body-sm">Body small · 13/18, the working size of the console</span>
        <span class="text-fl-caption text-fl-ink-muted"
          >Caption · 12/16 for labels and table headers</span
        >
        <span class="text-fl-overline uppercase text-fl-ink-muted"
          >Overline · navigation sections</span
        >
        <span class="font-mono text-fl-mono-sm">mono-sm · fsn1 · cx33 · 7f3a9c2</span>
      </div>
    </fl-panel>
  `,
})
export class KitFoundations {
  protected readonly roles = Object.keys(tokens.themes.light);
}
