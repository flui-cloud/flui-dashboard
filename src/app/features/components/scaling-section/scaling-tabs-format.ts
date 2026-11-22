import {
  AvailabilityOutlook,
  DecisionOperation,
  ScalingDecision,
} from '../../model/scaling-group.models';
import { ProviderScalingCapability, SectionGroup } from '../../model/scaling-section.models';
import { StatusTone } from '../../../ui/primitives/status';

export type CatalogueState = AvailabilityOutlook['state'] | 'unknown';

export const STATE_LABEL: Record<CatalogueState, string> = {
  'sold-out': 'Sold out',
  unknown: 'No reading',
  limited: 'Limited',
  recovered: 'Recovered',
  available: 'Available',
};

export const STATE_TONE: Record<CatalogueState, StatusTone> = {
  'sold-out': 'error',
  unknown: 'neutral',
  limited: 'warning',
  recovered: 'success',
  available: 'success',
};

export const STALE_AFTER_SECONDS = 600;

export function readingAge(seconds: number | null): string {
  return seconds === null ? 'age unknown' : `${seconds}s ago`;
}

export function heldFor(hours: number | null): string {
  if (hours === null) return '—';
  return hours >= 48 ? `${Math.round(hours / 24)}d` : `${hours}h`;
}

/**
 * Whether one setting refuses the entire catalogue.
 *
 * Only where Flui can buy at all: on a provider with no create API nothing is
 * bought either way, and naming a limit there hides the real reason. No
 * provider Flui buys from bills by the month, so this is false everywhere
 * today — it is kept for the one that might.
 */
export function refusesWholeCatalogue(
  capability: ProviderScalingCapability,
  hourlyBillingOnly: boolean,
): boolean {
  return capability.canProvision && hourlyBillingOnly && capability.billing === 'monthly';
}

export interface GroupModeStatus {
  label: string;
  tone: StatusTone;
  attention: boolean;
}

export function groupModeStatus(g: SectionGroup): GroupModeStatus {
  const label = g.acts.label ?? fallbackModeLabel(g);
  const attention = g.acts.attention ?? (g.capability.canProvision && !g.acts.acts);
  let tone: StatusTone = 'neutral';
  if (attention) tone = 'warning';
  else if (g.capability.canProvision && g.acts.acts) tone = 'success';
  return { label, tone, attention };
}

function fallbackModeLabel(g: SectionGroup): string {
  if (!g.capability.canProvision) return 'Alarm only';
  return g.acts.acts ? 'Automatic' : 'Manual — Flui does not add nodes';
}

export function outcomeTone(outcome: ScalingDecision['outcome']): StatusTone {
  switch (outcome) {
    case 'added':
    case 'replaced':
    case 'node-joined':
      return 'success';
    case 'alerted':
      return 'warning';
    case 'purchase-failed':
      return 'error';
    case 'node-ordered':
      return 'progress';
    default:
      return 'neutral';
  }
}

export function operationStatusTone(state: DecisionOperation['state']): StatusTone {
  if (state === 'failed') return 'error';
  if (state === 'completed') return 'success';
  if (state === 'cancelled') return 'neutral';
  return 'progress';
}
