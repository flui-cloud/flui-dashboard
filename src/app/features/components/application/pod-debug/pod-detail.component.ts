import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink } from '@ng-icons/lucide';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlTable } from '../../../../ui/patterns/table';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../../ui/primitives/status';
import { ContainerDebugInfo, PodDebugInfo, Probe } from '../../../model/pod-debug.models';
import { K8sEventsTable } from '../k8s-events-table';
import { PodContainer, containerStateSummary, probeSummary } from './pod-container';

@Component({
  selector: 'app-pod-detail',
  imports: [
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlAlert,
    FlTable,
    FlButton,
    FlIcon,
    FlStatus,
    K8sEventsTable,
    PodContainer,
  ],
  providers: [provideIcons({ lucideExternalLink })],
  host: { class: 'fl-stack' },
  template: `
    @let p = pod();
    <fl-panel [title]="p.name">
      <div class="flex flex-col gap-5">
        @if (p.latestDiagnosisId) {
          <fl-alert tone="warning" title="A diagnosis is available for this pod">
            <button
              alertActions
              flButton
              size="sm"
              type="button"
              (click)="openDiagnosis.emit(p.latestDiagnosisId!)"
            >
              <fl-icon name="lucideExternalLink" />
              Open diagnosis
            </button>
          </fl-alert>
        }
        <fl-key-value>
          <fl-kv-item key="Namespace" [mono]="true">{{ p.namespace }}</fl-kv-item>
          <fl-kv-item key="UID" [mono]="true">{{ p.uid }}</fl-kv-item>
          @if (p.qosClass) {
            <fl-kv-item key="QoS class">{{ p.qosClass }}</fl-kv-item>
          }
          @if (p.creationTimestamp) {
            <fl-kv-item key="Created">{{ formatDate(p.creationTimestamp) }}</fl-kv-item>
          }
          <fl-kv-item key="Pod IP" [mono]="true">{{ p.podIP ?? '—' }}</fl-kv-item>
          <fl-kv-item key="Host IP" [mono]="true">{{ p.hostIP ?? '—' }}</fl-kv-item>
          <fl-kv-item key="Node" [mono]="true">{{ p.nodeName ?? '—' }}</fl-kv-item>
        </fl-key-value>
      </div>
    </fl-panel>

    @if (p.conditions.length) {
      <fl-panel title="Conditions" [flush]="true">
        <div class="fl-table-wrap relative">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col" class="is-fit">Type</th>
                <th scope="col" class="is-fit">Status</th>
                <th scope="col" class="is-fit">Reason</th>
                <th scope="col">Message</th>
              </tr>
            </thead>
            <tbody>
              @for (c of p.conditions; track c.type) {
                <tr class="align-top">
                  <td class="fl-mono">{{ c.type }}</td>
                  <td><fl-status [tone]="conditionTone(c.status)" [label]="c.status" /></td>
                  <td class="fl-mono">{{ c.reason ?? '—' }}</td>
                  <td class="whitespace-normal break-words">{{ c.message ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </fl-panel>
    }

    @if (p.containers.length) {
      <fl-panel title="Containers" [count]="p.containers.length">
        <div class="flex flex-col gap-5">
          @for (c of p.containers; track c.name) {
            <app-pod-container
              [container]="c"
              [class.border-t]="!$first"
              [class.border-fl-border-subtle]="!$first"
              [class.pt-5]="!$first"
            />
          }
        </div>
      </fl-panel>
    }

    @if (p.volumes.length) {
      <fl-panel title="Volumes" [count]="p.volumes.length" [flush]="true">
        <div class="fl-table-wrap relative">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" class="is-fit">Kind</th>
                <th scope="col">Resource</th>
                <th scope="col" class="is-fit"><span class="fl-sr">State</span></th>
              </tr>
            </thead>
            <tbody>
              @for (v of p.volumes; track v.name) {
                <tr>
                  <td class="fl-mono">{{ v.name }}</td>
                  <td>{{ v.kind }}</td>
                  <td class="fl-mono">{{ v.resourceName ?? '—' }}</td>
                  <td>
                    @if (v.exists === false) {
                      <fl-status tone="error" label="Missing resource" />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </fl-panel>
    }

    @if (p.events.length) {
      <fl-panel title="Events" [count]="p.events.length" [flush]="true">
        <app-k8s-events-table [events]="events()" />
      </fl-panel>
    }

    @if (hasScheduling()) {
      <fl-panel title="Scheduling">
        <pre
          class="fl-mono m-0 overflow-x-auto rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3 text-fl-ink"
          >{{ schedulingJson() }}</pre>
      </fl-panel>
    }
  `,
})
export class PodDetailComponent {
  readonly pod = input.required<PodDebugInfo>();
  readonly openDiagnosis = output<string>();

  protected readonly events = computed(() => this.sortedEvents());

  stateSummary(c: ContainerDebugInfo): string {
    return containerStateSummary(c);
  }

  probeSummary(p: Probe): string {
    return probeSummary(p);
  }

  conditionTone(status: string): StatusTone {
    if (status === 'True') return 'success';
    if (status === 'False') return 'error';
    return 'neutral';
  }

  sortedEvents() {
    return [...this.pod().events].sort((a, b) => {
      const ta = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
      const tb = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
      return tb - ta;
    });
  }

  hasScheduling(): boolean {
    const s = this.pod().scheduling ?? {};
    return !!(s.nodeSelector || s.tolerations?.length || s.affinity);
  }

  schedulingJson(): string {
    return JSON.stringify(this.pod().scheduling ?? {}, null, 2);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-GB');
  }
}
