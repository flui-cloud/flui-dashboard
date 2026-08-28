import { ScalingDecision } from '../../model/scaling-group.models';

export const HOURS_PER_MONTH = 730;

const NICE_FACTORS = [1, 2, 5];

export interface PlotBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Domain {
  start: number;
  end: number;
}

export interface AxisTick {
  v: number;
  label: string;
}

export interface Scale {
  yMax: number;
  ticks: AxisTick[];
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function niceStep(rough: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough || 1)));
  const norm = rough / magnitude;
  const factor = NICE_FACTORS.find((f) => norm <= f) ?? 10;
  return factor * magnitude;
}

export function fleetDomain(
  pointTimes: number[],
  decisionStamps: number[],
): Domain {
  const first = pointTimes.length ? pointTimes[0] : 0;
  const last = pointTimes.length ? pointTimes.at(-1)! : 1;
  const start = Math.min(first, ...decisionStamps);
  const end = Math.max(last, ...decisionStamps);
  return { start, end: end > start ? end : start + 1 };
}

export function shapesInOrder(byShape: Record<string, number>[]): string[] {
  const seen: string[] = [];
  for (const entry of byShape) {
    for (const shape of Object.keys(entry)) {
      if (!seen.includes(shape)) seen.push(shape);
    }
  }
  return seen;
}

export function stackTotal(byShape: Record<string, number>): number {
  return Object.values(byShape).reduce((sum, n) => sum + n, 0);
}

export function nodeScale(totals: number[]): Scale {
  const yMax = Math.max(1, ...totals) + 1;
  return {
    yMax,
    ticks: Array.from({ length: yMax + 1 }, (_, i) => ({
      v: i,
      label: `${i}`,
    })),
  };
}

export function spendScale(values: number[], cap: number | null): Scale {
  const peak = Math.max(...values, cap ?? 0, 1);
  const step = niceStep(peak / 5);
  const yMax = Math.ceil(peak / step) * step;
  const ticks: AxisTick[] = [];
  for (let v = 0; v <= yMax + step / 100; v += step) {
    ticks.push({ v, label: `€${Math.round(v)}` });
  }
  return { yMax, ticks };
}

export function xAt(stamp: number, domain: Domain, plot: PlotBox): number {
  const t = Math.min(Math.max(stamp, domain.start), domain.end);
  return (
    plot.left +
    ((t - domain.start) / (domain.end - domain.start)) * (plot.right - plot.left)
  );
}

export function yAt(value: number, yMax: number, plot: PlotBox): number {
  const span = yMax || 1;
  return plot.bottom - (value / span) * (plot.bottom - plot.top);
}

export function stepPoints(
  values: number[],
  xs: number[],
  yMax: number,
  plot: PlotBox,
): string[] {
  const out: string[] = [];
  values.forEach((v, i) => {
    const x = xs[i];
    if (i > 0) {
      out.push(`${round1(x)},${round1(yAt(values[i - 1], yMax, plot))}`);
    }
    out.push(`${round1(x)},${round1(yAt(v, yMax, plot))}`);
  });
  out.push(
    `${round1(plot.right)},${round1(yAt(values.at(-1)!, yMax, plot))}`,
  );
  return out;
}

export function linePath(
  values: number[],
  xs: number[],
  yMax: number,
  plot: PlotBox,
): string {
  const v = stepPoints(values, xs, yMax, plot);
  const rest = v
    .slice(1)
    .map((p) => `L${p}`)
    .join(' ');
  return `M${v[0]} ${rest}`;
}

export function areaPath(
  upper: number[],
  lower: number[],
  xs: number[],
  yMax: number,
  plot: PlotBox,
): string {
  const top = stepPoints(upper, xs, yMax, plot);
  const bottom = stepPoints(lower, xs, yMax, plot).reverse();
  return [
    `M${top[0]}`,
    ...top.slice(1).map((p) => `L${p}`),
    ...bottom.map((p) => `L${p}`),
    'Z',
  ].join(' ');
}

export function tickIndexes(count: number): number[] {
  const last = count - 1;
  return [
    ...new Set([0, Math.round(last / 3), Math.round((2 * last) / 3), last]),
  ];
}

export function tickAnchor(
  index: number,
  position: number,
  count: number,
): 'start' | 'middle' | 'end' {
  if (index === 0) return 'start';
  return position === count - 1 ? 'end' : 'middle';
}

export function dayLabel(at: Date): string {
  return at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function outcomeBadgeClass(
  outcome: ScalingDecision['outcome'],
): string {
  switch (outcome) {
    case 'added':
    case 'replaced':
      return 'badge badge-success';
    case 'removed':
      return 'badge badge-in-progress';
    case 'alerted':
      return 'badge badge-error';
    default:
      return 'badge bg-amber-500/15 text-amber-600 dark:text-amber-400';
  }
}
