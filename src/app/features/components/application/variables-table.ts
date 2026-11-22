import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import {
  lucideEye,
  lucideEyeOff,
  lucideMaximize2,
  lucidePencil,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { VarRow, isDirtyRow, valueTypeLabel } from './variable-rows';

@Component({
  selector: 'app-variables-table',
  imports: [FormsModule, FlTable, FlButton, FlIcon, FlStatus, FlTag],
  providers: [
    provideIcons({ lucideEye, lucideEyeOff, lucideMaximize2, lucidePencil, lucideTrash2, lucideX }),
  ],
  template: `
    <div class="fl-table-wrap">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col" class="w-2/5">Key</th>
            <th scope="col">Value</th>
            <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.key; let i = $index) {
            <tr [class.is-selected]="dirty(row)">
              <td class="fl-mono">{{ row.key }}</td>
              <td class="whitespace-normal">
                @if (row.editingSecret || row.editingPlain) {
                  <div class="flex items-center gap-1">
                    <div class="fl-input min-w-0 flex-1">
                      @if (row.editingSecret) {
                        <input
                          class="fl-mono"
                          [type]="reveal() ? 'text' : 'password'"
                          placeholder="New value"
                          [attr.aria-label]="'New value for ' + row.key"
                          [(ngModel)]="row.newSecretValue"
                        />
                      } @else {
                        <input
                          class="fl-mono"
                          type="text"
                          placeholder="Value"
                          [attr.aria-label]="'Value of ' + row.key"
                          [(ngModel)]="row.newPlainValue"
                        />
                      }
                    </div>
                    @if (row.editingSecret) {
                      <button
                        flButton="ghost"
                        size="sm"
                        type="button"
                        [iconOnly]="true"
                        [disabled]="revealLocked()"
                        [attr.title]="revealLocked() ? 'Turn off mask mode to reveal' : null"
                        [attr.aria-label]="reveal() ? 'Hide value' : 'Show value'"
                        (click)="toggleReveal.emit()"
                      >
                        <fl-icon [name]="reveal() ? 'lucideEyeOff' : 'lucideEye'" />
                      </button>
                    }
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [iconOnly]="true"
                      aria-label="Open in the full editor"
                      (click)="expandEditing.emit(i)"
                    >
                      <fl-icon name="lucideMaximize2" />
                    </button>
                    <button
                      flButton
                      size="sm"
                      type="button"
                      [disabled]="row.editingSecret && !row.newSecretValue.trim()"
                      (click)="done.emit(i)"
                    >
                      Done
                    </button>
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [iconOnly]="true"
                      aria-label="Cancel the edit"
                      (click)="cancelEdit.emit(i)"
                    >
                      <fl-icon name="lucideX" />
                    </button>
                  </div>
                } @else if (row.isSensitive) {
                  @if (dirty(row)) {
                    <span class="fl-muted">Updated</span>
                  } @else if (row.isPending) {
                    <fl-status tone="warning" label="Awaiting a value" />
                  } @else {
                    <span class="fl-mono fl-muted select-none">••••••••</span>
                  }
                } @else {
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="fl-mono block max-w-md truncate" [title]="row.value">{{
                      row.value || '—'
                    }}</span>
                    @if (typeLabel(row.value); as label) {
                      <fl-tag>{{ label }}</fl-tag>
                    }
                  </div>
                }
              </td>
              <td>
                @if (!row.editingPlain && !row.editingSecret) {
                  <div class="flex items-center justify-end gap-1">
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [iconOnly]="true"
                      [attr.aria-label]="'Edit ' + row.key"
                      (click)="edit.emit(i)"
                    >
                      <fl-icon name="lucidePencil" />
                    </button>
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [iconOnly]="true"
                      [attr.aria-label]="'Open ' + row.key + ' in the full editor'"
                      (click)="openEditor.emit(i)"
                    >
                      <fl-icon name="lucideMaximize2" />
                    </button>
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [iconOnly]="true"
                      [attr.aria-label]="'Remove ' + row.key"
                      (click)="remove.emit(i)"
                    >
                      <fl-icon name="lucideTrash2" />
                    </button>
                  </div>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class VariablesTable {
  readonly rows = input.required<VarRow[]>();
  readonly reveal = input(false);
  readonly revealLocked = input(false);

  readonly edit = output<number>();
  readonly openEditor = output<number>();
  readonly expandEditing = output<number>();
  readonly done = output<number>();
  readonly cancelEdit = output<number>();
  readonly remove = output<number>();
  readonly toggleReveal = output<void>();

  protected readonly dirty = isDirtyRow;
  protected readonly typeLabel = valueTypeLabel;
}
