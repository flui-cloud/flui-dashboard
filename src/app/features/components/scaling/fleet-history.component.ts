import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEuro, lucideServer } from '@ng-icons/lucide';
import {
  DEFAULT_CHART_COLORS,
  DISTRIBUTION_PALETTE,
} from '../../../shared/components/charts/chart.models';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { FleetHistoryDetailComponent } from './fleet-history-detail.component';
import { ScalingDecision } from '../../model/scaling-group.models';
import {
  HOURS_PER_MONTH,
  PlotBox,
  areaPath,
  dayLabel,
  fleetDomain,
  linePath,
  nodeScale,
  shapesInOrder,
  spendScale,
  stackTotal,
  tickAnchor,
  tickIndexes,
  whenLabel,
  xAt,
  yAt,
} from './fleet-history.geometry';

type HistoryMode = 'nodes' | 'spend';

export interface FleetPoint {
  at: Date;
  byShape: Record<string, number>;
  hourlyEur: number;
}

interface ShapeBand {
  shape: string;
  color: string;
  area: string;
  edge: string;
  count: number;
}

interface DecisionMarker {
  id: string;
  x: number;
  color: string;
  acted: boolean;
  aria: string;
}

@Component({
  selector: 'app-fleet-history',
  standalone: true,
  imports: [NgIcon, ExplainComponent, FleetHistoryDetailComponent],
  providers: [provideIcons({ lucideEuro, lucideServer })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-4" data-testid="fleet-history">
      <div class="card-surface space-y-3 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div
            class="inline-flex rounded-md border border-border p-0.5"
            role="group"
            data-testid="mode"
          >
            @for (m of modes; track m.id) {
              <button
                type="button"
                (click)="mode.set(m.id)"
                class="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors"
                [class]="
                  mode() === m.id
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                "
                [attr.aria-pressed]="mode() === m.id"
                [attr.data-testid]="'mode-' + m.id"
              >
                <ng-icon [name]="m.icon" class="h-3.5 w-3.5" />
                <span>{{ m.label }}</span>
              </button>
            }
          </div>

          @if (mode() === 'nodes') {
            <div
              class="flex flex-wrap items-center gap-x-4 gap-y-1"
              data-testid="legend-shapes"
            >
              @for (b of bands(); track b.shape) {
                <span
                  class="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"
                  [attr.data-testid]="'legend-' + b.shape"
                >
                  <span
                    class="h-2.5 w-2.5 rounded-sm"
                    [style.background-color]="b.color"
                  ></span>
                  <span class="font-mono text-foreground">{{ b.shape }}</span>
                  <span class="tabular-nums">{{ b.count }}</span>
                </span>
              }
            </div>
          } @else {
            <app-explain
              label="Hourly rate, monthly scale"
              labelClass="text-[12px] text-muted-foreground"
              testid="spend-why"
            >
              Nodes are billed by the hour and the cap is written per month, so
              the line is the hourly rate carried over 730 hours. It is a run
              rate, not an invoice.
            </app-explain>
          }
        </div>

        @if (points().length) {
          <svg
            [attr.viewBox]="'0 0 ' + W + ' ' + H"
            class="block h-auto w-full"
            preserveAspectRatio="xMidYMid meet"
            role="group"
            aria-label="Fleet over time, with each scaling decision on the same axis"
            data-testid="chart"
          >
            @for (t of yTicks(); track t.v) {
              <line
                [attr.x1]="plotL"
                [attr.x2]="plotR"
                [attr.y1]="t.y"
                [attr.y2]="t.y"
                class="stroke-border"
                stroke-width="1"
                [attr.stroke-dasharray]="t.v === 0 ? null : '3 4'"
              />
              <text
                [attr.x]="plotL - 8"
                [attr.y]="t.y"
                text-anchor="end"
                dominant-baseline="middle"
                class="fill-muted-foreground text-[10px] tabular-nums"
              >
                {{ t.label }}
              </text>
            }

            @for (b of bands(); track b.shape) {
              <path
                [attr.d]="b.area"
                [attr.fill]="b.color"
                fill-opacity="0.28"
                [attr.data-testid]="'band-' + b.shape"
              />
              <path
                [attr.d]="b.edge"
                fill="none"
                [attr.stroke]="b.color"
                stroke-width="2"
                stroke-linejoin="round"
              />
            }

            @if (capLine(); as cap) {
              <line
                [attr.x1]="plotL"
                [attr.x2]="plotR"
                [attr.y1]="cap.y"
                [attr.y2]="cap.y"
                class="stroke-destructive"
                stroke-width="1.5"
                stroke-dasharray="5 4"
                data-testid="cap-line"
              />
              <text
                [attr.x]="plotR"
                [attr.y]="cap.y - 6"
                text-anchor="end"
                class="fill-destructive text-[10px] tabular-nums"
              >
                {{ cap.label }}
              </text>
            }

            <line
              [attr.x1]="plotL"
              [attr.x2]="plotR"
              [attr.y1]="plotB"
              [attr.y2]="plotB"
              class="stroke-border"
              stroke-width="1"
            />

            @if (activeMarker(); as a) {
              <line
                [attr.x1]="a.x"
                [attr.x2]="a.x"
                [attr.y1]="plotT"
                [attr.y2]="markerY"
                [attr.stroke]="a.color"
                stroke-width="1"
                stroke-dasharray="3 3"
                stroke-opacity="0.7"
                data-testid="active-rule"
              />
            }

            @for (t of xTicks(); track t.x) {
              <text
                [attr.x]="t.x"
                [attr.y]="dateY"
                [attr.text-anchor]="t.anchor"
                class="fill-muted-foreground text-[10px]"
              >
                {{ t.label }}
              </text>
            }

            @for (m of markers(); track m.id) {
              <g
                role="button"
                tabindex="0"
                class="cursor-pointer focus:outline-none"
                [attr.aria-label]="m.aria"
                [attr.aria-pressed]="activeId() === m.id"
                [attr.data-testid]="'decision-' + m.id"
                (click)="pick(m.id)"
                (keydown.enter)="pick(m.id, $event)"
                (keydown.space)="pick(m.id, $event)"
                (mouseenter)="hovered.set(m.id)"
                (mouseleave)="hovered.set(null)"
                (focus)="hovered.set(m.id)"
                (blur)="hovered.set(null)"
              >
                <title>{{ m.aria }}</title>
                <circle
                  [attr.cx]="m.x"
                  [attr.cy]="markerY"
                  r="13"
                  fill="transparent"
                />
                <circle
                  [attr.cx]="m.x"
                  [attr.cy]="markerY"
                  [attr.r]="activeId() === m.id ? 7 : 5"
                  [attr.fill]="m.color"
                  [attr.fill-opacity]="m.acted ? 1 : 0.16"
                  [attr.stroke]="m.color"
                  stroke-width="2"
                />
              </g>
            }
          </svg>

          <div
            class="flex flex-wrap items-center gap-x-4 gap-y-1"
            data-testid="legend-decisions"
          >
            <span class="text-label">Decisions</span>
            <span
              class="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"
            >
              <span class="h-2.5 w-2.5 rounded-full bg-muted-foreground"></span>
              acted
            </span>
            <span
              class="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"
            >
              <span
                class="h-2.5 w-2.5 rounded-full border-2 border-muted-foreground"
              ></span>
              did not
            </span>
            <app-explain
              label="Why a decline is a marker"
              labelClass="text-[12px] text-muted-foreground"
              testid="declines-why"
            >
              “Why did you not scale?” is the only question anybody asks an
              autoscaler, so the times it bought nothing sit on the same axis,
              at the same size, as the times it did.
            </app-explain>
          </div>
        } @else {
          <app-explain
            label="Nothing bought or sold yet"
            labelClass="text-sm text-muted-foreground"
            testid="no-history"
          >
            The fleet is counted from node lifetimes. A group that has never
            changed shape has nothing to draw.
          </app-explain>
        }
      </div>

      @if (active(); as d) {
        <app-fleet-history-detail [decision]="d" />
      }
    </section>
  `,
})
export class FleetHistoryComponent {
  protected readonly W = 760;
  protected readonly H = 250;
  protected readonly plotL = 40;
  protected readonly plotR = 746;
  protected readonly plotT = 12;
  protected readonly plotB = 196;
  protected readonly markerY = 214;
  protected readonly dateY = 241;

  protected readonly modes: ReadonlyArray<{
    id: HistoryMode;
    label: string;
    icon: string;
  }> = [
    { id: 'nodes', label: 'Nodes', icon: 'lucideServer' },
    { id: 'spend', label: 'Spend', icon: 'lucideEuro' },
  ];

  protected readonly mode = signal<HistoryMode>('nodes');
  protected readonly hovered = signal<string | null>(null);
  protected readonly pinned = signal<string | null>(null);

  readonly points = input<FleetPoint[]>([]);
  readonly decisions = input<ScalingDecision[]>([]);
  readonly monthlyCap = input<number | null>(null);

  private readonly ordered = computed(() =>
    [...this.decisions()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
  );

  private readonly shapeColors = [0, 4, 6, 9, 10, 8, 5].map(
    (i) => DISTRIBUTION_PALETTE[i],
  );

  private readonly outcomeColors: Record<
    ScalingDecision['outcome'],
    { color: string; acted: boolean }
  > = {
    added: { color: DEFAULT_CHART_COLORS.success[0], acted: true },
    replaced: { color: DEFAULT_CHART_COLORS.info[0], acted: true },
    removed: { color: DEFAULT_CHART_COLORS.neutral[0], acted: true },
    declined: { color: DEFAULT_CHART_COLORS.warning[0], acted: false },
    alerted: { color: DEFAULT_CHART_COLORS.danger[0], acted: false },
  };

  private readonly shapes = computed(() =>
    shapesInOrder(this.points().map((p) => p.byShape)),
  );

  private readonly spend = computed(() =>
    this.points().map((p) => p.hourlyEur * HOURS_PER_MONTH),
  );

  private readonly cap = computed<number | null>(() => this.monthlyCap());

  private readonly domain = computed(() =>
    fleetDomain(
      this.points().map((p) => p.at.getTime()),
      this.ordered().map((d) => Date.parse(d.at)),
    ),
  );

  private readonly scale = computed(() =>
    this.mode() === 'nodes'
      ? nodeScale(this.points().map((p) => stackTotal(p.byShape)))
      : spendScale(this.spend(), this.cap()),
  );

  private readonly plot: PlotBox = {
    left: this.plotL,
    right: this.plotR,
    top: this.plotT,
    bottom: this.plotB,
  };

  private readonly xs = computed(() =>
    this.points().map((p) => this.x(p.at.getTime())),
  );

  protected readonly yTicks = computed(() =>
    this.scale().ticks.map((t) => ({ ...t, y: this.y(t.v) })),
  );

  protected readonly xTicks = computed(() => {
    const pts = this.points();
    if (!pts.length) return [];
    const picks = tickIndexes(pts.length);
    return picks.map((i, n) => ({
      x: this.x(pts[i].at.getTime()),
      label: dayLabel(pts[i].at),
      anchor: tickAnchor(i, n, picks.length),
    }));
  });

  protected readonly bands = computed<ShapeBand[]>(() => {
    const pts = this.points();
    if (!pts.length) return [];

    if (this.mode() === 'spend') {
      const values = this.spend();
      const floor = values.map(() => 0);
      return [
        {
          shape: 'spend',
          color: DEFAULT_CHART_COLORS.info[0],
          area: this.area(values, floor),
          edge: this.line(values),
          count: 0,
        },
      ];
    }

    const running = pts.map(() => 0);
    return this.shapes().map((shape, i) => {
      const below = [...running];
      pts.forEach((p, j) => {
        running[j] += p.byShape[shape] ?? 0;
      });
      return {
        shape,
        color: this.shapeColors[i % this.shapeColors.length],
        area: this.area([...running], below),
        edge: this.line([...running]),
        count: pts.at(-1)!.byShape[shape] ?? 0,
      };
    });
  });

  protected readonly capLine = computed(() => {
    const cap = this.cap();
    if (this.mode() !== 'spend' || cap === null || cap > this.scale().yMax) {
      return null;
    }
    return { y: this.y(cap), label: `€${cap}/mo cap` };
  });

  protected readonly markers = computed<DecisionMarker[]>(() =>
    this.ordered().map((d) => {
      const style = this.outcomeColors[d.outcome];
      return {
        id: d.id,
        x: this.x(Date.parse(d.at)),
        color: style.color,
        acted: style.acted,
        aria: `${whenLabel(d.at)} — ${d.outcome}, ${d.force}: ${d.saw}`,
      };
    }),
  );

  protected readonly active = computed<ScalingDecision | null>(() => {
    const list = this.ordered();
    const id = this.hovered() ?? this.pinned();
    return list.find((d) => d.id === id) ?? list.at(-1) ?? null;
  });

  protected readonly activeId = computed(() => this.active()?.id ?? null);

  protected readonly activeMarker = computed(() => {
    const id = this.activeId();
    return this.markers().find((m) => m.id === id) ?? null;
  });

  protected pick(id: string, event?: Event): void {
    event?.preventDefault();
    this.pinned.set(id);
  }

  private x(stamp: number): number {
    return xAt(stamp, this.domain(), this.plot);
  }

  private y(value: number): number {
    return yAt(value, this.scale().yMax, this.plot);
  }

  private line(values: number[]): string {
    return linePath(values, this.xs(), this.scale().yMax, this.plot);
  }

  private area(upper: number[], lower: number[]): string {
    return areaPath(upper, lower, this.xs(), this.scale().yMax, this.plot);
  }
}
