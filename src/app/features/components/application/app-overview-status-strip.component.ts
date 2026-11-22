import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlStatus } from '../../../ui/primitives/status';
import { statusToneOf } from '../dashboard/home-state';
import { formatCores, formatUsageBytes, limitPercent, runStateOf } from './app-overview-view';

@Component({
  selector: 'app-overview-status-strip',
  imports: [RouterLink, FlPanel, FlStatus, FlUsageBar],
  host: { class: 'block' },
  template: `
    @let s = state();
    <fl-panel title="Live usage" data-testid="overview-status">
      <a panelActions class="fl-link text-fl-body-sm" [routerLink]="['../monitoring']"
        >Monitoring</a
      >
      <div class="flex flex-col gap-4">
        <fl-status [tone]="tone()" [label]="s.label" />
        <div class="grid gap-4 sm:grid-cols-2">
          @for (bar of bars(); track bar.key) {
            <fl-usage-bar
              [percent]="bar.percent"
              [label]="bar.key"
              [aside]="bar.aside"
              [warnAt]="bar.warnAt"
              [criticalAt]="90"
            />
          }
        </div>
      </div>
    </fl-panel>
  `,
})
export class AppOverviewStatusStripComponent {
  readonly metrics = input.required<AppMetricsDto>();
  readonly appStatus = input<string | null | undefined>(null);

  protected readonly state = computed(() => runStateOf(this.metrics(), this.appStatus()));
  protected readonly tone = computed(() => statusToneOf(this.state().tone));

  protected readonly bars = computed(() => {
    const m = this.metrics();
    return [
      {
        key: 'CPU',
        percent: limitPercent(m.cpu.usage_cores, m.cpu.limits_cores),
        aside: asideOf('CPU', m.cpu.usage_cores, m.cpu.limits_cores, formatCores),
        warnAt: 70,
      },
      {
        key: 'Memory',
        percent: limitPercent(m.memory.usage_bytes, m.memory.limits_bytes),
        aside: asideOf('Memory', m.memory.usage_bytes, m.memory.limits_bytes, formatUsageBytes),
        warnAt: 75,
      },
    ];
  });
}

function asideOf(
  key: string,
  usage: number | null | undefined,
  limit: number | null | undefined,
  format: (value: number) => string,
): string {
  const used = format(usage ?? 0);
  return limit && limit > 0 ? `${key} · ${used} of ${format(limit)}` : `${key} · ${used}, no limit`;
}
