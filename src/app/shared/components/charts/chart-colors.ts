import type { ChartColorScheme } from './chart.models';

export type ChartColorRef = readonly [name: string, alpha?: number];

const RGB_HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGB_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const RGB_FN = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i;

function channels(color: string): [number, number, number] | null {
  const long = RGB_HEX.exec(color);
  if (long)
    return [
      Number.parseInt(long[1], 16),
      Number.parseInt(long[2], 16),
      Number.parseInt(long[3], 16),
    ];
  const short = RGB_SHORT.exec(color);
  if (short) {
    return [
      Number.parseInt(short[1] + short[1], 16),
      Number.parseInt(short[2] + short[2], 16),
      Number.parseInt(short[3] + short[3], 16),
    ];
  }
  const fn = RGB_FN.exec(color);
  return fn ? [Number(fn[1]), Number(fn[2]), Number(fn[3])] : null;
}

export function cssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function cssColor(name: string, alpha = 1): string {
  const value = cssVar(name);
  if (alpha >= 1 || !value) return value;
  const rgb = channels(value);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : value;
}

export function cssColorList(refs: readonly ChartColorRef[]): string[] {
  return new Proxy(refs as unknown as string[], {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        const ref = refs[Number(prop)];
        return ref ? cssColor(ref[0], ref[1]) : undefined;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export interface ChartInk {
  readonly ink: string;
  readonly secondary: string;
  readonly muted: string;
  readonly border: string;
  readonly subtle: string;
  readonly track: string;
  readonly surface: string;
}

export function chartInk(): ChartInk {
  return {
    ink: cssColor('--fl-ink'),
    secondary: cssColor('--fl-ink-secondary'),
    muted: cssColor('--fl-ink-muted'),
    border: cssColor('--fl-border'),
    subtle: cssColor('--fl-border-subtle'),
    track: cssColor('--fl-track'),
    surface: cssColor('--fl-surface'),
  };
}

function ramp(name: string): string[] {
  return cssColorList([[name], [name, 0.7], [name, 0.4]]);
}

function pair(name: string): [string, string] {
  return cssColorList([[name], [name, 0.7]]) as [string, string];
}

export const DEFAULT_CHART_COLORS: ChartColorScheme = {
  get success() {
    return ramp('--fl-success');
  },
  get warning() {
    return ramp('--fl-warning');
  },
  get danger() {
    return ramp('--fl-danger');
  },
  get info() {
    return ramp('--fl-accent');
  },
  get neutral() {
    return cssColorList([['--fl-ink-muted'], ['--fl-border-input'], ['--fl-border-button']]);
  },
  get gradient() {
    return {
      success: pair('--fl-success'),
      warning: pair('--fl-warning'),
      danger: pair('--fl-danger'),
      info: pair('--fl-accent'),
    };
  },
};

const DISTRIBUTION_REFS: readonly ChartColorRef[] = [
  ['--fl-accent'],
  ['--fl-ink-secondary'],
  ['--fl-accent', 0.45],
  ['--fl-border-input'],
  ['--fl-accent-strong'],
  ['--fl-border-button'],
  ['--fl-accent', 0.7],
  ['--fl-ink-muted'],
  ['--fl-accent', 0.25],
  ['--fl-ink'],
  ['--fl-accent', 0.85],
  ['--fl-border'],
];

/**
 * Distribution charts tell slices apart by lightness within the accent and neutral ramps, never by a
 * new hue: the console keeps one accent, and green, amber and red for state only.
 */
export const DISTRIBUTION_PALETTE = cssColorList(DISTRIBUTION_REFS);

/**
 * Per-node series palette for cluster metrics, assigned by node index in this fixed order. The first
 * node takes the accent, the rest step through neutral and lighter accent so nodes differ by
 * lightness, not hue; past four nodes the charts summarise rather than name each node by color.
 */
export const NODE_SERIES_COLORS = cssColorList([
  ['--fl-accent'],
  ['--fl-ink-secondary'],
  ['--fl-accent', 0.45],
  ['--fl-border-input'],
]);
