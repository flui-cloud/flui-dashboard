import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { FlLoadingState } from '../../../ui/patterns/states';
import type {
  LogVolumeData,
  LogVolumeRangeSelection,
} from '../../../shared/components/charts/chart.models';

interface VolumeDomain {
  readonly start: number;
  readonly end: number;
  readonly step: number;
  readonly buckets: readonly (readonly [number, number])[];
}

interface VolumeBar {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
}

const MIN_DRAG_PX = 4;
const MIN_RANGE_MS = 1000;
const TICK_COUNT = 5;
const DAY_LABEL_SPAN_MS = 2 * 86_400_000;
const SINGLE_BUCKET_SLOTS = 60;
const FALLBACK_STEP_MS = 60_000;

function dayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function bucketTotals(data: LogVolumeData): [number, number][] {
  const totals = new Map<number, number>();
  for (const level of data.series) {
    for (const bucket of level.series) {
      const ms = bucket.timestamp * 1000;
      totals.set(ms, (totals.get(ms) ?? 0) + bucket.count);
    }
  }
  return [...totals.entries()].sort((a, b) => a[0] - b[0]);
}

function smallestStep(buckets: readonly (readonly [number, number])[], span: number): number {
  let step = Infinity;
  for (let i = 1; i < buckets.length; i++) step = Math.min(step, buckets[i][0] - buckets[i - 1][0]);
  if (Number.isFinite(step) && step > 0) return step;
  return span > 0 ? Math.max(span / SINGLE_BUCKET_SLOTS, FALLBACK_STEP_MS) : FALLBACK_STEP_MS;
}

function buildDomain(data: LogVolumeData | null): VolumeDomain | null {
  if (!data) return null;
  const buckets = bucketTotals(data);
  const rangeStart = Date.parse(data.range_start);
  const rangeEnd = Date.parse(data.range_end);
  const hasRange = !Number.isNaN(rangeStart) && !Number.isNaN(rangeEnd) && rangeEnd > rangeStart;
  if (buckets.length === 0 && !hasRange) return null;
  const step = smallestStep(buckets, hasRange ? rangeEnd - rangeStart : 0);
  const first = buckets.length ? buckets[0][0] : rangeStart;
  const lastBucket = buckets.at(-1);
  const last = lastBucket ? lastBucket[0] + step : rangeEnd;
  const start = hasRange ? Math.min(rangeStart, first) : first;
  const end = hasRange ? Math.max(rangeEnd, last) : last;
  return { start, end, step, buckets };
}

@Component({
  selector: 'app-log-volume-bars',
  imports: [FlLoadingState],
  host: { class: 'fl-chart-compact block' },
  template: `
    @if (loading()) {
      <fl-loading-state [rows]="2" />
    } @else {
      @if (bars().length > 0) {
        <p class="mb-1 text-right text-fl-caption text-fl-ink-muted">Drag to filter</p>
      }
      <div class="fl-chart" role="img" [attr.aria-label]="reading()">
        <div
          #plot
          class="relative select-none"
          [class.cursor-crosshair]="bars().length > 0"
          (mousedown)="onDragStart($event)"
          (mousemove)="onDragMove($event)"
          (mouseup)="onDragEnd($event)"
          (mouseleave)="onDragCancel()"
        >
          <svg
            class="fl-chart__plot"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            @if (highlight(); as h) {
              <rect
                [attr.x]="h.x"
                y="0"
                [attr.width]="h.width"
                height="100"
                class="fill-fl-accent-soft"
              />
            }
            @for (bar of bars(); track bar.x) {
              <rect
                [attr.x]="bar.x"
                [attr.y]="bar.y"
                [attr.width]="bar.width"
                [attr.height]="bar.height"
                class="fill-fl-accent"
              >
                <title>{{ bar.label }}</title>
              </rect>
            }
            <line
              x1="0"
              x2="100"
              y1="100"
              y2="100"
              class="axis"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          @if (dragging()) {
            <div
              class="pointer-events-none absolute inset-y-0 border-x border-fl-accent bg-fl-accent-soft"
              [style.left.px]="selectionLeft()"
              [style.width.px]="selectionWidth()"
            ></div>
          }
        </div>
        <div class="fl-chart__x" aria-hidden="true">
          @for (x of xLabels(); track $index; let i = $index; let n = $count) {
            <span [style.left.%]="n > 1 ? (i * 100) / (n - 1) : 0">{{ x }}</span>
          }
        </div>
      </div>
    }
  `,
})
export class LogVolumeBarsComponent {
  readonly data = input<LogVolumeData | null>(null);
  readonly loading = input(false);
  readonly highlightRange = input<{ start: Date; end: Date } | null>(null);
  readonly rangeSelected = output<LogVolumeRangeSelection>();

