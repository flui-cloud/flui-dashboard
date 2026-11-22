import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { RecentEvent } from './app-recap-bundle';
import { shortDate } from './app-recap-view';

@Component({
  selector: 'app-recap-activity',
  imports: [RouterLink, FlPanel, FlTable, FlEmptyState, FlLoadingState],
  host: { class: 'block' },
  template: `
    <fl-panel title="Recent activity" [flush]="events().length > 0" data-testid="recap-activity">
      <a
        panelActions
        class="fl-link text-fl-body-sm"
        [routerLink]="['/apps/applications', appId(), 'revisions']"
        [queryParams]="recapPath() ? { returnTo: recapPath() } : null"
        >{{ linkLabel() }}</a
      >
      @if (events().length === 0) {
        @if (loaded()) {
          <fl-empty-state [compact]="true" title="No events recorded yet" />
        } @else {
          <fl-loading-state [rows]="3" />
        }
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col" class="is-fit">Time</th>
                <th scope="col">Event</th>
              </tr>
            </thead>
            <tbody>
              @for (e of events(); track e.id) {
                <tr>
                  <td class="fl-mono text-fl-caption text-fl-ink-muted">{{ shortDate(e.at) }}</td>
                  <td class="whitespace-normal text-fl-ink">{{ e.text }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class AppRecapActivityComponent {
  readonly events = input.required<RecentEvent[]>();
  readonly loaded = input.required<boolean>();
  readonly appId = input.required<string>();
  readonly recapPath = input('');
  readonly linkLabel = input('All events');

  protected readonly shortDate = shortDate;
}
