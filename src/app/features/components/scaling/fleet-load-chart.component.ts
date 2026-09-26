import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (series(); as s) {
      <section class="card-surface space-y-2 p-4" data-testid="load-chart">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="m-0 text-[13px] font-semibold text-foreground">
            Reserved vs capacity
            <span class="ml-1 font-normal text-muted-foreground">since {{ s.since }}</span>
          </h3>
          <div class="inline-flex rounded-md border border-border p-0.5 text-[12px]">
            @for (r of resources; track r) {
              <button
                type="button"
                class="rounded px-2 py-0.5"
                [class]="resource() === r ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'"
                (click)="resource.set(r)"
                [attr.data-testid]="'load-' + r"
              >
                {{ r === 'memory' ? 'Memory' : 'CPU' }}
              </button>
            }
          </div>
        </div>
        <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="block h-auto w-full" preserveAspectRatio="xMidYMid meet"
          role="img" [attr.aria-label]="'Reserved ' + resource() + ' against what the nodes hold'">
          <text [attr.x]="L - 6" [attr.y]="T + 4" text-anchor="end" class="fill-muted-foreground text-[10px]">{{ s.topLabel }}</text>
          <text [attr.x]="L - 6" [attr.y]="B" text-anchor="end" class="fill-muted-foreground text-[10px]">0</text>
          <line [attr.x1]="L" [attr.x2]="R" [attr.y1]="B" [attr.y2]="B" class="stroke-border" stroke-width="1" />
          <path [attr.d]="s.reservedArea" class="fill-sky-500/25" />
          <path [attr.d]="s.reservedLine" fill="none" class="stroke-sky-600 dark:stroke-sky-400" stroke-width="1.5" />
          <path [attr.d]="s.capacityLine" fill="none" class="stroke-foreground" stroke-width="1.5" stroke-dasharray="5 4" />
        </svg>
        <p class="m-0 flex flex-wrap gap-x-4 text-[12px] text-muted-foreground">
          <span><span class="mr-1 inline-block h-2 w-3 rounded-sm bg-sky-500/60 align-middle"></span>reserved by running apps</span>
          <span><span class="mr-1 inline-block w-4 border-t border-dashed border-foreground align-middle"></span>what the nodes hold</span>
          <span>now {{ s.nowLabel }}</span>
        </p>
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
    const reserved = withLoad.map((p) => (cpu ? p.load!.reservedCpuMillicores : p.load!.reservedMemoryMi));
    const capacity = withLoad.map((p) => (cpu ? p.load!.capacityCpuMillicores : p.load!.capacityMemoryMi));
    const top = Math.max(1, ...reserved, ...capacity) * 1.1;
    const t0 = withLoad[0].at.getTime();
    const t1 = withLoad.at(-1)!.at.getTime();
    const x = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * (R - L);
    const y = (v: number) => B - (v / top) * (B - T);
    const line = (values: number[]) =>
      values.map((v, i) => `${i ? 'L' : 'M'}${x(withLoad[i].at.getTime()).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const reservedLine = line(reserved);
    const reservedArea = `${reservedLine} L${x(t1).toFixed(1)},${B} L${x(t0).toFixed(1)},${B} Z`;
    const fmt = (v: number) => (cpu ? `${(v / 1000).toFixed(1)} CPU` : `${(v / 1024).toFixed(1)} GiB`);
    return {
      reservedLine,
      reservedArea,
      capacityLine: line(capacity),
      topLabel: fmt(top),
      nowLabel: `${fmt(reserved.at(-1)!)} of ${fmt(capacity.at(-1)!)}`,
      since: withLoad[0].at.toLocaleDateString([], { day: 'numeric', month: 'short' }),
    };
  });
}
