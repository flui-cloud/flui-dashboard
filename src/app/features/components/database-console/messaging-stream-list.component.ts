import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { MessagingConsoleStateService } from './messaging-console-state.service';

@Component({
  selector: 'app-messaging-stream-list',
  imports: [FormsModule, FlAlert, FlButton, FlEmptyState, FlField, FlIcon, FlPanel, FlSpinner],
  providers: [provideIcons({ lucidePlus })],
  host: { class: 'block' },
  template: `
    <fl-panel [title]="s.nouns().collection" [count]="s.streams().length" [flush]="true">
      <button
        panelActions
        flButton="ghost"
        size="sm"
        type="button"
        [attr.aria-expanded]="showCreate()"
        (click)="showCreate.set(!showCreate())"
      >
        @if (!showCreate()) {
          <fl-icon name="lucidePlus" [size]="14" />
        }
        {{ showCreate() ? 'Cancel' : 'New ' + s.nouns().item }}
      </button>

      @if (showCreate()) {
        <div class="flex flex-col gap-3 border-b border-fl-border p-4">
          <fl-field [label]="s.nouns().itemTitle + ' name'" for="msg-new-name">
            <div class="fl-input fl-input--lg font-mono">
              <input id="msg-new-name" type="text" placeholder="ORDERS" [(ngModel)]="newName" />
            </div>
          </fl-field>
          <fl-field
            [label]="s.nouns().routing"
            for="msg-new-subjects"
            [hint]="'Comma-separated, for example ' + s.nouns().subjectEg"
          >
            <div class="fl-input fl-input--lg font-mono">
              <input
                id="msg-new-subjects"
                type="text"
                [placeholder]="s.nouns().subjectEg"
                [(ngModel)]="newSubjects"
              />
            </div>
          </fl-field>
          @if (s.nouns().storageChoice) {
            <fl-field label="Storage" for="msg-new-storage">
              <span class="fl-select-wrap">
                <select id="msg-new-storage" class="fl-select" [(ngModel)]="newStorage">
                  <option value="file">{{ s.nouns().storeFile }}</option>
                  <option value="memory">{{ s.nouns().storeMem }}</option>
                </select>
              </span>
            </fl-field>
          }
          @if (s.createError()) {
            <fl-alert tone="error" [title]="'Could not create the ' + s.nouns().item">
              {{ s.createError() }}
            </fl-alert>
          }
          <div class="fl-row">
            <button
              flButton
              size="sm"
              type="button"
              [disabled]="s.creating() || !newName.trim() || !newSubjects.trim()"
              (click)="createStream()"
            >
              @if (s.creating()) {
                <fl-spinner label="Creating" />
              }
              Create {{ s.nouns().item }}
            </button>
          </div>
        </div>
      }

      @if (s.streams().length === 0) {
        <fl-empty-state
          [compact]="true"
          [title]="'No ' + s.nouns().collection.toLowerCase() + ' yet'"
          [body]="
            'Create one so producers can publish to its ' + s.nouns().routing.toLowerCase() + '.'
          "
        />
      } @else {
        <ul class="max-h-96 overflow-auto py-1">
          @for (st of s.streams(); track st.name) {
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-2 px-4 py-2 text-left text-fl-body-sm hover:bg-fl-surface-hover"
                [class.bg-fl-accent-soft]="s.expanded() === st.name"
                [attr.aria-expanded]="s.expanded() === st.name"
                (click)="s.toggle(st.name)"
              >
                <span class="fl-mono min-w-0 flex-1 truncate">{{ st.name }}</span>
                <span class="fl-num text-fl-caption text-fl-ink-muted">{{ st.messages }}</span>
              </button>
            </li>
          }
        </ul>
      }
    </fl-panel>
  `,
})
export class MessagingStreamListComponent {
  protected readonly s = inject(MessagingConsoleStateService);

  readonly showCreate = signal(false);
  newName = '';
  newSubjects = '';
  newStorage: 'file' | 'memory' = 'file';

  createStream(): void {
    const name = this.newName.trim();
    const subjects = this.newSubjects
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (!name || !subjects.length) return;
    this.s.createStream(name, subjects, this.newStorage, () => {
      this.showCreate.set(false);
      this.newName = '';
      this.newSubjects = '';
    });
  }
}
