import { Component, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideClock, lucideKeyRound } from '@ng-icons/lucide';
import { KeyValueRead } from '../../model/kv-console.models';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlIcon } from '../../../ui/primitives/icon';
import { JsonViewerComponent } from './json-viewer.component';

function ttlLabel(ttl: number): string {
  if (ttl === -1) return 'No expiry';
  if (ttl === -2) return 'Missing';
  return `${ttl}s`;
}

function asJson(value: string): unknown {
  const t = value.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-kv-value-view',
  imports: [FlAlert, FlPanel, FlEmptyState, FlLoadingState, FlTable, FlIcon, JsonViewerComponent],
  providers: [provideIcons({ lucideClock, lucideKeyRound })],
  host: { class: 'block' },
  template: `
    @let v = value();
    <fl-panel title="Value" [flush]="true">
      @if (v && !loading()) {
        <div panelActions class="fl-row">
          <span class="fl-toolbar__info font-mono">{{ v.type }}</span>
          <span class="fl-toolbar__info inline-flex items-center gap-1" title="Time to live">
            <fl-icon name="lucideClock" [size]="13" /> {{ ttl(v.ttl) }}
          </span>
        </div>
      }
      @if (loading()) {
        <fl-loading-state [rows]="4" />
      } @else if (v) {
        <div class="border-b border-fl-border-subtle px-4 py-3">
          <span class="break-all font-mono text-fl-body-sm font-semibold">{{ v.key }}</span>
        </div>
        @if (v.truncated) {
          <div class="px-4 pt-3">
            <fl-alert tone="info" title="Value truncated">
              Showing the first elements{{ v.length ? ' of ' + v.length : '' }}.
            </fl-alert>
          </div>
        }
        @switch (v.value.kind) {
          @case ('string') {
            <div class="px-4 py-3">
              @if (json(v.value.value); as parsed) {
                <app-json-viewer [value]="parsed" />
              } @else {
                <pre
                  class="m-0 overflow-auto whitespace-pre-wrap break-all font-mono text-fl-mono-sm"
                  >{{ v.value.value }}</pre>
              }
            </div>
          }
          @case ('hash') {
            <div class="fl-table-wrap">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of v.value.fields; track f.field) {
                    <tr>
                      <td class="fl-mono align-top text-fl-ink-secondary">{{ f.field }}</td>
                      <td class="fl-mono is-wrap break-all">{{ f.value }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @case ('list') {
            <div class="fl-table-wrap">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col" class="is-num is-fit">Index</th>
                    <th scope="col">Item</th>
                  </tr>
                </thead>
                <tbody>
                  @for (it of v.value.items; track $index) {
                    <tr>
                      <td class="fl-mono is-num text-fl-ink-muted">{{ $index }}</td>
                      <td class="fl-mono is-wrap break-all">{{ it }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @case ('set') {
            <div class="fl-table-wrap">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of v.value.members; track $index) {
                    <tr>
                      <td class="fl-mono is-wrap break-all">{{ m }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @case ('zset') {
            <div class="fl-table-wrap">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col" class="is-num">Score</th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of v.value.entries; track $index) {
                    <tr>
                      <td class="fl-mono is-wrap break-all">{{ e.member }}</td>
                      <td class="fl-mono is-num text-fl-ink-secondary">{{ e.score }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @default {
            <p class="m-0 px-4 py-3 text-fl-body-sm text-fl-ink-muted">{{ v.value.note }}</p>
          }
        }
      } @else {
        <fl-empty-state
          [compact]="true"
          icon="lucideKeyRound"
          title="No key selected"
          body="Select a key to see its value."
        />
      }
    </fl-panel>
  `,
})
export class KvValueView {
  readonly value = input<KeyValueRead | null>(null);
  readonly loading = input(false);

  protected ttl(ttl: number): string {
    return ttlLabel(ttl);
  }

  protected json(value: string): unknown {
    return asJson(value);
  }
}
