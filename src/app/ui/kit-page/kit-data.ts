import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlLineChart } from '../patterns/chart';
import { FlCopyId } from '../patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../patterns/key-value';
import { FlMetric, FlMetricStrip } from '../patterns/metric-strip';
import { FlPanel } from '../patterns/panel';
import { FlTable } from '../patterns/table';
import { FlUsageBar } from '../patterns/usage-bar';
import { FlSearchInput, FlChip, FlSegmented, FlToolbar } from '../patterns/filter-bar';
import { FlStatus, StatusTone } from '../primitives/status';
import { FlTag } from '../primitives/tag';

interface Row {
  readonly name: string;
  readonly role: string;
  readonly status: StatusTone;
  readonly statusLabel: string;
  readonly cpu: number;
  readonly memory: number;
  readonly memoryText: string;
  readonly type: string;
}

const ROWS: readonly Row[] = [
  {
    name: 'node-fsn1-1',
    role: 'control plane',
    status: 'success',
    statusLabel: 'Ready',
    cpu: 12.4,
    memory: 56.6,
    memoryText: '4.3 of 7.6 GB',
    type: 'cx33',
  },
  {
    name: 'node-fsn1-2',
    role: 'worker',
    status: 'warning',
    statusLabel: 'Above threshold',
    cpu: 84.2,
    memory: 71.0,
    memoryText: '5.4 of 7.6 GB',
    type: 'cx33',
  },
  {
    name: 'node-nbg1-1',
    role: 'worker',
    status: 'progress',
    statusLabel: 'Pending',
    cpu: 0,
    memory: 0,
    memoryText: '0 of 7.6 GB',
    type: 'cx33',
  },
];

@Component({
  selector: 'fl-kit-data',
  host: { class: 'fl-stack' },
  imports: [
    RouterLink,
    FlPanel,
    FlTable,
    FlStatus,
    FlTag,
    FlUsageBar,
    FlMetricStrip,
    FlMetric,
    FlKeyValue,
    FlKvItem,
    FlCopyId,
    FlLineChart,
    FlToolbar,
    FlSearchInput,
    FlChip,
    FlSegmented,
  ],
  template: `
    <fl-metric-strip>
      <fl-metric label="Clusters" value="2" caption="1 control plane" />
      <fl-metric label="CPU" value="41.3%" caption="3.3 of 8 cores" />
      <fl-metric label="Memory" value="83.1%" caption="Above 80%" tone="warning" />
      <fl-metric label="Backups" value="12 of 12" caption="Protected" tone="success" />
    </fl-metric-strip>

    <fl-panel title="Nodes" [count]="rows().length" [flush]="true">
      <fl-toolbar panelToolbar>
        <fl-search-input [(value)]="query" label="Search nodes" placeholder="Search nodes" />
        <button flChip [(pressed)]="onlyIssues">
          Needs attention <span class="fl-chip__count">(1)</span>
        </button>
        <fl-segmented label="Time range" [options]="ranges" [(value)]="range" />
        <span toolbarEnd class="fl-toolbar__info">{{ rows().length }} items</span>
      </fl-toolbar>
      <div class="fl-table-wrap">
        <table flTable>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Status</th>
              <th scope="col">CPU</th>
              <th scope="col">Memory</th>
              <th scope="col">Type</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.name) {
              <tr>
                <td>
                  <a class="fl-link" routerLink="/kit">{{ row.name }}</a>
                  <fl-tag class="ml-2">{{ row.role }}</fl-tag>
                </td>
                <td><fl-status [tone]="row.status" [label]="row.statusLabel" /></td>
                <td>
                  <fl-usage-bar [percent]="row.cpu" [label]="row.name + ' CPU'" aside="2 vCPU" />
                </td>
                <td>
                  <fl-usage-bar
                    [percent]="row.memory"
                    [label]="row.name + ' memory'"
                    [aside]="row.memoryText"
                    [warnAt]="70"
                  />
                </td>
                <td class="fl-mono">{{ row.type }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>

    <div class="fl-grid-2">
      <fl-panel title="Details">
        <fl-key-value>
          <fl-kv-item key="Provider">Hetzner Cloud</fl-kv-item>
          <fl-kv-item key="Region" [mono]="true">fsn1</fl-kv-item>
          <fl-kv-item key="Created">13 Sep 2026, 17:26</fl-kv-item>
          <fl-kv-item key="Cluster ID"
            ><fl-copy-id value="cl_7f3a9c2e41" label="cluster ID"
          /></fl-kv-item>
        </fl-key-value>
      </fl-panel>
      <fl-panel title="Memory">
        <fl-line-chart
          [series]="chart"
          [xLabels]="['12:00', '13:00', '14:00', '15:00', '16:00']"
          [yLabels]="['100%', '50%', '0%']"
          [warning]="{ label: 'Warning 80%', value: 80 }"
          [critical]="{ label: 'Critical 90%', value: 90 }"
          reading="Memory rose from 52% to 83%, above the 80% warning"
        />
      </fl-panel>
    </div>
  `,
})
export class KitData {
  protected readonly query = signal('');
  protected readonly onlyIssues = signal(false);
  protected readonly range = signal('1h');
  protected readonly ranges = [
    { value: '1h', label: '1h' },
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
  ];
  protected readonly rows = computed(() =>
    ROWS.filter(
      (r) => r.name.includes(this.query()) && (!this.onlyIssues() || r.status === 'warning'),
    ),
  );
  protected readonly chart = [
    { label: 'node-fsn1-1', points: [52, 55, 58, 60, 64, 63, 70, 74, 79, 83] },
    { label: 'node-fsn1-2', points: [40, 41, 45, 44, 48, 50, 49, 53, 55, 58] },
  ];
}
