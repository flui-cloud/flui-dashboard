import { ProviderScalingCapability } from '../../model/scaling-section.models';

export type ScalingMode =
  | 'flui-buys'
  | 'flui-decides'
  | 'you-buy'
  | 'you-attach';

export interface ModeCopy {
  id: ScalingMode;
  label: string;
  pill: string;
  how: string;
}

export const MODES: Record<ScalingMode, ModeCopy> = {
  'flui-buys': {
    id: 'flui-buys',
    label: 'Flui buys',
    pill: 'bg-primary/10 text-primary',
    how: 'Flui creates the server through the provider API and it joins on its own. Prices are hourly.',
  },
  'flui-decides': {
    id: 'flui-decides',
    label: 'Flui decides only',
    pill: 'bg-muted text-foreground',
    how: 'Flui could create the server here, and will not: either this group is set only to decide, or nothing was granted to this installation to spend. It names what it would have bought and stops.',
  },
  'you-buy': {
    id: 'you-buy',
    label: 'You buy, Flui asks',
    pill: 'bg-muted text-foreground',
    how: 'There is a catalogue but no create API, so an alarm names a shape and a price. You order it; Flui cannot. Billing is monthly.',
  },
  'you-attach': {
    id: 'you-attach',
    label: 'You attach the machine',
    pill: 'bg-muted text-muted-foreground',
    how: 'No catalogue, so no shape to name and no price to quote. An alarm can only state what the machine has to hold, and Flui never sees a bill for it.',
  },
};

export function modeOf(
  capability: ProviderScalingCapability,
  row?: { acts: boolean; groupCount: number },
): ModeCopy {
  if (!capability.canProvision) {
    return capability.hasCatalogue ? MODES['you-buy'] : MODES['you-attach'];
  }
  if (row && row.groupCount > 0 && !row.acts) return MODES['flui-decides'];
  return MODES['flui-buys'];
}

export const TABLE = {
  card: 'card-surface overflow-hidden',
  scroll: 'overflow-x-auto',
  table: 'w-full min-w-[42rem] border-collapse text-left text-sm',
  headRow: 'text-left text-muted-foreground border-b border-border',
  th: 'py-2 font-normal',
  thNum: 'py-2 text-right font-normal',
  row: 'border-b border-border/50',
  td: 'py-2 align-top',
  tdNum: 'py-2 text-right align-top tabular-nums',
  note: 'm-0 text-[13px] leading-snug text-muted-foreground',
  mono: 'font-mono text-[13px] text-foreground',
  pill: 'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
} as const;

export function eurMonth(value: number | null): string {
  return value === null ? '—' : `€${value.toFixed(2)}/mo`;
}

export function age(iso: string, now: number): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  if (ms < 0) return 'just now';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  return hours >= 48 ? `${Math.round(hours / 24)}d` : `${hours}h`;
}

export function oldestAlarm(
  sinces: readonly (string | undefined)[],
  now: number,
): string | null {
  const times = sinces
    .filter((since): since is string => since !== undefined)
    .map((since) => Date.parse(since))
    .filter((ms) => Number.isFinite(ms));
  if (!times.length) return null;
  return age(new Date(Math.min(...times)).toISOString(), now);
}

export interface Reading {
  value: string;
  sub: string | null;
  attention: boolean;
}
