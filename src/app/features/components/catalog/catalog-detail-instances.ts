import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Application } from '../../model/application.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus } from '../../../ui/primitives/status';
import { appState } from './catalog-view';

@Component({
  selector: 'app-catalog-detail-instances',
  imports: [RouterLink, FlPanel, FlTable, FlStatus],
  host: { class: 'block' },
  template: `
    <fl-panel title="Your instances" [count]="instances().length" [flush]="true">
      @if (updateAvailable()) {
        <fl-status
          panelActions
          tone="warning"
          [label]="'Version ' + version() + ' available'"
          title="A newer catalog version is available"
        />
      }
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Status</th>
              <th scope="col">Namespace</th>
              <th scope="col">Version</th>
            </tr>
          </thead>
          <tbody>
            @for (inst of instances(); track inst.id) {
              @let st = state(inst.status);
              <tr>
                <td class="fl-cell-name">
                  <a class="fl-link font-medium" [routerLink]="['/apps/applications', inst.id]">{{
                    inst.name
                  }}</a>
                </td>
                <td><fl-status [tone]="st.tone" [label]="st.label" /></td>
                <td class="fl-mono">{{ inst.k8sNamespace }}</td>
                <td class="fl-mono">
                  @if (inst.catalogVersion) {
                    {{ inst.catalogVersion }}
                  } @else {
                    <span class="text-fl-ink-muted">—</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>
  `,
})
export class CatalogDetailInstances {
  readonly instances = input.required<readonly Application[]>();
  readonly updateAvailable = input(false);
  readonly version = input<string | undefined>(undefined);

  protected readonly state = appState;
}
