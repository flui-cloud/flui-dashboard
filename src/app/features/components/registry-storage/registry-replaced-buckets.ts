import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RegistryBucket, registryProviderLabel } from '../../model/registry-storage.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-registry-replaced-buckets',
  imports: [DatePipe, FlAlert, FlPanel, FlTable, FlButton, FlSpinner],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel
      title="Replaced buckets"
      [count]="buckets().length"
      [flush]="true"
      data-testid="registry-replaced"
    >
      @if (error(); as message) {
        <div class="border-b border-fl-border-subtle p-4">
          <fl-alert tone="error" title="Bucket not removed" data-testid="registry-remove-error">{{
            message
          }}</fl-alert>
        </div>
      }
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Bucket</th>
              <th scope="col">Provider</th>
              <th scope="col">Region</th>
              <th scope="col">Connected</th>
              <th scope="col">Origin</th>
              <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (b of buckets(); track b.id) {
              <tr>
                <td class="fl-cell-name fl-mono">{{ b.bucket }}</td>
                <td>{{ providerLabel(b.provider) }}</td>
                <td class="fl-mono">{{ b.region }}</td>
                <td>{{ b.connectedAt | date: 'd MMM y' }}</td>
                <td>{{ b.createdByFlui ? 'created by Flui' : 'your own' }}</td>
                <td class="is-fit">
                  <button
                    flButton
                    size="sm"
                    type="button"
                    [attr.data-testid]="'registry-remove-' + b.id"
                    [disabled]="removing() !== null"
                    (click)="remove.emit(b)"
                  >
                    @if (removing() === b.id) {
                      <fl-spinner label="Removing" />
                    }
                    Remove
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>
  `,
})
export class RegistryReplacedBuckets {
  readonly buckets = input.required<RegistryBucket[]>();
  readonly removing = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly remove = output<RegistryBucket>();

  protected providerLabel(provider: string | undefined): string {
    return registryProviderLabel(provider);
  }
}
