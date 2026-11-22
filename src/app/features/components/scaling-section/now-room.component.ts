import { Component, computed, inject, input } from '@angular/core';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingGroupStore } from './scaling-group.store';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { NodeRoom } from '../../model/scaling-group.models';
import { TIGHT_PERCENT, cores, gib, nodeUsageLine, roomLine, share } from './room-format';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlStatus } from '../../../ui/primitives/status';

/**
 * How much room each node has left for new apps.
 *
 * Reservations, not consumption: a node idle on every graph can still be full
 * for the next app, and reservations are what make Flui buy one.
 */
@Component({
  selector: 'app-scaling-now-room',
  imports: [ExplainComponent, FlPanel, FlTable, FlUsageBar, FlStatus],
  host: { class: 'block' },
  template: `
    @if (room(); as r) {
      <fl-panel title="Room" [count]="r.nodes.length || null" [flush]="true" data-testid="room">
        <app-explain
          panelActions
          [floating]="true"
          label="How it is counted"
          labelClass="text-fl-body-sm text-fl-ink-muted"
          testid="room-why"
        >
          What apps reserve on each node against what it can hold, after the reserve kept for the
          system. This is what decides whether the next app fits or Flui adds a node. Beside each
          node: what the apps use now, and what they may grow to at their limits.
        </app-explain>

        <p class="m-0 px-4 py-3 text-fl-body-sm text-fl-ink" data-testid="room-line">
          {{ line() }}
        </p>

        <div class="fl-table-wrap border-t border-fl-border">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Node</th>
                <th scope="col">Role</th>
                <th scope="col">Memory reserved</th>
                <th scope="col">CPU reserved</th>
                <th scope="col">In use and at limits</th>
                <th scope="col">Apps</th>
              </tr>
            </thead>
            <tbody>
              @for (node of r.nodes; track node.name) {
                <tr [attr.data-testid]="'room-node-' + node.name">
                  <td class="fl-mono">{{ node.name }}</td>
                  <td>
                    <span class="flex flex-col">
                      <span>{{ node.role }}</span>
                      @if (!node.takesWork) {
                        <span class="text-fl-caption text-fl-ink-muted">Takes no new apps</span>
                      }
                    </span>
                  </td>
                  @for (bar of bars(node); track bar.label) {
                    <td>
                      <fl-usage-bar
                        [percent]="bar.percent"
                        [label]="bar.label + ' reserved on ' + node.name"
                        [aside]="bar.text"
                        [warnAt]="tight"
                        [criticalAt]="100"
                      />
                    </td>
                  }
                  <td class="is-wrap">
                    @if (usage(node); as u) {
                      @if (u.overcommitted) {
                        <fl-status
                          class="whitespace-normal"
                          tone="warning"
                          [label]="u.text"
                          [attr.data-testid]="'room-usage-' + node.name"
                        />
                      } @else {
                        <span
                          class="text-fl-caption text-fl-ink-secondary"
                          [attr.data-testid]="'room-usage-' + node.name"
                          >{{ u.text }}</span
                        >
                      }
                    } @else {
                      <span class="text-fl-ink-muted">—</span>
                    }
                  </td>
                  <td>
                    @if (node.apps?.length) {
                      <span
                        class="fl-cell-clip"
                        [title]="node.apps!.join(', ')"
                        [attr.data-testid]="'room-apps-' + node.name"
                      >
                        {{
                          node.apps!.length === 1
                            ? node.apps![0]
                            : node.apps!.length + ' apps: ' + node.apps!.join(', ')
                        }}
                      </span>
                    } @else {
                      <span class="text-fl-ink-muted">—</span>
                    }
                  </td>
                </tr>
              }
              @if (group().purchase?.state === 'buying') {
                <tr data-testid="room-node-joining">
                  <td class="fl-mono">
                    {{ group().purchase?.shape ?? 'new node'
                    }}{{ group().purchase?.region ? ' · ' + group().purchase?.region : '' }}
                  </td>
                  <td>worker</td>
                  <td colspan="4">
                    <fl-status
                      tone="progress"
                      [label]="
                        'Joining, ' +
                        group().purchase?.progress +
                        '%. Takes apps once it has joined.'
                      "
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </fl-panel>
    }
  `,
})
export class ScalingNowRoomComponent {
  readonly group = input.required<SectionGroup>();
  private readonly store = inject(ScalingGroupStore);
  protected readonly tight = TIGHT_PERCENT;

  protected readonly room = computed(() => this.store.preview().data?.room ?? null);

  protected readonly line = computed(() => {
    const room = this.room();
    return room
      ? roomLine(room, this.store.preview().data?.pending ?? null, this.group().acts.acts)
      : '';
  });

  protected usage(node: NodeRoom) {
    return nodeUsageLine(node);
  }

  protected bars(node: NodeRoom) {
    const memory = share(node.requested.memoryMi, node.allocatable.memoryMi);
    const cpu = share(node.requested.cpuMillicores, node.allocatable.cpuMillicores);
    return [
      {
        label: 'Memory',
        percent: memory,
        text: `${gib(node.requested.memoryMi)} / ${gib(node.allocatable.memoryMi)}`,
      },
      {
        label: 'CPU',
        percent: cpu,
        text: `${cores(node.requested.cpuMillicores)} / ${cores(node.allocatable.cpuMillicores)}`,
      },
    ];
  }
}
