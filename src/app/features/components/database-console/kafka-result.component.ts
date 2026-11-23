import { Component, inject } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlStatus } from '../../../ui/primitives/status';
import { KafkaConsoleStateService } from './kafka-console-state.service';
import { formatValue, pretty } from './kafka-format';

@Component({
  selector: 'app-kafka-result',
  imports: [FlPanel, FlTable, FlEmptyState, FlLoadingState, FlStatus],
  host: { class: 'block' },
  template: `
    @if (state.result(); as r) {
      <fl-panel title="Result" [flush]="true">
        <div panelActions class="fl-row">
          <span class="fl-mono text-fl-ink-muted">{{ r.command }}</span>
          @if (r.text && r.kind !== 'ack') {
            <span class="text-fl-caption text-fl-ink-muted">{{ r.text }}</span>
          }
        </div>

        @switch (r.kind) {
          @case ('ack') {
            <div class="p-4">
              <fl-status tone="success" [label]="r.text || 'Done'" />
            </div>
          }
          @case ('table') {
            @if ((r.rows ?? []).length === 0) {
              <fl-empty-state [compact]="true" title="No rows" />
            } @else {
              <div class="fl-table-wrap max-h-96 overflow-auto">
                <table flTable density="dense">
                  <thead>
                    <tr>
                      @for (c of r.columns ?? []; track c) {
                        <th scope="col">{{ c }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of r.rows ?? []; track $index) {
                      <tr>
                        @for (cell of row; track $index) {
                          <td class="fl-mono">{{ cell }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
          @case ('messages') {
            @if ((r.messages ?? []).length === 0) {
              <fl-empty-state [compact]="true" title="No records in that window" />
            } @else {
              <div class="fl-table-wrap max-h-96 overflow-auto">
                <table flTable density="dense">
                  <thead>
                    <tr>
                      <th scope="col" class="is-num">Partition</th>
                      <th scope="col" class="is-num">Offset</th>
                      <th scope="col">Key</th>
                      <th scope="col">Timestamp</th>
                      <th scope="col">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of r.messages ?? []; track $index) {
                      <tr>
                        <td class="is-num fl-mono">{{ m.partition }}</td>
                        <td class="is-num fl-mono">{{ m.offset }}</td>
                        <td class="fl-mono">{{ m.key || '—' }}</td>
                        <td class="fl-mono text-fl-ink-muted">{{ m.timestamp || '—' }}</td>
                        <td class="is-wrap">
                          <pre class="fl-mono m-0 max-h-48 overflow-auto whitespace-pre-wrap">{{
                            value(m.value)
                          }}</pre>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
          @case ('detail') {
            <pre class="fl-mono m-0 max-h-96 overflow-auto p-4">{{ detail(r.detail) }}</pre>
          }
        }
      </fl-panel>
    } @else if (state.running()) {
      <fl-panel title="Result"><fl-loading-state [rows]="3" /></fl-panel>
    }
  `,
})
export class KafkaResultComponent {
  protected readonly state = inject(KafkaConsoleStateService);

  protected value(v: string | null): string {
    return formatValue(v);
  }

  protected detail(v: unknown): string {
    return pretty(v);
  }
}
