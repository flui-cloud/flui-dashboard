import { Component, input } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlStatus } from '../../../ui/primitives/status';
import {
  EdgeNow,
  InstallationNow,
  Level,
  NodeNow,
  cpuLevel,
  edgeErrorPercent,
  formatRate,
  isEdgeFailing,
  isLinkBusy,
  isMonthHeavy,
  isRateLimited,
  isSurge,
  memoryLevel,
  monthPaceLabel,
} from '../../model/installation-now.models';
import { NowLevel, UsageBounds, usageBounds } from './now-level';

@Component({
  selector: 'app-now-traffic',
  imports: [FlPanel, FlEmptyState, FlTable, FlUsageBar, FlStatus, NowLevel],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel
      title="Requests at the door"
      [count]="now().edges.length"
      [flush]="true"
      data-testid="now-edges"
    >
      @if (now().edges.length === 0) {
        <fl-empty-state title="No requests measured" [compact]="true" />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Cluster</th>
                <th scope="col" class="is-num">Req/s now</th>
                <th scope="col" class="is-num">Req/s before</th>
                <th scope="col" class="is-num">Rate-limited, 10 min</th>
                <th scope="col" class="is-num">Server errors, 10 min</th>
              </tr>
            </thead>
            <tbody>
              @for (e of now().edges; track e.clusterId) {
                <tr [attr.data-testid]="'now-edge-' + e.clusterId">
                  <td>
                    <span class="fl-row">
                      <span class="font-medium">{{ e.clusterName }}</span>
                      @if (surge(e)) {
                        <fl-status tone="warning" label="Surge" data-testid="now-surge" />
                      }
                    </span>
                  </td>
                  <td class="is-num">{{ rate(e.rpsNow) }}</td>
                  <td class="is-num text-fl-ink-muted">{{ rate(e.rpsBefore) }}</td>
                  <td class="is-num" data-testid="now-edge-limited">
                    <app-now-level
                      [level]="limited(e) ? 'warn' : 'ok'"
                      [label]="'' + e.rateLimited10m"
                    />
                  </td>
                  <td class="is-num" data-testid="now-edge-errors">
                    <app-now-level [level]="failing(e) ? 'bad' : 'ok'" [label]="errorPercent(e)" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>

    <fl-panel title="Nodes" [count]="now().nodes.length" [flush]="true" data-testid="now-nodes">
      @if (now().nodes.length === 0) {
        <fl-empty-state title="No nodes measured" [compact]="true" />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Node</th>
                <th scope="col">Cluster</th>
                <th scope="col">CPU</th>
                <th scope="col">Memory</th>
                <th scope="col" class="is-num">Link out · in</th>
                <th scope="col" class="is-num">Month at this pace</th>
              </tr>
            </thead>
            <tbody>
              @for (n of now().nodes; track n.clusterId + n.node) {
                <tr [attr.data-testid]="'now-node-' + n.node">
                  <td class="fl-mono">{{ n.node }}</td>
                  <td class="text-fl-ink-muted">{{ n.clusterName }}</td>
                  <td data-testid="now-node-cpu">
                    @if (n.cpuPercent !== null) {
                      @let cpu = bounds(cpuOf(n.cpuPercent));
                      <fl-usage-bar
                        [percent]="n.cpuPercent"
                        [label]="'CPU of ' + n.node"
                        [warnAt]="cpu.warnAt"
                        [criticalAt]="cpu.criticalAt"
                      />
                    } @else {
                      <span class="text-fl-ink-muted">–</span>
                    }
                  </td>
                  <td data-testid="now-node-memory">
                    @if (n.memoryPercent !== null) {
                      @let memory = bounds(memoryOf(n.memoryPercent));
                      <fl-usage-bar
                        [percent]="n.memoryPercent"
                        [label]="'Memory of ' + n.node"
                        [warnAt]="memory.warnAt"
                        [criticalAt]="memory.criticalAt"
                      />
                    } @else {
                      <span class="text-fl-ink-muted">–</span>
                    }
                  </td>
                  <td class="is-num" data-testid="now-node-link">
                    <app-now-level
                      [level]="linkBusy(n) ? 'warn' : 'ok'"
                      [label]="rate(n.mbpsOut) + ' · ' + rate(n.mbpsIn) + ' Mbit/s'"
                    />
                  </td>
                  <td class="is-num" data-testid="now-node-month">
                    @if (n.includedTb === null) {
                      <span class="text-fl-ink-muted">{{ month(n) }}</span>
                    } @else {
                      <app-now-level [level]="monthHeavy(n) ? 'warn' : 'ok'" [label]="month(n)" />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>
  `,
})
export class NowTrafficComponent {
  readonly now = input.required<InstallationNow>();

  protected surge(e: EdgeNow): boolean {
    return isSurge(e, this.now().thresholds);
  }

  protected limited(e: EdgeNow): boolean {
    return isRateLimited(e, this.now().thresholds);
  }

  protected failing(e: EdgeNow): boolean {
    return isEdgeFailing(e, this.now().thresholds);
  }

  protected errorPercent(e: EdgeNow): string {
    const percent = edgeErrorPercent(e);
    if (percent === null) return '–';
    return percent > 0 && percent < 1 ? '<1%' : `${Math.round(percent)}%`;
  }

  protected linkBusy(n: NodeNow): boolean {
    return isLinkBusy(n, this.now().thresholds);
  }

  protected monthHeavy(n: NodeNow): boolean {
    return isMonthHeavy(n, this.now().thresholds);
  }

  protected month(n: NodeNow): string {
    return monthPaceLabel(n);
  }

  protected cpuOf(percent: number | null): Level {
    return cpuLevel(percent);
  }

  protected memoryOf(percent: number | null): Level {
    return memoryLevel(percent);
  }

  protected bounds(level: Level): UsageBounds {
    return usageBounds(level);
  }

  protected rate(value: number): string {
    return formatRate(value);
  }
}
