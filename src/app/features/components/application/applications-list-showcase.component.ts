import { Component, input, output } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTag } from '../../../ui/primitives/tag';
import { ApplicationsListTableComponent } from './applications-list-table.component';
import { ListRow } from './applications-list-rows';

export const READ_ONLY_DEMO_SHOWCASE_NOTE =
  'A Flui project to look around. Like the rest of this demo, it is read-only.';

/**
 * The API's sentence promises a space of one's own beside the showcase, which a
 * visitor or a guest without a space does not have.
 */
export function showcaseNote(apiWhy: string, readOnlyDemo: boolean): string {
  return apiWhy && readOnlyDemo ? READ_ONLY_DEMO_SHOWCASE_NOTE : apiWhy;
}

@Component({
  selector: 'app-applications-list-showcase',
  imports: [FlPanel, FlTag, ApplicationsListTableComponent],
  template: `
    <fl-panel title="In the showcase" [count]="rows().length" [flush]="true">
      @if (readOnly()) {
        <fl-tag panelActions>read-only</fl-tag>
      }
      @if (why()) {
        <p class="border-b border-fl-border-subtle px-4 py-3 text-fl-body-sm text-fl-ink-muted">
          {{ why() }}
        </p>
      }
      <app-applications-list-table [rows]="rows()" (open)="open.emit($event)" />
    </fl-panel>
  `,
})
export class ApplicationsListShowcaseComponent {
  readonly rows = input.required<ListRow[]>();
  readonly readOnly = input(false);
  readonly why = input<string | null>(null);
  readonly open = output<string>();
}
