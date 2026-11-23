import { Component, computed, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideEuro, lucideServer } from '@ng-icons/lucide';
import { FlIcon } from '../../../ui/primitives';
import { MarkerTone, SHAPE_CLASSES, outcomeMark } from './fleet-history-marks';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { FleetHistoryDetailComponent } from './fleet-history-detail.component';
import { ScalingDecision } from '../../model/scaling-group.models';
import {
  HOURS_PER_MONTH,
  PlotBox,
  areaPath,
  fleetDomain,
  linePath,
  nodeScale,
  shapesInOrder,
  spendScale,
  stackTotal,
  tickAnchor,
  axisLabel,
  tickIndexes,
  whenLabel,
  xAt,
  yAt,
  draggedStretch,
} from './fleet-history.geometry';

type HistoryMode = 'nodes' | 'spend';

export interface FleetPoint {
  at: Date;
  byShape: Record<string, number>;
  hourlyEur: number;
}

interface ShapeBand {
  shape: string;
  tone: string;
  area: string;
  edge: string;
  count: number;
}

interface DecisionMarker {
  id: string;
  x: number;
  tone: MarkerTone;
  acted: boolean;
  aria: string;
}

@Component({
  selector: 'app-fleet-history',
  imports: [FlIcon, ExplainComponent, FleetHistoryDetailComponent],
  providers: [provideIcons({ lucideEuro, lucideServer })],
  styleUrl: './fleet-chart.css',
  host: { class: 'block' },
  template: `
    <section class="flex flex-col gap-4" data-testid="fleet-history">
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="fl-segmented" role="group" aria-label="Measure" data-testid="mode">
            @for (m of modes; track m.id) {
              <button
                type="button"
                class="inline-flex items-center gap-1.5"
                (click)="mode.set(m.id)"
                [attr.aria-pressed]="mode() === m.id"
                [attr.data-testid]="'mode-' + m.id"
              >
                <fl-icon [name]="m.icon" [size]="14" />
                <span>{{ m.label }}</span>
              </button>
            }
          </div>

          @if (mode() === 'nodes') {
            <div class="fl-legend" data-testid="legend-shapes">
              @for (b of bands(); track b.shape) {
                <span [attr.data-testid]="'legend-' + b.shape">
                  <svg width="10" height="10" aria-hidden="true">
                    <rect x="1" y="1" width="8" height="8" rx="1" [attr.class]="b.tone + ' edge'" />
                  </svg>
                  <span class="fl-mono text-fl-ink">{{ b.shape }}</span>
                  <span class="fl-num">{{ b.count }}</span>
                </span>
              }
            </div>
          } @else {
            <app-explain
              [floating]="true"
              label="Hourly rate, monthly scale"
              labelClass="text-fl-caption text-fl-ink-muted"
              testid="spend-why"
            >
              Nodes are billed by the hour and the cap is written per month, so the line is the
              hourly rate carried over 730 hours. It is a run rate, not an invoice.
            </app-explain>
          }
        </div>

        @if (points().length) {
          <svg
            [attr.viewBox]="'0 0 ' + W + ' ' + H"
            class="block h-auto w-full touch-none select-none"
            preserveAspectRatio="xMidYMid meet"
            role="group"
            aria-label="Fleet over time, with each scaling decision on the same axis. Drag across it to zoom into a stretch."
            data-testid="chart"
            (pointerdown)="dragBegin($event)"
            (pointermove)="dragMove($event)"
            (pointerup)="dragEnd($event)"
            (pointerleave)="dragCancel()"
          >
            @for (t of yTicks(); track t.v) {
              <line
                [attr.x1]="plotL"
                [attr.x2]="plotR"
                [attr.y1]="t.y"
                [attr.y2]="t.y"
                class="grid"
                [attr.stroke-dasharray]="t.v === 0 ? null : '3 4'"
              />
              <text
                [attr.x]="plotL - 8"
                [attr.y]="t.y"
                text-anchor="end"
                dominant-baseline="middle"
                class="tick"
              >
                {{ t.label }}
              </text>
            }

            @for (b of bands(); track b.shape) {
              <path
                [attr.d]="b.area"
                [attr.class]="b.tone + ' band'"
                [attr.data-testid]="'band-' + b.shape"
              />
              <path [attr.d]="b.edge" [attr.class]="b.tone + ' edge'" />
            }

            @if (capLine(); as cap) {
              <line
                [attr.x1]="plotL"
                [attr.x2]="plotR"
                [attr.y1]="cap.y"
                [attr.y2]="cap.y"
                class="cap"
                data-testid="cap-line"
              />
              <text [attr.x]="plotR" [attr.y]="cap.y - 6" text-anchor="end" class="cap-label">
                {{ cap.label }}
              </text>
            }

            <line
              [attr.x1]="plotL"
              [attr.x2]="plotR"
              [attr.y1]="plotB"
              [attr.y2]="plotB"
              class="axis"
            />

            @if (activeMarker(); as a) {
              <line
                [attr.x1]="a.x"
                [attr.x2]="a.x"
                [attr.y1]="plotT"
                [attr.y2]="markerY"
                [attr.class]="'rule mk-' + a.tone"
                data-testid="active-rule"
              />
            }

            @for (t of xTicks(); track t.x) {
              <text [attr.x]="t.x" [attr.y]="dateY" [attr.text-anchor]="t.anchor" class="tick">
                {{ t.label }}
              </text>
            }

            @if (selection(); as sel) {
              <rect
                [attr.x]="sel.x"
                [attr.y]="plotT"
                [attr.width]="sel.width"
                [attr.height]="plotB - plotT"
                class="zoom"
                data-testid="zoom-selection"
              />
            }

            @for (m of markers(); track m.id) {
              <g
                role="button"
                tabindex="0"
                class="marker-hit"
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
                <circle [attr.cx]="m.x" [attr.cy]="markerY" r="13" class="hit" />
                <circle
                  [attr.cx]="m.x"
                  [attr.cy]="markerY"
                  [attr.r]="activeId() === m.id ? 7 : 5"
                  [attr.class]="'marker mk-' + m.tone + (m.acted ? ' is-acted' : '')"
                />
              </g>
            }
          </svg>

          <div class="fl-legend" data-testid="legend-decisions">
            <span class="font-medium text-fl-ink-secondary">Decisions</span>
            <span>
              <svg width="10" height="10" aria-hidden="true">
                <circle cx="5" cy="5" r="4" class="swatch-solid" />
              </svg>
              acted
            </span>
            <span>
              <svg width="10" height="10" aria-hidden="true">
                <circle cx="5" cy="5" r="3.5" class="swatch-hollow" />
              </svg>
              did not
            </span>
            <app-explain
              [floating]="true"
              label="Why a decline is a marker"
              labelClass="text-fl-caption text-fl-ink-muted"
              testid="declines-why"
            >
              "Why did you not scale?" is the only question anybody asks an autoscaler, so the times
              it added nothing sit on the same axis, at the same size, as the times it did.
            </app-explain>
          </div>
        } @else {
          <app-explain
            [floating]="true"
            label="No nodes added or removed yet"
            labelClass="text-fl-body-sm text-fl-ink-muted"
            testid="no-history"
          >
            The fleet is counted from node lifetimes. A group that has never changed shape has
            nothing to draw.
          </app-explain>
        }
      </div>

      @if (active(); as d) {
        <app-fleet-history-detail class="border-t border-fl-border pt-4" [decision]="d" />
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

  /** A stretch picked by dragging across the chart. */
  readonly zoomed = output<{ from: Date; to: Date }>();

  private readonly dragFrom = signal<number | null>(null);
  private readonly dragTo = signal<number | null>(null);

  protected readonly selection = computed(() => {
    const a = this.dragFrom();
    const b = this.dragTo();
    if (a === null || b === null) return null;
    const left = Math.max(Math.min(a, b), this.plotL);
    const right = Math.min(Math.max(a, b), this.plotR);
    return right > left ? { x: left, width: right - left } : null;
  });

  readonly points = input<FleetPoint[]>([]);
  readonly decisions = input<ScalingDecision[]>([]);
  readonly monthlyCap = input<number | null>(null);

  private readonly ordered = computed(() =>
    [...this.decisions()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
  );

  private readonly shapes = computed(() => shapesInOrder(this.points().map((p) => p.byShape)));

  private readonly spend = computed(() => this.points().map((p) => p.hourlyEur * HOURS_PER_MONTH));

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

  private readonly xs = computed(() => this.points().map((p) => this.x(p.at.getTime())));

  protected readonly yTicks = computed(() =>
    this.scale().ticks.map((t) => ({ ...t, y: this.y(t.v) })),
  );

  protected readonly xTicks = computed(() => {
    const pts = this.points();
    if (!pts.length) return [];
    const picks = tickIndexes(pts.length);
    const span = pts.at(-1)!.at.getTime() - pts[0].at.getTime();
    return picks.map((i, n) => ({
      x: this.x(pts[i].at.getTime()),
      label: axisLabel(pts[i].at, span),
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
          tone: 'shape-0',
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
        tone: `shape-${i % SHAPE_CLASSES}`,
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
      const style = outcomeMark(d.outcome);
      return {
        id: d.id,
        x: this.x(Date.parse(d.at)),
        tone: style.tone,
        acted: style.acted,
        aria: `${whenLabel(d.at)}, ${d.outcome}, ${d.force}: ${d.saw}`,
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

  protected dragBegin(event: PointerEvent): void {
    if ((event.target as Element | null)?.closest('[role="button"]')) return;
    const x = this.viewX(event);
    if (x < this.plotL || x > this.plotR) return;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.dragFrom.set(x);
    this.dragTo.set(x);
  }

  protected dragMove(event: PointerEvent): void {
    if (this.dragFrom() === null) return;
    this.dragTo.set(this.viewX(event));
  }

  protected dragEnd(event: PointerEvent): void {
    const from = this.dragFrom();
    if (from === null) return;
    const stretch = draggedStretch(from, this.viewX(event), this.domain(), this.plot);
    this.dragCancel();
    if (stretch) this.zoomed.emit(stretch);
  }

  protected dragCancel(): void {
    this.dragFrom.set(null);
    this.dragTo.set(null);
  }

  private viewX(event: PointerEvent): number {
    const box = (event.currentTarget as Element).getBoundingClientRect();
    return box.width ? ((event.clientX - box.left) / box.width) * this.W : 0;
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
