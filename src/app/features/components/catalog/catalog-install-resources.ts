import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationResponseDto } from '../../../core/api/model/models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { appState } from './catalog-view';

@Component({
  selector: 'app-catalog-install-resources',
  imports: [RouterLink, FlPanel, FlTable, FlStatus, FlTag],
  host: { class: 'block' },
  template: `
    <fl-panel title="Resources" [count]="components().length" [flush]="true">
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Component</th>
              <th scope="col">Status</th>
              <th scope="col">Application</th>
              <th scope="col">Exposure</th>
            </tr>
          </thead>
          <tbody>
            @for (c of components(); track c.id) {
              @let st = state(c.status);
              <tr>
                <td class="fl-cell-name">
                  <span class="inline-flex items-center gap-2">
                    <a class="fl-link font-medium" [routerLink]="['/apps/applications', c.id]">{{
                      role(c)
                    }}</a>
                    @if (c.id === primaryComponentId()) {
                      <fl-tag>primary</fl-tag>
                    }
                  </span>
                </td>
                <td><fl-status [tone]="st.tone" [label]="st.label" /></td>
                <td class="fl-mono">{{ c.slug }}</td>
                <td class="fl-mono">{{ c.exposure }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>
  `,
})
export class CatalogInstallResources {
  readonly components = input.required<readonly ApplicationResponseDto[]>();
  readonly primaryComponentId = input<string | undefined>(undefined);

  protected readonly state = appState;

  protected role(c: ApplicationResponseDto): string {
    const labels = c.labels as Record<string, string> | undefined;
    return labels?.['flui.cloud/composed-component'] ?? c.name;
  }
}
