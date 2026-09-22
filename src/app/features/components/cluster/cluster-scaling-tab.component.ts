import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideCircleCheck } from '@ng-icons/lucide';

import { ClusterScalingRow } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { loadedOf } from '../scaling-section/section-reading';
import { SectionFailureComponent, SectionSkeletonComponent } from '../scaling-section/section-states.component';
import { ScalingTileComponent } from './scaling-tile.component';
import { ScalingFleetTileComponent } from './scaling-fleet-tile.component';
import { ScalingGrowthCardComponent } from './scaling-growth-card.component';
import { ScalingDecisionsTableComponent } from './scaling-decisions-table.component';
import { ScalingLimitsDialogComponent } from './scaling-limits-dialog.component';
import { ScalingGroupFormComponent } from './scaling-group-form.component';

@Component({
  selector: 'cluster-scaling-tab',
  standalone: true,
  imports: [
    NgIcon,
    SectionFailureComponent,
    SectionSkeletonComponent,
    ScalingTileComponent,
    ScalingFleetTileComponent,
    ScalingGrowthCardComponent,
    ScalingDecisionsTableComponent,
    ScalingLimitsDialogComponent,
    ScalingGroupFormComponent,
  ],
  providers: [provideIcons({ lucideCircleAlert, lucideCircleCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4" data-testid="cluster-scaling-tab">
      @if (loading()) {
        <app-section-skeleton variant="cards" [count]="4" label="this cluster's scaling" testid="cluster-scaling" />
      } @else if (failed(); as message) {
        <app-section-failure [message]="message" testid="cluster-scaling" (retry)="rowRes.reload()" />
      } @else if (row(); as row) {
        <div class="flex items-baseline gap-2.5">
          <h2 class="m-0 text-xl font-semibold tracking-tight text-foreground">Scaling</h2>
          <span class="font-mono text-[13px] text-muted-foreground" data-testid="subject">
            {{ row.clusterName }} · {{ row.capability.provider }}
          </span>
        </div>

        <div
          class="flex items-start gap-2.5 rounded-lg border px-3.5 py-3"
          [class]="row.needsPerson ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20' : 'border-border bg-card'"
          data-testid="state-line"
        >
          <ng-icon
            [name]="row.needsPerson ? 'lucideCircleAlert' : 'lucideCircleCheck'"
            class="h-4 w-4 shrink-0 translate-y-0.5"
            [class]="row.needsPerson ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-500'"
          />
          <span class="text-[13px] leading-relaxed text-foreground">{{ stateLine() }}</span>
        </div>

        <div class="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <app-scaling-fleet-tile [note]="limitsNote()" />
          <app-scaling-tile
            label="Pressure"
            testid="pressure"
            [value]="pressure().value"
            [unit]="pressure().unit"
            [note]="pressure().note"
            [attention]="pressure().attention"
          />
          <app-scaling-tile
            label="Waiting"
            testid="waiting"
            [value]="waiting().value"
            unit="pods"
            [note]="waiting().note"
            [attention]="waiting().attention"
          />
          <app-scaling-tile
            label="Spend"
            testid="spend"
            [value]="spend().value"
            [unit]="spend().unit"
            [note]="spend().note"
          />
        </div>

        <app-scaling-growth-card
          [row]="row"
          (editLimits)="editingLimits.set(true)"
          (setUp)="editingGroup.set(true)"
        />

        <app-scaling-decisions-table [decisions]="decisions()" [groupId]="row.groupId" />

        @if (editingLimits() && clusterId(); as cid) {
          <app-scaling-limits-dialog [clusterId]="cid" (closed)="editingLimits.set(false)" />
        }

        @if (editingGroup() && clusterId(); as cid) {
          <app-scaling-group-form
            [clusterId]="cid"
            [existing]="group()"
            [currentNodes]="row.nodes"
            (saved)="onGroupSaved()"
            (closed)="editingGroup.set(false)"
          />
        }
      } @else {
        <p class="m-0 text-sm text-muted-foreground" data-testid="no-such-cluster">
          The API has no scaling row for this cluster. Either it is gone, or this build does not serve the route.
        </p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class ClusterScalingTabComponent {
  private readonly api = inject(ScalingApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly autoscale = inject(ClusterAutoscaleService);

  private readonly parent = this.route.parent ?? this.route;
  private readonly params = toSignal(this.parent.paramMap, { initialValue: this.parent.snapshot.paramMap });

  protected readonly clusterId = computed(() => this.params().get('id'));
  protected readonly editingLimits = signal(false);
  protected readonly editingGroup = signal(false);

  protected readonly rowRes = rxResource({
    params: () => this.clusterId() ?? undefined,
    stream: ({ params }) => this.api.row(params),
  });

  /** The group behind this cluster, when it has exactly one the dashboard owns. */
  private readonly groupRes = rxResource({
    params: () => this.row()?.groupId ?? undefined,
    stream: ({ params }) => this.api.group(params),
  });

  protected readonly group = computed(() => this.groupRes.value() ?? null);

  private readonly decisionsRes = rxResource({
    params: () => this.clusterId() ?? undefined,
    stream: ({ params }) => this.api.clusterDecisions(params, 5),
  });

  private readonly loaded = loadedOf<ClusterScalingRow>(this.rowRes, "This cluster's scaling");

  protected readonly loading = computed(() => this.loaded().loading);
  protected readonly failed = computed(() => this.loaded().failed);
  protected readonly row = computed(() => this.loaded().data);
  protected readonly decisions = computed(() => this.decisionsRes.value() ?? []);

  protected onGroupSaved(): void {
    this.rowRes.reload();
    this.decisionsRes.reload();
    this.groupRes.reload();
  }

  /** The limits actually in force: the group's when it has them, the cluster's otherwise. */
  protected readonly limitsNote = computed(() => {
    const bounds = this.row()?.bounds;
    if (bounds) return `floor ${bounds.min} · target ${bounds.desired} · ceiling ${bounds.max}`;
    const status = this.autoscale.status();
    if (status?.minNodes == null && status?.maxNodes == null) return 'no limits set';
    return `floor ${status?.minNodes ?? 1} · ceiling ${status?.maxNodes ?? '—'}`;
  });

  protected readonly stateLine = computed(() => {
    const row = this.row();
    if (!row) return '';
    if (row.needsPerson) return row.needsPerson;
    if (row.groupCount === 0) {
      return 'No scaling set up. This cluster will not grow on its own, and nothing will raise an alarm.';
    }
    return row.acts
      ? 'Within its limits. Flui will buy a node if one is needed.'
      : 'Within its limits, and nothing is waiting on you.';
  });

  protected readonly pressure = computed(() => {
    const metrics = this.autoscale.status()?.metrics;
    const memory = metrics?.memoryPct ?? null;
    const cpu = metrics?.cpuPct ?? null;
    if (memory == null && cpu == null) {
      return { value: '—', unit: '', note: 'the cluster could not be asked', attention: false };
    }
    const thresholds = this.autoscale.status()?.effectiveThresholds;
    const warnMemory = thresholds?.warnMemoryPct ?? 75;
    const leadsOnMemory = (memory ?? 0) >= (cpu ?? 0);
    const value = leadsOnMemory ? memory : cpu;
    return {
      value: value == null ? '—' : value.toFixed(0),
      unit: leadsOnMemory ? '% memory' : '% CPU',
      note: leadsOnMemory
        ? `CPU ${cpu?.toFixed(0) ?? '—'}% · worth watching at ${warnMemory}%`
        : `memory ${memory?.toFixed(0) ?? '—'}% · worth watching at ${thresholds?.warnCpuPct ?? 70}%`,
      attention: (value ?? 0) >= warnMemory,
    };
  });

  protected readonly waiting = computed(() => {
    const row = this.row();
    if (row?.pendingPods == null) {
      return { value: '—', note: 'the cluster could not be asked', attention: false };
    }
    const note = row.pendingPods === 0 ? 'every pod is placed' : 'pods with nowhere to run';
    return { value: `${row.pendingPods}`, note, attention: row.pendingPods > 0 || row.blockedOrders > 0 };
  });

  protected readonly spend = computed(() => {
    const row = this.row();
    if (!row) return { value: '—', unit: '', note: '' };
    const value = row.monthlyEur == null ? '—' : `€${row.monthlyEur.toFixed(2)}`;
    const cap = row.monthlyCap != null ? `ceiling €${row.monthlyCap.toFixed(0)}/mo · ` : '';
    const unpriced = row.unpricedNodes > 0 ? ` · ${row.unpricedNodes} unpriced` : '';
    return { value, unit: '/mo', note: `${cap}${row.nodes} ${row.nodes === 1 ? 'node' : 'nodes'}${unpriced}` };
  });
}
