import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucidePlus } from '@ng-icons/lucide';
import { ClusterScalingRow } from '../../model/scaling-section.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { ModeCopy, Reading, ScalingMode, age, eurMonth, modeOf } from './overview-format';
import { OverviewReadingComponent } from './overview-reading.component';

interface OverviewRow {
  id: string;
  name: string;
  provider: string;
  mode: ModeCopy;
  nodes: Reading;
  spend: Reading;
  alarmAge: string | null;
  alarmSince: string | null;
  needsPerson: string | null;
  groupId: string | null;
  setupCopy: string;
  highlighted: boolean;
}

@Component({
  selector: 'app-overview-cluster-table',
  imports: [
    FlPanel,
    FlTable,
    FlButton,
    FlIcon,
    FlStatus,
    FlTag,
    OverviewReadingComponent,
    RouterLink,
  ],
  providers: [provideIcons({ lucideArrowRight, lucidePlus })],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Clusters" [count]="displayed().length" [flush]="true">
      <div class="fl-table-wrap">
        <table flTable density="dense" data-testid="cluster-table">
          <thead>
            <tr>
              <th scope="col">Cluster</th>
              <th scope="col">Provider</th>
              <th scope="col">Who can add a node</th>
              <th scope="col" class="is-num">Nodes</th>
              <th scope="col" class="is-num">Spend</th>
              <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
            </tr>
          </thead>

          @for (row of displayed(); track row.id) {
            <tbody
              class="border-b border-fl-border-subtle last:border-b-0"
              [attr.data-testid]="'cluster-' + row.id"
            >
              <tr
                [class.is-selected]="row.highlighted"
                [attr.data-testid]="'row-' + row.id"
                [attr.data-attention]="row.needsPerson ? 'yes' : 'no'"
                [attr.aria-current]="row.highlighted ? 'true' : null"
              >
                <td role="rowheader" class="fl-cell-name is-wrap">
                  <span class="flex flex-col gap-1">
                    <span class="flex flex-wrap items-center gap-2">
                      <span class="fl-mono font-medium">{{ row.name }}</span>
                      @if (row.highlighted) {
                        <fl-tag [attr.data-testid]="'came-from-' + row.id"
                          >You came from here</fl-tag
                        >
                      }
                    </span>
                    @if (row.alarmAge || row.needsPerson) {
                      <span class="flex flex-wrap items-center gap-x-3 gap-y-1">
                        @if (row.alarmAge; as alarmAge) {
                          <fl-status
                            tone="warning"
                            [label]="'Alarm open ' + alarmAge"
                            [attr.title]="row.alarmSince"
                            [attr.data-testid]="'alarm-' + row.id"
                          />
                        }
                        <span
                          class="flex flex-col gap-0.5"
                          [attr.data-testid]="'needs-person-' + row.id"
                        >
                          <fl-status tone="warning" label="Needs a person" />
                          <span class="text-fl-caption text-fl-ink-muted">{{
                            row.needsPerson ??
                              'An alarm is open, and it stands until this group decides something else.'
                          }}</span>
                        </span>
                      </span>
                    }
                  </span>
                </td>

                <td class="text-fl-ink-secondary">{{ row.provider }}</td>

                <td>
                  <fl-status
                    [tone]="row.mode.tone"
                    [label]="row.mode.label"
                    [attr.data-testid]="'mode-' + row.id"
                  />
                </td>

                <td class="is-num" [attr.data-testid]="'nodes-' + row.id">
                  <app-overview-reading [reading]="row.nodes" />
                </td>

                <td class="is-num" [attr.data-testid]="'spend-' + row.id">
                  <app-overview-reading [reading]="row.spend" />
                </td>

                <td class="is-fit">
                  @if (row.groupId; as groupId) {
                    <a
                      flButton
                      size="sm"
                      [routerLink]="['/scaling', groupId]"
                      [attr.data-testid]="'manage-' + row.id"
                    >
                      Manage
                      <fl-icon name="lucideArrowRight" [size]="14" />
                    </a>
                  } @else {
                    <button
                      flButton
                      size="sm"
                      type="button"
                      [attr.aria-expanded]="setupOpen() === row.id"
                      [attr.aria-controls]="'setup-panel-' + row.id"
                      [attr.data-testid]="'setup-' + row.id"
                      (click)="toggleSetup(row.id)"
                    >
                      <fl-icon name="lucidePlus" [size]="14" />
                      Set up scaling
                    </button>
                  }
                </td>
              </tr>

              @if (setupOpen() === row.id) {
                <tr>
                  <td colspan="6" class="whitespace-normal">
                    <p
                      [id]="'setup-panel-' + row.id"
                      class="m-0 max-w-prose text-fl-body-sm text-fl-ink-secondary"
                      [attr.data-testid]="'setup-panel-' + row.id"
                    >
                      {{ row.setupCopy }}
                    </p>
                  </td>
                </tr>
              }
            </tbody>
          }
        </table>
      </div>

      <ul
        class="m-0 flex list-none flex-col gap-2 border-t border-fl-border p-4"
        data-testid="mode-legend"
      >
        @for (mode of legend(); track mode.id) {
          <li
            class="flex flex-wrap items-center gap-x-3 gap-y-1 text-fl-body-sm text-fl-ink-muted"
            [attr.data-testid]="'legend-' + mode.id"
          >
            <fl-status class="min-w-0 whitespace-normal" [tone]="mode.tone" [label]="mode.label" />
            <span class="min-w-0">{{ mode.how }}</span>
          </li>
        }
      </ul>
    </fl-panel>
  `,
})
export class OverviewClusterTableComponent {
  readonly rows = input.required<ClusterScalingRow[]>();

  private readonly route = inject(ActivatedRoute);

  protected readonly setupOpen = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: null,
  });

  private readonly cameFrom = computed(() => this.params()?.get('cluster') ?? null);

  protected readonly legend = computed<ModeCopy[]>(() => {
    const seen = new Map<string, ModeCopy>();
    for (const row of this.displayed()) {
      if (!seen.has(row.mode.id)) seen.set(row.mode.id, row.mode);
    }
    return [...seen.values()];
  });

  protected readonly displayed = computed<OverviewRow[]>(() => {
    const now = Date.now();
    const came = this.cameFrom();
    return this.rows().map((row) => this.view(row, now, came));
  });

  protected toggleSetup(clusterId: string): void {
    this.setupOpen.update((open) => (open === clusterId ? null : clusterId));
  }

  private view(row: ClusterScalingRow, now: number, came: string | null): OverviewRow {
    const mode = modeOf(row.capability, row);
    return {
      id: row.clusterId,
      name: row.clusterName,
      provider: row.capability.provider,
      mode,
      nodes: this.nodes(row),
      spend: this.spend(row),
      alarmAge: row.openAlarm ? age(row.openAlarm.since, now) : null,
      alarmSince: row.openAlarm ? `Raised ${row.openAlarm.since}` : null,
      needsPerson: row.needsPerson,
      groupId: row.groupId,
      setupCopy: this.setupCopy(row, mode.id),
      highlighted: came !== null && came === row.clusterId,
    };
  }

  private nodes(row: ClusterScalingRow): Reading {
    const bounds = row.bounds;
    if (!bounds) {
      return { value: `${row.nodes}`, sub: 'no bounds', attention: true };
    }
    return {
      value: `${row.nodes}`,
      sub: `${bounds.min} · ${bounds.desired} · ${bounds.max}`,
      attention: row.nodes < bounds.min || row.nodes > bounds.max,
    };
  }

  private spend(row: ClusterScalingRow): Reading {
    if (row.monthlyEur === null) {
      if (row.capability.billing === 'none') {
        return { value: 'No bill', sub: 'your machines', attention: false };
      }
      return { value: 'Not priced', sub: 'no price known', attention: false };
    }

    const cap = row.monthlyCap;
    const against = cap === null ? 'no spending ceiling' : `ceiling €${cap.toFixed(2)}`;
    return {
      value: eurMonth(row.monthlyEur),
      sub: row.unpricedNodes ? `at least · ${against}` : against,
      attention: cap !== null && row.monthlyEur > cap,
    };
  }

  private setupCopy(row: ClusterScalingRow, mode: ScalingMode): string {
    const bounds = `Setting up scaling for ${row.clusterName} would ask for limits in nodes: a minimum held immediately, a target approached only when the provider has the machine, and a maximum urgency may reach right now. What they can cost is shown beside them.`;
    const provider: Partial<Record<ScalingMode, string>> = {
      'flui-buys': `${row.capability.provider} can create servers through its own API, so this cluster would add nodes on its own instead of waiting on you.`,
      'you-buy': `${row.capability.provider} publishes a catalogue but has no create API, so the group would name a machine and its price and raise an alarm for you to act on.`,
      'you-attach':
        'There is no catalogue here, so the group would state what a machine has to hold rather than name one, and raise an alarm.',
    };
    return `${bounds} ${provider[mode] ?? ''} Writing one is not on this screen yet: \`flui scaling apply -f\` takes the same object as a file.`;
  }
}
