import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideLoader } from '@ng-icons/lucide';
import { QueueMessage } from '../../model/messaging-console.models';
import { MessagingConsoleStateService } from './messaging-console-state.service';
import { formatPayload, isJsonPayload } from './messaging-format';

@Component({
  selector: 'app-messaging-peek-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, FormsModule],
  providers: [provideIcons({ lucideEye, lucideLoader })],
  template: `
    <div class="rounded-md border border-border p-3">
      <div
        class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground"
      >
        <ng-icon name="lucideEye" class="h-4 w-4 text-muted-foreground" />
        Peek messages
        <span class="font-normal text-muted-foreground">· non-destructive</span>
      </div>
      <div class="mb-2 flex items-center gap-2">
        <select
          [ngModel]="s.peekStreamName()"
          (ngModelChange)="s.peekStreamName.set($event)"
          class="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        >
          <option value="">Select a {{ s.nouns().item }}…</option>
          @for (st of s.streams(); track st.name) {
            <option [value]="st.name">{{ st.name }}</option>
          }
        </select>
        <button
          type="button"
          (click)="s.peek()"
          [disabled]="s.peeking() || !s.peekStreamName()"
          class="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          @if (s.peeking()) {
            <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
          }
          Peek
        </button>
      </div>
      @if (s.peekError()) {
        <p class="text-xs text-destructive">{{ s.peekError() }}</p>
      }
      @if (s.peekMessages().length) {
        <div
          class="max-h-72 overflow-y-auto overflow-x-hidden rounded-md border border-border"
        >
          @for (m of s.peekMessages(); track m.seq) {
            <div class="border-b border-border px-2 py-1.5 last:border-0">
              <div
                class="flex items-center justify-between gap-2 text-xs text-muted-foreground"
              >
                <span class="truncate font-mono"
                  >#{{ m.seq }} · {{ m.subject }}</span
                >
                <span class="flex shrink-0 items-center gap-1.5">
                  @if (isJson(m)) {
                    <span
                      class="rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                      >JSON</span
                    >
                  }
                  <span>{{ m.timestamp }}</span>
                </span>
              </div>
              <pre
                class="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-1.5 font-mono text-xs text-foreground"
                >{{ payload(m) }}</pre
              >
              @if (m.encoding === 'base64') {
                <span class="text-[10px] text-muted-foreground"
                  >(base64 — binary payload)</span
                >
              }
            </div>
          }
        </div>
      } @else if (s.peeked()) {
        <p class="text-xs text-muted-foreground">
          No messages in this stream.
        </p>
      }
    </div>
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
