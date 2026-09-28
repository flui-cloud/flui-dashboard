export interface BillingPeriod {
  start: string;
  end: string;
  totalHours: number;
  elapsedHours: number;
}

export interface Breakdown {
  computeGross: string;
  computeNet: string;
  storageGross: string;
  storageNet: string;
  trafficGross: string;
  trafficNet: string;
}

export interface NodeSegment {
  serverType: string;
  startedAt: string;
  endedAt: string | null;
  hours: number;
  costGross: string;
  costNet: string;
}

export interface NodeMtd {
  nodeId: string;
  serverName: string;
  nodeType: string;
  currentServerType: string;
  providerResourceId: string | null;
  status: 'active' | 'terminated';
  billableHours: number;
  costGross: string;
  costNet: string;
  segments: NodeSegment[];
}

export interface VolumeMtd {
  volumeProviderId: string;
  kind: string;
  currentSizeGb: number;
  status: 'active' | 'terminated';
  costGross: string;
  costNet: string;
}

export interface TrafficInfo {
  outgoingBytes: number;
  ingoingBytes: number;
  includedBytes: number;
  overageBytes: number;
  overageCostGross: string;
  overageCostNet: string;
}

export interface ClusterBilling {
  clusterId: string;
  clusterName: string;
  provider: string;
  region: string;
  currency: string;
  billingPeriod: BillingPeriod;
  monthToDate: {
    totalGross: string;
    totalNet: string;
    breakdown: Breakdown;
    nodes: NodeMtd[];
    volumes: VolumeMtd[];
    traffic: TrafficInfo;
  };
  runRate: {
    monthlyGross: string;
    monthlyNet: string;
    breakdown: Breakdown;
    activeNodes: number;
    activeVolumes: number;
  };
  /** Absent from an API older than the forecast. */
  forecast?: {
    totalGross: string;
    totalNet: string;
    breakdown: Breakdown;
    remainingHours: number;
  };
  vat?: { included: boolean; ratePercent: string | null };
  billedAs?: string | null;
  unpricedItems?: number;
  listPricedItems?: number;
  calculatedAt: string;
}

/** Which of the two figures a person reads first: with VAT where the provider states it, else without. */
export function shown(
  billing: ClusterBilling,
  pair: { gross: string; net: string },
): string {
  return billing.vat?.included ? pair.gross : pair.net;
}

export function vatLabel(billing: ClusterBilling): string {
  if (!billing.vat) return '';
  if (!billing.vat.included) return 'excl. VAT';
  return billing.vat.ratePercent !== null
    ? `incl. ${billing.vat.ratePercent}% VAT`
    : 'incl. VAT';
}

export interface NodeGroups {
  active: NodeMtd[];
  removed: NodeMtd[];
  removedGross: number;
  removedNet: number;
}

/** Machines removed this month are one line, not one row each: a fleet that scaled up and down fifteen times is still one master. */
export function groupNodes(nodes: NodeMtd[]): NodeGroups {
  const active = nodes.filter((n) => n.status === 'active');
  const removed = nodes.filter((n) => n.status !== 'active');
  return {
    active,
    removed,
    removedGross: removed.reduce((sum, n) => sum + Number.parseFloat(n.costGross || '0'), 0),
    removedNet: removed.reduce((sum, n) => sum + Number.parseFloat(n.costNet || '0'), 0),
  };
}
