import { Component, input, output } from '@angular/core';
import { FlTable } from '../../../ui/patterns/table';
import { ApplicationListRowComponent } from './application-list-row.component';
import { ListRow } from './applications-list-rows';

@Component({
  selector: 'app-applications-list-table',
  imports: [FlTable, ApplicationListRowComponent],
  host: { class: 'block' },
  template: `
    <div class="fl-table-wrap" data-testid="apps-table">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">{{ nameHeader() }}</th>
            <th scope="col">Status</th>
            <th scope="col">Cluster</th>
            <th scope="col">Project</th>
            <th scope="col" class="is-num">Ready</th>
            <th scope="col">Source</th>
            <th scope="col">Usage</th>
            <th scope="col">Backup</th>
            <th scope="col" class="is-num">Released</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr app-application-list-row [row]="row" (open)="open.emit($event)"></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class ApplicationsListTableComponent {
  readonly nameHeader = input('Application');
  readonly rows = input.required<ListRow[]>();
  readonly open = output<string>();
}
