import { Component, computed, input } from '@angular/core';
import { PlatformUpdateOperation } from '../../service/platform-update.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlStatus } from '../../../ui/primitives/status';
import { k3sNodeRows } from './platform-upgrade-plan';
import { PlatformUpdateNodes } from './platform-update-nodes';
import {
  clockTime,
  componentDetail,
  elapsed,
  isRunningOperation,
  operationStatus,
  operationSubline,
  phaseNote,
  stepLabel,
  stepTone,
} from './platform-update-format';

@Component({
  selector: 'app-platform-update-progress',
  imports: [FlPanel, FlTable, FlAlert, FlStatus, PlatformUpdateNodes],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel [title]="'Update to Flui ' + operation().targetVersion" [flush]="true">
      <div panelActions class="fl-row">
        <span class="fl-mono fl-num">{{ operation().progress }}%</span>
        <fl-status [tone]="status().tone" [label]="status().label" />
      </div>

      <div class="flex flex-col gap-1 border-b border-fl-border-subtle px-4 py-3 text-fl-body-sm">
        <p class="m-0">
          From <span class="fl-mono">{{ operation().fromVersion }}</span> to
          <span class="fl-mono">{{ operation().targetVersion }}</span>
        </p>
        <p class="m-0 text-fl-ink-muted">{{ subline() }}</p>
      </div>

      <div class="fl-table-wrap">
        @if (operation().phases; as phases) {
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Status</th>
                <th scope="col">Detail</th>
                <th scope="col">Started</th>
                <th scope="col" class="is-num">Duration</th>
              </tr>
            </thead>
            <tbody>
              @for (phase of phases; track phase.key) {
                <tr>
                  <td class="font-medium">{{ phase.title }}</td>
                  <td><fl-status [tone]="tone(phase.status)" [label]="label(phase.status)" /></td>
                  <td class="is-wrap text-fl-ink-secondary">
                    <div class="flex flex-col gap-1">
                      @if (note(phase); as text) {
                        <span>{{ text }}</span>
                      }
                      @if (phase.key !== 'k3s' && phase.clusters?.length) {
                        <span>
                          @for (c of phase.clusters; track c.clusterId; let last = $last) {
                            {{ c.clusterName }}: {{ c.status }}{{ last ? '' : ' · ' }}
                          }
                        </span>
                      }
                      @for (check of phase.checks ?? []; track check.name) {
                        <fl-status
                          [tone]="check.ok ? 'success' : 'error'"
                          [label]="check.detail ? check.name + ': ' + check.detail : check.name"
                        />
                      }
                    </div>
                  </td>
                  <td class="fl-mono text-fl-ink-secondary">{{ clock(phase.startedAt) }}</td>
                  <td class="fl-mono is-num text-fl-ink-secondary">
                    {{ took(phase.startedAt, phase.finishedAt) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Component</th>
                <th scope="col">Status</th>
                <th scope="col">Version</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              @for (component of operation().components; track component.key) {
                <tr>
                  <td class="font-medium">{{ component.name }}</td>
                  <td>
                    <fl-status [tone]="tone(component.status)" [label]="label(component.status)" />
                  </td>
                  <td class="fl-mono text-fl-ink-secondary">
                    @if (component.status !== 'skipped') {
                      {{ component.fromVersion }} → {{ component.targetVersion }}
                    } @else {
                      {{ component.targetVersion }}
                    }
                  </td>
                  <td class="is-wrap text-fl-ink-secondary">{{ detail(component) }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      @if (operation().errorMessage; as message) {
        <div class="border-t border-fl-border-subtle p-4">
          <fl-alert tone="error" title="Update stopped">
            <span class="fl-mono">{{ message }}</span>
          </fl-alert>
        </div>
      }
    </fl-panel>

    @if (k3sRows().length > 0) {
      <app-platform-update-nodes [rows]="k3sRows()" />
    }

    @if (isRunning()) {
      <fl-alert tone="warning" title="The API restarts during this update.">
        The dashboard loses its connection for about 90 seconds and reconnects on its own, so keep
        this tab open. Your applications keep serving traffic throughout.
      </fl-alert>
    }
  `,
})
export class PlatformUpdateProgressComponent {
  readonly operation = input.required<PlatformUpdateOperation>();

  protected readonly isRunning = computed(() => isRunningOperation(this.operation()));
  protected readonly status = computed(() => operationStatus(this.operation()));
  protected readonly subline = computed(() => operationSubline(this.operation()));
  protected readonly k3sRows = computed(() => k3sNodeRows(this.operation()));

  protected readonly tone = stepTone;
  protected readonly label = stepLabel;
  protected readonly clock = clockTime;
  protected readonly took = elapsed;
  protected readonly detail = componentDetail;

  protected note(phase: Parameters<typeof phaseNote>[0]): string | null {
    return phaseNote(phase, this.operation().withoutBackup ?? false);
  }
}
