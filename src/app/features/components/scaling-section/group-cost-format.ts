import { CostScenarioKind, ScalingCost } from '../../model/scaling-group.models';

export interface CostRow {
  kind: CostScenarioKind;
  label: string;
  value: string;
}

/** Two decimals, as every price on these pages. */
export function eur(value: number): string {
  return `€${value.toFixed(2)}`;
}

/**
 * One row per scenario the API priced. A range where the machines on the list
 * cost different amounts; a dash where a figure cannot be priced.
 */
export function costRows(cost: ScalingCost | null | undefined): CostRow[] {
  return (cost?.scenarios ?? []).map((s) => ({
    kind: s.kind,
    label: s.label,
    value: range(s.lowEur, s.highEur),
  }));
}

function range(low: number | null, high: number | null): string {
  if (low === null || high === null) return '— no hourly price';
  if (low === high) return `${eur(low)}/mo`;
  return `${eur(low)} – ${eur(high)}/mo`;
}
