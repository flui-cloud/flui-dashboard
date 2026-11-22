import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideX } from '@ng-icons/lucide';
import { FlField } from '../../../ui/patterns/field';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

let nextId = 0;

@Component({
  selector: 'app-flui-tag-manager',
  imports: [FormsModule, FlField, FlTable, FlEmptyState, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideX, lucidePlus })],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <form class="flex items-end gap-2" (ngSubmit)="onAddTag()">
      <fl-field class="flex-1" label="New tag" [for]="inputId">
        <div class="fl-input fl-input--lg">
          <input
            type="text"
            name="newTag"
            autocomplete="off"
            spellcheck="false"
            placeholder="stable"
            [id]="inputId"
            [(ngModel)]="newTag"
            (keydown.escape)="newTag.set('')"
          />
        </div>
      </fl-field>
      <button flButton type="submit" [disabled]="busy() || !newTag().trim()">
        @if (busy()) {
          <fl-spinner label="Adding" />
        } @else {
          <fl-icon name="lucidePlus" />
        }
        Add tag
      </button>
    </form>

    @if (tags().length === 0) {
      <fl-empty-state [compact]="true" title="No tags yet" />
    } @else {
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Tag</th>
              <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (tag of tags(); track tag) {
              <tr>
                <td class="fl-mono">{{ tag }}</td>
                <td class="is-fit">
                  <button
                    flButton="ghost"
                    size="sm"
                    type="button"
                    [iconOnly]="true"
                    [attr.aria-label]="'Remove tag ' + tag"
                    [title]="'Remove tag ' + tag"
                    [disabled]="busy()"
                    (click)="onRemoveTag(tag)"
                  >
                    <fl-icon name="lucideX" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class FluiTagManagerComponent {
  tags = input.required<string[]>();
  addTag = output<string>();
  removeTag = output<string>();

  showInput = signal(false);
  newTag = signal('');
  busy = signal(false);

  protected readonly inputId = `flui-tag-input-${nextId++}`;

  onAddTag(): void {
    const tag = this.newTag().trim();
    if (!tag) return;
    this.addTag.emit(tag);
    this.newTag.set('');
    this.showInput.set(false);
  }

  onRemoveTag(tag: string): void {
    this.removeTag.emit(tag);
  }
}
