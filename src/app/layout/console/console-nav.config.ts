export type NavCount = 'applications' | 'data' | 'system' | 'projects';

export interface NavEntry {
  readonly id: string;
  readonly label: string;
  readonly link: string;
  readonly icon: string;
  readonly keywords?: readonly string[];
  readonly section?: string;
  readonly reads?: string;
  readonly fullAccessOnly?: boolean;
  readonly count?: NavCount;
  readonly onlyWithSystemApps?: boolean;
  readonly updateTag?: boolean;
}

export interface NavGroup {
  readonly label: string | null;
  readonly entries: readonly NavEntry[];
}

export const CONSOLE_NAV: readonly NavGroup[] = [
  {
    label: null,
    entries: [
      {
        id: 'overview',
        label: 'Overview',
        link: '/dashboard',
        icon: 'lucideLayoutGrid',
        keywords: ['home', 'dashboard'],
      },
      {
        id: 'topology',
        label: 'Topology',
        link: '/topology',
        icon: 'lucideWorkflow',
        reads: '/topology',
        keywords: ['map', 'service map', 'servers'],
      },
    ],
  },
  {
    label: 'Workloads',
    entries: [
      {
        id: 'applications',
        label: 'Applications',
        link: '/apps/applications',
        icon: 'lucidePackage',
        count: 'applications',
        keywords: ['apps', 'tools', 'services'],
      },
      {
        id: 'data',
        label: 'Data stores',
        link: '/apps/data',
        icon: 'lucideDatabase',
        count: 'data',
        keywords: ['databases', 'cache', 'queues', 'storage', 'search'],
      },
      {
        id: 'projects',
        label: 'Projects',
        link: '/apps/projects',
        icon: 'lucideFolder',
        count: 'projects',
        keywords: ['organization', 'workspace', 'team'],
      },
      {
        id: 'system',
        label: 'System apps',
        link: '/apps/system',
        icon: 'lucideShield',
        count: 'system',
        onlyWithSystemApps: true,
      },
    ],
  },
  {
    label: 'Delivery',
    entries: [
      {
        id: 'deploy',
        label: 'Deploy',
        link: '/apps/deploy/new',
        icon: 'lucideUpload',
        keywords: ['create', 'launch', 'new app'],
      },
      {
        id: 'catalog',
        label: 'App catalog',
        link: '/apps/catalog',
        icon: 'lucideStore',
        keywords: ['marketplace', 'install', 'one-click'],
      },
      {
        id: 'repositories',
        label: 'Repositories',
        link: '/apps/repositories',
        icon: 'lucideGitBranch',
        keywords: ['github', 'source', 'git'],
      },
      {
        id: 'templates',
        label: 'Templates',
        link: '/apps/templates',
        icon: 'lucideFileText',
        keywords: ['starter', 'boilerplate'],
      },
      {
        id: 'registry',
        label: 'Image registry',
        link: '/management/registry',
        icon: 'lucideContainer',
        section: 'providers',
        reads: '/image-registry',
        fullAccessOnly: true,
        keywords: ['images', 'bucket', 'space'],
      },
    ],
  },
  {
    label: 'Infrastructure',
    entries: [
      {
        id: 'clusters',
        label: 'Clusters',
        link: '/cluster',
        icon: 'lucideBoxes',
        keywords: ['kubernetes', 'k8s', 'nodes'],
      },
      {
        id: 'compute',
        label: 'Compute',
        link: '/infrastructure/compute',
        icon: 'lucideServer',
        section: 'infrastructure',
        keywords: ['vps', 'instances', 'servers'],
      },
      {
        id: 'scaling',
        label: 'Scaling',
        link: '/scaling',
        icon: 'lucideChartColumn',
        reads: '/infrastructure/scaling',
        keywords: ['autoscaling', 'capacity'],
      },
      {
        id: 'networks',
        label: 'Networks',
        link: '/infrastructure/vnet',
        icon: 'lucideNetwork',
        section: 'infrastructure',
        keywords: ['vnet', 'vpc', 'subnet'],
      },
      {
        id: 'firewall',
        label: 'Firewall',
        link: '/infrastructure/firewall/clusters',
        icon: 'lucideShield',
        keywords: ['security', 'ports', 'rules'],
      },
      {
        id: 'domains',
        label: 'Domains and DNS',
        link: '/infrastructure/domains',
        icon: 'lucideGlobe',
        section: 'infrastructure',
        keywords: ['dns', 'tls', 'certificates'],
      },
      {
        id: 'ssh-keys',
        label: 'SSH keys',
        link: '/infrastructure/keys',
        icon: 'lucideKeyRound',
        section: 'infrastructure',
        reads: '/access/ssh-keys',
        fullAccessOnly: true,
        keywords: ['ssh', 'credentials'],
      },
      {
        id: 'platform',
        label: 'Platform',
        link: '/infrastructure/platform-components',
        icon: 'lucideLayers',
        section: 'infrastructure',
        reads: '/infrastructure/clusters/any/platform-components',
        fullAccessOnly: true,
        keywords: ['system apps', 'addons', 'components'],
      },
    ],
  },
  {
    label: 'Operations',
    entries: [
      {
        id: 'live',
        label: 'Live',
        link: '/management/now',
        icon: 'lucideActivity',
        section: 'clusters',
        keywords: ['load', 'traffic', 'bandwidth', 'health', 'now'],
      },
      {
        id: 'backups',
        label: 'Backups',
        link: '/management/backup',
        icon: 'lucideHistory',
        section: 'backup',
        keywords: ['restore', 'snapshot', 'disaster recovery'],
      },
      {
        id: 'migrations',
        label: 'Migrations',
        link: '/management/migrations',
        icon: 'lucideArrowLeftRight',
        section: 'backup',
        keywords: ['import', 'move', 'transfer'],
      },
      {
        id: 'costs',
        label: 'Costs',
        link: '/infrastructure/costs',
        icon: 'lucideEuro',
        section: 'infrastructure',
        keywords: ['billing', 'spend', 'invoice', 'price'],
      },
      {
        id: 'mail',
        label: 'Mail',
        link: '/management/mail',
        icon: 'lucideMail',
        section: 'mail',
        keywords: ['smtp', 'email', 'dkim'],
      },
    ],
  },
  {
    label: 'Administration',
    entries: [
      {
        id: 'providers',
        label: 'Providers',
        link: '/management/providers',
        icon: 'lucideCloud',
        section: 'providers',
        keywords: ['hetzner', 'scaleway', 'credentials'],
      },
      {
        id: 'access',
        label: 'Access',
        link: '/management/access',
        icon: 'lucideUsers',
        section: 'access',
        keywords: ['iam', 'roles', 'permissions', 'users'],
      },
      {
        id: 'github',
        label: 'GitHub app',
        link: '/apps/repositories/github-setup',
        icon: 'lucideGithub',
        section: 'providers',
        reads: '/repositories/github/setup/health',
        fullAccessOnly: true,
        keywords: ['integration', 'oauth', 'webhook'],
      },
      {
        id: 'agents',
        label: 'Agents',
        link: '/agents',
        icon: 'lucideBot',
        keywords: ['ai', 'assistant', 'automation'],
      },
      {
        id: 'updates',
        label: 'Updates',
        link: '/management/updates',
        icon: 'lucideDownload',
        section: 'infrastructure',
        reads: '/platform/updates',
        updateTag: true,
        keywords: ['upgrade', 'release', 'version'],
      },
      {
        id: 'settings',
        label: 'Settings',
        link: '/settings',
        icon: 'lucideSettings',
        section: 'settings',
        keywords: ['profile', 'preferences'],
      },
    ],
  },
];
