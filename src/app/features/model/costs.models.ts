export interface CostMonth {
  month: string;
  current: boolean;
  spentNet: number;
  spentGross: number | null;
  forecastNet: number | null;
  forecastGross: number | null;
}

export interface CostCluster {
  clusterId: string;
  clusterName: string;
  region: string | null;
  removed: boolean;
  months: CostMonth[];
  unpriced: number;
  listPriced: number;
}

export interface CostProvider {
  provider: string;
  priced: boolean;
  billedAs: string | null;
  vatIncluded: boolean;
  vatRatePercent: string | null;
  months: CostMonth[];
  clusters: CostCluster[];
  unpriced: number;
  listPriced: number;
  note: string | null;
}

export interface Costs {
  currency: string;
  months: string[];
  totals: CostMonth[];
  providers: CostProvider[];
  recordedSince: string | null;
  notes: string[];
  calculatedAt: string;
}
