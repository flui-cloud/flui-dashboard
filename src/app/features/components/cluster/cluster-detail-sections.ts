import { ResourceNavGroup, ResourceNavItem } from '../../../ui/frame/resource-nav';

export interface ClusterSection {
  readonly label: string;
  readonly route: string;
  readonly reads?: string;
}

export const CLUSTER_SECTIONS: readonly ClusterSection[] = [
  { label: 'Overview', route: 'overview' },
  { label: 'Monitoring', route: 'monitoring' },
  { label: 'Nodes', route: 'nodes' },
  {
    label: 'High availability',
    route: 'availability',
    reads: '/infrastructure/clusters/:id/high-availability',
  },
  { label: 'Scaling', route: 'scaling', reads: '/infrastructure/clusters/:id/scaling' },
  { label: 'Pricing', route: 'pricing', reads: '/infrastructure/clusters/:id/billing' },
  { label: 'Network', route: 'network' },
  { label: 'Firewall', route: 'firewall', reads: '/firewalls/cluster/:id' },
  { label: 'DNS', route: 'dns', reads: '/clusters/:id/dns-zone/issuers' },
  { label: 'Storage', route: 'storage', reads: '/infrastructure/clusters/:id/storage' },
  {
    label: 'Variables',
    route: 'variables',
    reads: '/variables/clusters/:id/namespaces/default',
  },
  { label: 'Auth proxy', route: 'security' },
];

const GROUP_OF: Record<string, string> = {
  monitoring: 'Operate',
  nodes: 'Operate',
  availability: 'Operate',
  scaling: 'Capacity',
  pricing: 'Capacity',
  network: 'Network',
  firewall: 'Network',
  dns: 'Network',
  storage: 'Configure',
  variables: 'Configure',
  security: 'Configure',
};

const ORDER = ['Operate', 'Capacity', 'Network', 'Configure'];

export function clusterDetailNav(sections: readonly ClusterSection[]): ResourceNavGroup[] {
  const item = (s: ClusterSection): ResourceNavItem => ({
    label: s.label,
    link: [s.route],
    testId: `cluster-section-${s.route}`,
  });
  const ungrouped = sections.filter((s) => !GROUP_OF[s.route]).map(item);
  const groups = ORDER.map((label) => ({
    label,
    items: sections.filter((s) => GROUP_OF[s.route] === label).map(item),
  })).filter((g) => g.items.length > 0);
  return [{ label: null, items: ungrouped }, ...groups];
}
