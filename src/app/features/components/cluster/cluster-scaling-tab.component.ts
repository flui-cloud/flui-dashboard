import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { ClusterScalingRow } from '../../model/scaling-section.models';
import { ScalingApiService } from '../../service/scaling-api.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { loadedOf } from '../scaling-section/section-reading';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlMetricStrip } from '../../../ui/patterns/metric-strip';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlErrorState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { ScalingTileComponent } from './scaling-tile.component';
import { ScalingFleetTileComponent } from './scaling-fleet-tile.component';
import { ScalingGrowthCardComponent } from './scaling-growth-card.component';
import { ScalingDecisionsTableComponent } from './scaling-decisions-table.component';
import { ScalingLimitsDialogComponent } from './scaling-limits-dialog.component';
import { ScalingGroupFormComponent } from './scaling-group-form.component';

@Component({
  selector: 'cluster-scaling-tab',
  imports: [
    FlAlert,
    FlPanel,
    FlMetricStrip,
    FlErrorState,
    FlLoadingState,
    FlEmptyState,
    FlStatus,
    ScalingTileComponent,
    ScalingFleetTileComponent,
    ScalingGrowthCardComponent,
    ScalingDecisionsTableComponent,
    ScalingLimitsDialogComponent,
    ScalingGroupFormComponent,
  ],
  host: { class: 'fl-stack', 'data-testid': 'cluster-scaling-tab' },
  template: `
    @if (loading()) {
      <fl-panel title="Scaling">
        <fl-loading-state [rows]="4" data-testid="skeleton-cluster-scaling" />
      </fl-panel>
    } @else if (failed(); as message) {
      <fl-panel title="Scaling">
        <fl-error-state
          title="Could not load scaling"
          [reason]="message"
          [compact]="true"
          data-testid="failure-cluster-scaling"
          (retry)="rowRes.reload()"
        />
      </fl-panel>
    } @else if (row(); as row) {
      @if (row.needsPerson) {
        <fl-alert tone="warning" title="Needs your attention" data-testid="state-line">
          {{ stateLine() }}
        </fl-alert>
      }

      <fl-panel title="Current state">
        <span panelActions class="fl-mono text-fl-ink-muted" data-testid="subject">
          {{ row.clusterName }} · {{ row.capability.provider }}
        </span>
        <div class="flex flex-col gap-4">
          @if (!row.needsPerson) {
            <p class="m-0 flex flex-wrap items-center gap-2" data-testid="state-line">
              <fl-status
                [tone]="row.groupCount === 0 ? 'neutral' : 'success'"
                [label]="row.groupCount === 0 ? 'Not set up' : 'Within limits'"
              />
              <span class="text-fl-body-sm text-fl-ink-secondary">{{ stateLine() }}</span>
            </p>
          }
          <fl-metric-strip>
            <app-scaling-fleet-tile [note]="limitsNote()" [row]="row" (changed)="onGroupSaved()" />
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
              unit="apps"
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
          </fl-metric-strip>
        </div>
      </fl-panel>

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
      <fl-panel title="Scaling">
        <fl-empty-state
          [compact]="true"
          title="No scaling for this cluster"
          body="The API has no scaling row for this cluster. Either it is gone, or this build does not serve the route."
          data-testid="no-such-cluster"
        />
      </fl-panel>
    }
  `,
})
export class ClusterScalingTabComponent {
  private readonly api = inject(ScalingApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly autoscale = inject(ClusterAutoscaleService);

  private readonly parent = this.route.parent ?? this.route;
  private readonly params = toSignal(this.parent.paramMap, {
    initialValue: this.parent.snapshot.paramMap,
  });

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
  protected readonly decisions = computed(() =>
    this.decisionsRes.hasValue() ? this.decisionsRes.value() : [],
  );

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
      ? 'Within its limits. Flui will add a node if one is needed.'
      : 'Within its limits, and nothing is waiting on you.';
  });

  protected readonly pressure = computed(() => {
    const metrics = this.autoscale.status()?.metrics;
    const memory = metrics?.memoryPct ?? null;
    const cpu = metrics?.cpuPct ?? null;
    if (memory == null && cpu == null) {
      return {
        value: '—',
        unit: '',
        note: 'the cluster could not be asked',
        attention: false,
      };
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
      return {
        value: '—',
        note: 'the cluster could not be asked',
        attention: false,
      };
    }
    const note = row.pendingPods === 0 ? 'everything is running' : 'nowhere to run';
    return {
      value: `${row.pendingPods}`,
      note,
      attention: row.pendingPods > 0 || row.blockedOrders > 0,
    };
  });

  protected readonly spend = computed(() => {
    const row = this.row();
    if (!row) return { value: '—', unit: '', note: '' };
    const value = row.monthlyEur == null ? '—' : `€${row.monthlyEur.toFixed(2)}`;
    const cap = row.monthlyCap != null ? `ceiling €${row.monthlyCap.toFixed(0)}/mo · ` : '';
    const unpriced = row.unpricedNodes > 0 ? ` · ${row.unpricedNodes} unpriced` : '';
    return {
      value,
      unit: '/mo',
      note: `${cap}${row.nodes} ${row.nodes === 1 ? 'node' : 'nodes'}${unpriced}`,
    };
  });
}