  private readonly plot = viewChild<ElementRef<HTMLElement>>('plot');

  protected readonly dragging = signal(false);
  private readonly dragStartX = signal(0);
  private readonly dragCurrentX = signal(0);

  protected readonly selectionLeft = computed(() =>
    Math.min(this.dragStartX(), this.dragCurrentX()),
  );
  protected readonly selectionWidth = computed(() =>
    Math.abs(this.dragCurrentX() - this.dragStartX()),
  );

  private readonly domain = computed(() => buildDomain(this.data()));

  private readonly total = computed(
    () => this.domain()?.buckets.reduce((sum, [, count]) => sum + count, 0) ?? 0,
  );

  protected readonly bars = computed((): VolumeBar[] => {
    const d = this.domain();
    if (!d) return [];
    const span = d.end - d.start;
    const max = Math.max(1, ...d.buckets.map(([, count]) => count));
    const slot = (d.step / span) * 100;
    const width = Math.max(slot * 0.8, 0.2);
    const useDay = span >= DAY_LABEL_SPAN_MS;
    return d.buckets
      .filter(([, count]) => count > 0)
      .map(([ms, count]) => {
        const height = Math.max((count / max) * 100, 2);
        const when = useDay ? `${dayLabel(ms)} ${timeLabel(ms)}` : timeLabel(ms);
        return {
          x: ((ms - d.start) / span) * 100 + (slot - width) / 2,
          y: 100 - height,
          width,
          height,
          label: `${when}: ${count.toLocaleString('en-US')} ${count === 1 ? 'entry' : 'entries'}`,
        };
      });
  });

  protected readonly highlight = computed(() => {
    const d = this.domain();
    const h = this.highlightRange();
    if (!d || !h) return null;
    const span = d.end - d.start;
    const from = Math.max(0, ((h.start.getTime() - d.start) / span) * 100);
    const to = Math.min(100, ((h.end.getTime() - d.start) / span) * 100);
    return to > from ? { x: from, width: to - from } : null;
  });

  protected readonly xLabels = computed(() => {
    const d = this.domain();
    if (!d) return [];
    const span = d.end - d.start;
    const format = span >= DAY_LABEL_SPAN_MS ? dayLabel : timeLabel;
    return Array.from({ length: TICK_COUNT }, (_, i) =>
      format(d.start + (span * i) / (TICK_COUNT - 1)),
    );
  });

  protected readonly reading = computed(() => {
    if (this.bars().length === 0) return 'No volume data';
    const n = this.total();
    return `Log volume: ${n.toLocaleString('en-US')} ${n === 1 ? 'entry' : 'entries'} in range`;
  });

  protected onDragStart(event: MouseEvent): void {
    if (this.bars().length === 0) return;
    const x = this.localX(event);
    if (x === null) return;
    this.dragStartX.set(x);
    this.dragCurrentX.set(x);
    this.dragging.set(true);
  }

  protected onDragMove(event: MouseEvent): void {
    if (!this.dragging()) return;
    const x = this.localX(event);
    if (x !== null) this.dragCurrentX.set(x);
  }

  protected onDragEnd(event: MouseEvent): void {
    if (!this.dragging()) return;
    const x = this.localX(event) ?? this.dragCurrentX();
    this.dragging.set(false);
    this.emitRange(this.dragStartX(), x);
  }

  protected onDragCancel(): void {
    this.dragging.set(false);
  }

  private localX(event: MouseEvent): number | null {
    const el = this.plot()?.nativeElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  }

  private emitRange(x1: number, x2: number): void {
    const d = this.domain();
    const width = this.plot()?.nativeElement.getBoundingClientRect().width ?? 0;
    if (!d || width <= 0 || Math.abs(x2 - x1) < MIN_DRAG_PX) return;
    const span = d.end - d.start;
    const startMs = d.start + (Math.min(x1, x2) / width) * span;
    const endMs = d.start + (Math.max(x1, x2) / width) * span;
    if (endMs - startMs < MIN_RANGE_MS) return;
    this.rangeSelected.emit({ start: new Date(startMs), end: new Date(endMs) });
  }
}
