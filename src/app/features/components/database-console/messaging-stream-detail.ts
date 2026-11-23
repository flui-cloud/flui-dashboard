import { Component, computed, inject } from '@angular/core';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { MessagingConsoleStateService } from './messaging-console-state.service';
import { bytes } from './messaging-format';

@Component({
  selector: 'app-messaging-stream-detail',
  imports: [FlButton, FlEmptyState, FlKeyValue, FlKvItem, FlPanel, FlTable],
  host: { class: 'block' },
  template: `
    @if (stream(); as st) {
      <fl-panel [title]="st.name" [flush]="true">
        <button
          panelActions
          flButton="danger"
          size="sm"
          type="button"
          [disabled]="s.pendingDelete() === st.name"
          (click)="askDelete(st.name)"
        >
          Delete {{ s.nouns().item }}
        </button>
        <div class="p-4">
          <fl-key-value>
            <fl-kv-item [key]="s.nouns().routing" [mono]="true">{{
              st.subjects.join(', ') || '—'
            }}</fl-kv-item>
            <fl-kv-item key="Messages"
              ><span class="fl-num">{{ st.messages }}</span></fl-kv-item
            >
            <fl-kv-item key="Size"
              ><span class="fl-num">{{ size(st.bytes) }}</span></fl-kv-item
            >
            <fl-kv-item key="Retention">{{ st.retention || '—' }}</fl-kv-item>
            <fl-kv-item key="Storage">{{ st.storage || '—' }}</fl-kv-item>
            @if (st.lastSeq > 0) {
              <fl-kv-item key="Sequence" [mono]="true"
                >{{ st.firstSeq }} to {{ st.lastSeq }}</fl-kv-item
              >
            }
          </fl-key-value>
        </div>
        @if (st.consumers.length === 0) {
          <fl-empty-state class="border-t border-fl-border" [compact]="true" title="No consumers" />
        } @else {
          <div class="fl-table-wrap border-t border-fl-border">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Consumer</th>
                  <th scope="col" class="is-num">Pending</th>
                  <th scope="col" class="is-num">Ack pending</th>
                  <th scope="col" class="is-num">Redelivered</th>
                  <th scope="col">Ack policy</th>
                  <th scope="col">Type</th>
                </tr>
              </thead>
              <tbody>
                @for (c of st.consumers; track c.name) {
                  <tr>
                    <td class="fl-mono">{{ c.name }}</td>
                    <td class="is-num">{{ c.numPending }}</td>
                    <td class="is-num">{{ c.numAckPending }}</td>
                    <td class="is-num">{{ c.numRedelivered }}</td>
                    <td>{{ c.ackPolicy || '—' }}</td>
                    <td>{{ c.durable ? 'Durable' : 'Ephemeral' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    } @else if (s.streams().length) {
      <fl-panel>
        <fl-empty-state
          [compact]="true"
          [title]="'Select a ' + s.nouns().item"
          [body]="'Pick one on the left to see its consumers.'"
        />
      </fl-panel>
    }
  `,
})
export class MessagingStreamDetail {
  protected readonly s = inject(MessagingConsoleStateService);
  private readonly confirm = inject(ConfirmService);

  protected readonly stream = computed(() => {
    const name = this.s.expanded();
    return name ? (this.s.streams().find((st) => st.name === name) ?? null) : null;
  });

  protected size(n: number): string {
    return bytes(n);
  }

  protected async askDelete(name: string): Promise<void> {
    const item = this.s.nouns().item;
    this.s.askDelete(name);
    const ok = await this.confirm.confirm({
      title: `Delete ${item} ${name}`,
      body: `Its stored messages are lost. This cannot be undone.`,
      confirmLabel: `Delete ${item}`,
      destructive: true,
      typeToConfirm: name,
    });
    if (ok) this.s.confirmDelete();
    else this.s.pendingDelete.set(null);
  }
}
