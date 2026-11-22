import { ProviderScalingCapability, ScalingModeLabel } from '../../model/scaling-section.models';
import { StatusTone } from '../../../ui/primitives/status';

export type ScalingMode = 'flui-buys' | 'flui-decides' | 'you-buy' | 'you-attach';

export interface ModeCopy {
  id: ScalingMode;
  label: string;
  tone: StatusTone;
  how: string;
}

export const MODES: Record<ScalingMode, ModeCopy> = {
  'flui-buys': {
    id: 'flui-buys',
    label: 'Automatic — Flui adds nodes',
    tone: 'success',
    how: 'Flui adds the machine and it joins on its own. The provider bills it by the hour.',
  },
  'flui-decides': {
    id: 'flui-decides',
    label: 'Manual — Flui does not add nodes',
    tone: 'warning',
    how: 'Flui could add nodes here and is set not to. It names the machine and a person adds it, or switches the group to automatic.',
  },
  'you-buy': {
    id: 'you-buy',
    label: 'You add, Flui asks',
    tone: 'neutral',
    how: 'Flui can read prices but cannot add nodes here. An alarm names the machine and its price; you create it.',
  },
  'you-attach': {
    id: 'you-attach',
    label: 'You attach the machine',
    tone: 'neutral',
    how: 'No prices to read here, so an alarm can only say what the machine has to hold.',
  },
};

export function modeOf(
  capability: ProviderScalingCapability,
  row?: { acts: boolean; groupCount: number; mode?: ScalingModeLabel | null },
): ModeCopy {
  const base = baseModeOf(capability, row);
  if (!row?.mode) return base;
  return {
    ...base,
    label: row.mode.label,
    tone: row.mode.attention ? MODES['flui-decides'].tone : base.tone,
  };
}

function baseModeOf(
  capability: ProviderScalingCapability,
  row?: { acts: boolean; groupCount: number },
): ModeCopy {
  if (!capability.canProvision) {
    return capability.hasCatalogue ? MODES['you-buy'] : MODES['you-attach'];
  }
  if (row && !row.acts) return MODES['flui-decides'];
  return MODES['flui-buys'];
}

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

export function oldestAlarm(sinces: readonly (string | undefined)[], now: number): string | null {
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
