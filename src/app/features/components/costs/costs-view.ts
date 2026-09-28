import { CostMonth, CostProvider, Costs } from '../../model/costs.models';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS[(month || 1) - 1]} ${year}`;
}

export interface CostsHeadline {
  spent: number | null;
  forecast: number | null;
  lastMonth: number | null;
  lastMonthLabel: string | null;
  spentGross: number | null;
  forecastGross: number | null;
}

export function headline(costs: Costs): CostsHeadline {
  const index = costs.totals.findIndex((m) => m.current);
  const current = index >= 0 ? costs.totals[index] : null;
  const previous = index > 0 ? costs.totals[index - 1] : null;
  return {
    spent: current?.spentNet ?? null,
    forecast: current?.forecastNet ?? null,
    spentGross: current?.spentGross ?? null,
    forecastGross: current?.forecastGross ?? null,
    lastMonth: previous?.spentNet ?? null,
    lastMonthLabel: previous ? monthLabel(previous.month) : null,
  };
}

export function vatNote(provider: CostProvider): string {
  if (!provider.priced) return '';
  if (!provider.vatIncluded) return 'Prices published without VAT';
  return provider.vatRatePercent !== null
    ? `${provider.vatRatePercent}% VAT on this account`
    : 'VAT included at the rate of this account';
}

export interface ClusterRow {
  clusterId: string;
  name: string;
  region: string | null;
  removed: boolean;
  spent: number | null;
  forecast: number | null;
  lastMonth: number | null;
  unpriced: number;
}

/** The clusters that cost something in the window, running ones first. */
export function clusterRows(provider: CostProvider): ClusterRow[] {
  return provider.clusters
    .filter(
      (c) =>
        c.unpriced > 0 ||
        c.months.some((m) => m.spentNet > 0 || (m.forecastNet ?? 0) > 0),
    )
    .map((c) => {
      const index = c.months.findIndex((m) => m.current);
      const current = index >= 0 ? c.months[index] : null;
      const previous = index > 0 ? c.months[index - 1] : null;
      return {
        clusterId: c.clusterId,
        name: c.clusterName,
        region: c.region,
        removed: c.removed,
        spent: provider.priced ? (current?.spentNet ?? null) : null,
        forecast: provider.priced ? (current?.forecastNet ?? null) : null,
        lastMonth: provider.priced ? (previous?.spentNet ?? null) : null,
        unpriced: c.unpriced,
      };
    });
}

/** What a month cell says: a closed month what it cost, the running one what it cost so far. */
export function monthCell(month: CostMonth | undefined): { spent: number | null; forecast: number | null } {
  if (!month) return { spent: null, forecast: null };
  return { spent: month.spentNet, forecast: month.current ? month.forecastNet : null };
}
