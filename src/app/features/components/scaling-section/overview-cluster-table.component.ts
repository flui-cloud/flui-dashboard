import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideBellRing,
  lucidePlus,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { ClusterScalingRow } from '../../model/scaling-section.models';
import {
  ModeCopy,
  Reading,
  ScalingMode,
  TABLE,
  age,
  eurMonth,
  modeOf,
} from './overview-format';
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
  standalone: true,
  imports: [NgIcon, OverviewReadingComponent, RouterLink],
  providers: [
    provideIcons({ lucideArrowRight, lucideBellRing, lucidePlus, lucideTriangleAlert }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="t.card">
      <div [class]="t.scroll">
        <table [class]="t.table" data-testid="cluster-table">
          <thead>
            <tr [class]="t.headRow">
              <th scope="col" [class]="t.th + ' pl-4'">Cluster</th>
              <th scope="col" [class]="t.th">Who can add a node</th>
              <th scope="col" [class]="t.thNum">Nodes</th>
              <th scope="col" [class]="t.thNum">Spend</th>
              <th scope="col" [class]="t.th + ' pr-4'" aria-label="Actions"></th>
            </tr>
          </thead>

          @for (row of displayed(); track row.id) {
            <tbody
              [class]="t.row + ' last:border-0'"
              [attr.data-testid]="'cluster-' + row.id"
            >
              <tr
                [attr.data-testid]="'row-' + row.id"
                [attr.data-attention]="row.needsPerson ? 'yes' : 'no'"
                [attr.aria-current]="row.highlighted ? 'true' : null"
              >
                <th scope="row" [class]="t.td + ' pl-4 font-normal'">
                  <span [class]="t.mono"
                    >{{ row.name
                    }}<span class="font-sans text-muted-foreground"> · {{ row.provider }}</span></span
                  >
                  @if (row.highlighted) {
                    <span
                      [class]="t.pill + ' ml-2 bg-primary/10 text-primary'"
                      [attr.data-testid]="'came-from-' + row.id"
                    >
                      You came from here
                    </span>
                  }
                </th>

                <td [class]="t.td">
                  <span
                    [class]="t.pill + ' ' + row.mode.pill"
                    [attr.data-testid]="'mode-' + row.id"
                  >
                    {{ row.mode.label }}
                  </span>
                </td>

                <td [class]="t.tdNum" [attr.data-testid]="'nodes-' + row.id">
                  <app-overview-reading [reading]="row.nodes" />
                </td>

                <td [class]="t.tdNum" [attr.data-testid]="'spend-' + row.id">
                  <app-overview-reading [reading]="row.spend" />
                </td>

                <td [class]="t.td + ' pr-4 text-right'">
                  @if (row.groupId; as groupId) {
                    <a
                      [routerLink]="['/scaling', groupId]"
                      class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      [attr.data-testid]="'manage-' + row.id"
                    >
                      Manage
                      <ng-icon name="lucideArrowRight" class="h-4 w-4" />
                    </a>
                  } @else {
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      [attr.aria-expanded]="setupOpen() === row.id"
                      [attr.aria-controls]="'setup-panel-' + row.id"
                      [attr.data-testid]="'setup-' + row.id"
                      (click)="toggleSetup(row.id)"
                    >
                      <ng-icon name="lucidePlus" class="h-4 w-4" />
                      Set up scaling
                    </button>
                  }
                </td>
              </tr>

              @if (row.needsPerson || row.alarmAge) {
                <tr>
                  <td colspan="5" class="px-4 pb-2 pt-0">
                    <p class="m-0 flex flex-wrap items-baseline gap-x-2 text-[13px] leading-snug">
                      <ng-icon
                        name="lucideTriangleAlert"
                        class="status-degraded h-3.5 w-3.5 shrink-0 translate-y-0.5"
                      />
                      @if (row.alarmAge; as alarmAge) {
                        <span
                          [class]="t.pill + ' badge-error'"
                          [attr.title]="row.alarmSince"
                          [attr.data-testid]="'alarm-' + row.id"
                        >
                          <ng-icon name="lucideBellRing" class="h-3 w-3" />
                          <span class="tabular-nums">open {{ alarmAge }}</span>
                        </span>
                      }
                      <span
                        class="font-medium text-foreground"
                        [attr.data-testid]="'needs-person-' + row.id"
                        >Needs a person<span class="ml-2 font-normal text-muted-foreground">{{
                          row.needsPerson ?? 'An alarm is open, and it stands until this group decides something else.'
                        }}</span></span
                      >
                    </p>
                  </td>
                </tr>
              }

              @if (setupOpen() === row.id) {
                <tr>
                  <td colspan="5" class="px-4 pb-3 pt-0">
                    <p
                      [id]="'setup-panel-' + row.id"
                      [class]="t.note + ' max-w-prose rounded-md border border-border p-3'"
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
        class="m-0 list-none space-y-1.5 border-t border-border px-4 py-3"
        data-testid="mode-legend"
      >
        @for (mode of legend(); track mode.id) {
          <li
            class="flex flex-wrap items-baseline gap-x-2 text-[12px] leading-snug text-muted-foreground"
            [attr.data-testid]="'legend-' + mode.id"
          >
            <span class="w-[10.5rem] shrink-0">
              <span [class]="t.pill + ' ' + mode.pill">{{ mode.label }}</span>
            </span>
            {{ mode.how }}
          </li>
        }
      </ul>
    </div>
  `,
})
export class OverviewClusterTableComponent {
  readonly rows = input.required<ClusterScalingRow[]>();

  private readonly route = inject(ActivatedRoute);

  protected readonly t = TABLE;

  protected readonly setupOpen = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: null });

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
    const against = cap === null ? 'no cap' : `cap €${cap}`;
    return {
      value: eurMonth(row.monthlyEur),
      sub: row.unpricedNodes ? `at least · ${against}` : against,
      attention: cap !== null && row.monthlyEur > cap,
    };
  }

  private setupCopy(row: ClusterScalingRow, mode: ScalingMode): string {
    const bounds = `Setting up scaling for ${row.clusterName} would ask for three bounds: a floor held immediately, a target approached only when the market allows, and a ceiling urgency may reach right now.`;
    const provider: Partial<Record<ScalingMode, string>> = {
      'flui-buys': `${row.capability.provider} can create servers through its own API, so this cluster would buy for itself instead of waiting on you.`,
      'you-buy': `${row.capability.provider} publishes a catalogue but has no create API, so the group would name a shape and its price and raise an alarm for you to act on.`,
      'you-attach':
        'There is no catalogue here, so the group would state what a machine has to hold rather than name a shape, and raise an alarm.',
    };
    return `${bounds} ${provider[mode] ?? ''} Writing one is not on this screen yet — \`flui scaling apply -f\` takes the same object as a file.`;
  }
}
