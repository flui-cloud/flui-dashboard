import { Component, computed, input, signal } from '@angular/core';
import { FleetHistoryPoint } from '../../model/scaling-section.models';

type Resource = 'memory' | 'cpu';

const W = 720;
const H = 120;
const L = 44;
const R = 712;
const T = 8;
const B = 100;

@Component({
  selector: 'app-fleet-load-chart',
  styleUrl: './fleet-chart.css',
  host: { class: 'block' },
  template: `
    @if (series(); as s) {
      <section class="flex flex-col gap-3 border-t border-fl-border pt-4" data-testid="load-chart">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="m-0 text-fl-body-sm font-semibold text-fl-ink">
            Reserved vs capacity
            <span class="ml-1 font-normal text-fl-ink-muted">since {{ s.since }}</span>
          </h3>
          <div class="fl-segmented" role="group" aria-label="Resource">
            @for (r of resources; track r) {
              <button
                type="button"
                [attr.aria-pressed]="resource() === r"
                (click)="resource.set(r)"
                [attr.data-testid]="'load-' + r"
              >
                {{ r === 'memory' ? 'Memory' : 'CPU' }}
              </button>
            }
          </div>
        </div>
        <svg
          [attr.viewBox]="'0 0 ' + W + ' ' + H"
          class="block h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          [attr.aria-label]="'Reserved ' + resource() + ' against what the nodes hold'"
        >
          <text [attr.x]="L - 6" [attr.y]="T + 4" text-anchor="end" class="tick">
            {{ s.topLabel }}
          </text>
          <text [attr.x]="L - 6" [attr.y]="B" text-anchor="end" class="tick">0</text>
          <line [attr.x1]="L" [attr.x2]="R" [attr.y1]="B" [attr.y2]="B" class="axis" />
          <path [attr.d]="s.reservedArea" class="reserved" />
          <path [attr.d]="s.reservedLine" class="reserved-line" />
          <path [attr.d]="s.capacityLine" class="capacity-line" />
        </svg>
        <div class="fl-legend">
          <span>
            <svg width="16" height="8" aria-hidden="true">
              <rect x="0" y="1" width="16" height="6" class="reserved" />
              <line x1="0" y1="1" x2="16" y2="1" class="reserved-line" />
            </svg>
            reserved by running apps
          </span>
          <span>
            <svg width="16" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="16" y2="3" class="capacity-line" />
            </svg>
            what the nodes hold
          </span>
          <span class="fl-num">now {{ s.nowLabel }}</span>
        </div>
      </section>
    }
  `,
})
export class FleetLoadChartComponent {
  readonly points = input.required<FleetHistoryPoint[]>();

  protected readonly W = W;
  protected readonly H = H;
  protected readonly L = L;
  protected readonly T = T;
  protected readonly B = B;
  protected readonly R = R;
  protected readonly resources: Resource[] = ['memory', 'cpu'];
  protected readonly resource = signal<Resource>('memory');

  protected readonly series = computed(() => {
    const withLoad = this.points().filter((p) => p.load);
    if (withLoad.length < 2) return null;
    const cpu = this.resource() === 'cpu';
    const reserved = withLoad.map((p) =>
      cpu ? p.load!.reservedCpuMillicores : p.load!.reservedMemoryMi,
    );
    const capacity = withLoad.map((p) =>
      cpu ? p.load!.capacityCpuMillicores : p.load!.capacityMemoryMi,
    );
    const top = Math.max(1, ...reserved, ...capacity) * 1.1;
    const t0 = withLoad[0].at.getTime();
    const t1 = withLoad.at(-1)!.at.getTime();
    const x = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * (R - L);
    const y = (v: number) => B - (v / top) * (B - T);
    const line = (values: number[]) =>
      values
        .map(
          (v, i) => `${i ? 'L' : 'M'}${x(withLoad[i].at.getTime()).toFixed(1)},${y(v).toFixed(1)}`,
        )
        .join(' ');
    const reservedLine = line(reserved);
    const reservedArea = `${reservedLine} L${x(t1).toFixed(1)},${B} L${x(t0).toFixed(1)},${B} Z`;
    const fmt = (v: number) =>
      cpu ? `${(v / 1000).toFixed(1)} CPU` : `${(v / 1024).toFixed(1)} GiB`;
    return {
      reservedLine,
      reservedArea,
      capacityLine: line(capacity),
      topLabel: fmt(top),
      nowLabel: `${fmt(reserved.at(-1)!)} of ${fmt(capacity.at(-1)!)}`,
      since: withLoad[0].at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    };
  });
}
