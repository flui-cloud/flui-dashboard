import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QueueMessage } from '../../model/messaging-console.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlTag } from '../../../ui/primitives/tag';
import { MessagingConsoleStateService } from './messaging-console-state.service';
import { formatPayload, isJsonPayload } from './messaging-format';

@Component({
  selector: 'app-messaging-peek-panel',
  imports: [
    FormsModule,
    FlAlert,
    FlButton,
    FlEmptyState,
    FlField,
    FlPanel,
    FlSpinner,
    FlTable,
    FlTag,
  ],
  host: { class: 'block' },
  template: `
    <fl-panel title="Peek messages" [flush]="true">
      <span panelActions class="text-fl-caption text-fl-ink-muted">Does not consume</span>
      <div class="flex flex-col gap-4 p-4">
        <div class="flex items-end gap-2">
          <fl-field class="min-w-0 flex-1" [label]="s.nouns().itemTitle" for="msg-peek-stream">
            <span class="fl-select-wrap">
              <select
                id="msg-peek-stream"
                class="fl-select"
                [ngModel]="s.peekStreamName()"
                (ngModelChange)="s.peekStreamName.set($event)"
              >
                <option value="">Select a {{ s.nouns().item }}</option>
                @for (st of s.streams(); track st.name) {
                  <option [value]="st.name">{{ st.name }}</option>
                }
              </select>
            </span>
          </fl-field>
          <button
            flButton
            type="button"
            [disabled]="s.peeking() || !s.peekStreamName()"
            (click)="s.peek()"
          >
            @if (s.peeking()) {
              <fl-spinner label="Peeking" />
            }
            Peek
          </button>
        </div>
        @if (s.peekError()) {
          <fl-alert tone="error" title="Peek failed">{{ s.peekError() }}</fl-alert>
        }
      </div>

      @if (s.peekMessages().length) {
        <div class="fl-table-wrap max-h-96 overflow-auto border-t border-fl-border">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col" class="is-num">Seq</th>
                <th scope="col">Subject</th>
                <th scope="col">Timestamp</th>
                <th scope="col">Payload</th>
              </tr>
            </thead>
            <tbody>
              @for (m of s.peekMessages(); track m.seq) {
                <tr>
                  <td class="is-num fl-mono align-top">{{ m.seq }}</td>
                  <td class="fl-mono align-top">{{ m.subject }}</td>
                  <td class="fl-mono align-top text-fl-ink-muted">{{ m.timestamp }}</td>
                  <td class="is-wrap">
                    <div class="flex flex-col gap-1">
                      @if (isJson(m)) {
                        <fl-tag class="self-start">JSON</fl-tag>
                      }
                      <pre
                        class="fl-mono m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words"
                        >{{ payload(m) }}</pre>
                      @if (m.encoding === 'base64') {
                        <span class="text-fl-caption text-fl-ink-muted"
                          >Base64, binary payload</span
                        >
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (s.peeked()) {
        <fl-empty-state
          class="border-t border-fl-border"
          [compact]="true"
          [title]="'No messages in this ' + s.nouns().item"
        />
      }
    </fl-panel>
  `,
})
export class MessagingPeekPanelComponent {
  protected readonly s = inject(MessagingConsoleStateService);

  protected isJson(m: QueueMessage): boolean {
    return isJsonPayload(m);
  }

  protected payload(m: QueueMessage): string {
    return formatPayload(m);
  }
}
