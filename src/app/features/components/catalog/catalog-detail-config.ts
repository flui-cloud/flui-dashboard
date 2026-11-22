import { Component, input } from '@angular/core';
import { CatalogDetailResponseDto } from '../../../core/api/model/models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';

@Component({
  selector: 'app-catalog-detail-config',
  imports: [FlPanel, FlEmptyState, FlTable],
  host: { class: 'fl-stack' },
  template: `
    @let a = app();
    @if (a.userInputPrompts.length === 0 && a.editableEnv.length === 0) {
      <fl-panel>
        <fl-empty-state title="No configuration needed" body="This app works out of the box." />
      </fl-panel>
    } @else {
      @if (a.userInputPrompts.length > 0) {
        <fl-panel title="Asked at install" [count]="a.userInputPrompts.length" [flush]="true">
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Description</th>
                  <th scope="col">Kind</th>
                </tr>
              </thead>
              <tbody>
                @for (prompt of a.userInputPrompts; track prompt.name) {
                  <tr>
                    <td class="fl-mono">{{ prompt.name }}</td>
                    <td class="is-wrap">
                      @if (prompt.description) {
                        {{ prompt.description }}
                      } @else {
                        <span class="text-fl-ink-muted">—</span>
                      }
                    </td>
                    <td>{{ prompt.sensitive ? 'Secret' : 'Value' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </fl-panel>
      }
      @if (a.editableEnv.length > 0) {
        <fl-panel title="Editable settings" [count]="a.editableEnv.length" [flush]="true">
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Default</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody>
                @for (env of a.editableEnv; track env.name) {
                  <tr>
                    <td class="fl-mono">{{ env.name }}</td>
                    <td class="fl-mono">
                      @if (env.default !== undefined) {
                        {{ env.default }}
                      } @else {
                        <span class="text-fl-ink-muted">—</span>
                      }
                    </td>
                    <td class="is-wrap">
                      @if (env.description) {
                        {{ env.description }}
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
      }
    }
  `,
})
export class CatalogDetailConfig {
  readonly app = input.required<CatalogDetailResponseDto>();
}
