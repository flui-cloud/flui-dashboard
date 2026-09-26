import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingGroupStore } from './scaling-group.store';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { TABLE } from './now-format';
import { NodeRoom } from '../../model/scaling-group.models';
import { TIGHT_PERCENT, cores, gib, nodeUsageLine, roomLine, share } from './room-format';

/**
 * How much room each node has left for new apps.
 *
 * Reservations, not consumption: a node idle on every graph can still be full
 * for the next app, and reservations are what make Flui buy one.
 */
@Component({
  selector: 'app-scaling-now-room',
  standalone: true,
  imports: [ExplainComponent],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (room(); as r) {
      <section class="space-y-2" data-testid="room">
        <h2 class="m-0 flex items-center gap-1.5">
          <app-explain
            [floating]="true"
            label="Room"
            labelClass="text-label"
            testid="room-why"
          >
            What apps reserve on each node against what it can hold, after the
            reserve kept for the system. This is what decides whether the next
            app fits or Flui buys a node. Below each node: what the apps use now,
            and what they may grow to at their limits.
          </app-explain>
        </h2>

        <div [class]="t.card">
          <p class="m-0 text-sm text-foreground" data-testid="room-line">
            {{ line() }}
          </p>

          <ul class="m-0 mt-3 list-none space-y-2.5 p-0">
            @for (node of r.nodes; track node.name) {
              <li
                class="grid grid-cols-[minmax(10rem,18rem)_1fr] items-center gap-x-4 gap-y-1"
                [attr.data-testid]="'room-node-' + node.name"
              >
                <span class="min-w-0">
                  <span [class]="t.mono" class="block truncate">{{ node.name }}</span>
                  <span class="text-[12px] text-muted-foreground">
                    {{ node.role }}
                    @if (!node.takesWork) {
                      · takes no new apps
                    }
                  </span>
                </span>
                <span class="grid gap-1">
                  @for (bar of bars(node); track bar.label) {
                    <span class="grid grid-cols-[4rem_1fr_9rem] items-center gap-2 text-[12px]">
                      <span class="text-muted-foreground">{{ bar.label }}</span>
                      <span
                        class="h-1.5 overflow-hidden rounded-full bg-muted"
                        role="img"
                        [attr.aria-label]="bar.label + ' ' + bar.text"
                      >
                        <span
                          class="block h-full rounded-full"
                          [class]="bar.tight ? 'bg-amber-500' : 'bg-sky-600 dark:bg-sky-400'"
                          [style.width.%]="bar.percent"
                        ></span>
                      </span>
                      <span class="tabular-nums text-muted-foreground">{{ bar.text }}</span>
                    </span>
                  }
                  @if (usage(node); as u) {
                    <span
                      class="text-[12px]"
                      [class]="u.overcommitted ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'"
                      [attr.data-testid]="'room-usage-' + node.name"
                    >{{ u.text }}</span>
                  }
                  @if (node.apps?.length) {
                    <span class="truncate text-[12px] text-muted-foreground" [title]="node.apps!.join(', ')" [attr.data-testid]="'room-apps-' + node.name">
                      Runs {{ node.apps!.length === 1 ? node.apps![0] : node.apps!.length + ' apps: ' + node.apps!.join(', ') }}
                    </span>
                  }
                </span>
              </li>
            }
            @if (group().purchase?.state === 'buying') {
              <li
                class="grid grid-cols-[minmax(10rem,18rem)_1fr] items-center gap-x-4 gap-y-1 opacity-60"
                data-testid="room-node-joining"
              >
                <span class="min-w-0">
                  <span [class]="t.mono" class="block truncate">{{ group().purchase?.shape ?? 'new node' }}{{ group().purchase?.region ? ' · ' + group().purchase?.region : '' }}</span>
                  <span class="text-[12px] text-muted-foreground">worker · joining ({{ group().purchase?.progress }}%)</span>
                </span>
                <span class="text-[12px] text-muted-foreground">Takes apps once it has joined.</span>
              </li>
            }
          </ul>
        </div>
      </section>
    }
  `,
})
export class ScalingNowRoomComponent {
  readonly group = input.required<SectionGroup>();
  private readonly store = inject(ScalingGroupStore);
  protected readonly t = TABLE;

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
        tight: memory >= TIGHT_PERCENT,
      },
      {
        label: 'CPU',
        percent: cpu,
        text: `${cores(node.requested.cpuMillicores)} / ${cores(node.allocatable.cpuMillicores)}`,
        tight: cpu >= TIGHT_PERCENT,
      },
    ];
  }
}
