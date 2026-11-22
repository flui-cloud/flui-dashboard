import { Component, input } from '@angular/core';
import { ReplicaDiffReport } from '../../service/dns-replica.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-zone-replica-report',
  imports: [FlAlert, FlKeyValue, FlKvItem, FlStatus],
  host: { class: 'flex flex-col gap-3 py-1' },
  template: `
    <fl-key-value class="fl-kv--compact">
      <fl-kv-item key="Created"
        ><span class="fl-num">{{ report().created }}</span></fl-kv-item
      >
      <fl-kv-item key="Updated"
        ><span class="fl-num">{{ report().updated }}</span></fl-kv-item
      >
      <fl-kv-item key="Removed">
        <span class="fl-num">{{ report().orphansDeleted }}</span>
      </fl-kv-item>
      <fl-kv-item key="Mismatches">
        <span class="fl-num">{{ report().mismatches.length }}</span>
      </fl-kv-item>
    </fl-key-value>
    @if (report().mismatches.length > 0) {
      <ul class="flex flex-col gap-1">
        @for (m of report().mismatches; track m.name + m.type) {
          <li class="fl-mono text-fl-ink-secondary">
            {{ m.type }} {{ m.name }}: expected {{ m.expected }}, got {{ m.actual }}
          </li>
        }
      </ul>
    }
    @if (report().errors.length > 0) {
      <fl-alert
        tone="error"
        [title]="report().errors.length === 1 ? '1 error' : report().errors.length + ' errors'"
      >
        <span class="flex flex-col gap-1">
          @for (err of report().errors; track err) {
            <span>{{ err }}</span>
          }
        </span>
      </fl-alert>
    }
    @if (report().errors.length === 0 && report().mismatches.length === 0) {
      <fl-status tone="success" label="In sync, no drift" />
    }
  `,
})
export class ZoneReplicaReport {
  readonly report = input.required<ReplicaDiffReport>();
}
