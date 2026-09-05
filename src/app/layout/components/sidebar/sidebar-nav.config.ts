import { SidebarNavItem } from '@dawit-io/spartan-sidebar';

export const SHOW_SYSTEM_APPS_KEY = 'sidebar:showSystemApps';

export const MANAGEMENT_SECTION_BY_LABEL: Record<string, string> = {
  Providers: 'providers',
  Backup: 'backup',
  Migrations: 'backup',
  Mail: 'mail',
  'GitHub Setup': 'providers',
  Access: 'access',
  Projects: 'projects',
  Updates: 'infrastructure',
  Settings: 'settings',
};

export const FULL_ACCESS_ONLY_LABELS: ReadonlySet<string> = new Set([
  'SSH Keys',
  'Platform',
  'GitHub Setup',
]);

export const INFRASTRUCTURE_SECTION_BY_LABEL: Record<string, string> = {
  Compute: 'infrastructure',
  'Virtual Networks': 'infrastructure',
  'SSH Keys': 'infrastructure',
  Domains: 'infrastructure',
  Platform: 'infrastructure',
};

export const CLUSTER_ITEMS: SidebarNavItem[] = [
  {
    label: 'Clusters',
    link: '/cluster',
    routerLinkActive: 'active',
    icon: 'lucideBoxes',
    keywords: ['kubernetes', 'k8s', 'provision', 'servers'],
  },
  {
    label: 'Scaling',
    link: '/scaling',
    routerLinkActive: 'active',
    icon: 'lucideChartNoAxesColumnIncreasing',
    keywords: ['autoscaling', 'hpa', 'capacity', 'nodes'],
  },
];

export const INFRASTRUCTURE_ITEMS: SidebarNavItem[] = [
  {
    label: 'Compute',
    link: '/infrastructure/compute',
    routerLinkActive: 'active',
    icon: 'lucideServer',
    keywords: ['vps', 'instances', 'hetzner', 'scaleway'],
  },
  {
    label: 'Virtual Networks',
    link: '/infrastructure/vnet',
    routerLinkActive: 'active',
    icon: 'lucideNetwork',
    keywords: ['vnet', 'vpc', 'subnet', 'network'],
  },
  {
    label: 'SSH Keys',
    link: '/infrastructure/keys',
    routerLinkActive: 'active',
    icon: 'lucideKeyRound',
    keywords: ['ssh', 'credentials', 'authentication', 'keys'],
  },
  {
    label: 'Domains',
    link: '/infrastructure/domains',
    routerLinkActive: 'active',
    icon: 'lucideGlobe',
    keywords: ['dns', 'tls', 'ssl', 'certificates', 'issuer'],
  },
  {
    label: 'Platform',
    link: '/infrastructure/platform-components',
    routerLinkActive: 'active',
    icon: 'lucidePackage',
    keywords: ['system apps', 'addons', 'components'],
  },
];

export const FIREWALL_ITEMS: SidebarNavItem[] = [
  {
    label: 'Cluster Firewalls',
    link: '/infrastructure/firewall/clusters',
    routerLinkActive: 'active',
    icon: 'lucideShieldCheck',
    keywords: ['security', 'ports', 'rules', 'network policy'],
  },
];

export const DEPLOY_ITEMS: SidebarNavItem[] = [
  {
    label: 'App Catalog',
    link: '/apps/catalog',
    routerLinkActive: 'active',
    icon: 'lucideStore',
    keywords: ['marketplace', 'one-click', 'install', 'templates'],
  },
  {
    label: 'Repositories',
    link: '/apps/repositories',
    routerLinkActive: 'active',
    icon: 'lucideGitBranch',
    keywords: ['github', 'source', 'repo', 'git'],
  },
  {
    label: 'Templates',
    link: '/apps/templates',
    routerLinkActive: 'active',
    icon: 'lucideFileText',
    keywords: ['scaffolding', 'starter', 'boilerplate'],
  },
  {
    label: 'Deploy New',
    link: '/apps/deploy/new',
    routerLinkActive: 'active',
    icon: 'lucideRocket',
    keywords: ['create', 'launch', 'new app'],
  },
];

export const ALL_MANAGEMENT_ITEMS: SidebarNavItem[] = [
  {
    label: 'Providers',
    link: '/management/providers',
    routerLinkActive: 'active',
    icon: 'lucideCloud',
    keywords: ['hetzner', 'scaleway', 'contabo', 'credentials', 'cloud'],
  },
  {
    label: 'Backup',
    link: '/management/backup',
    routerLinkActive: 'active',
    icon: 'lucideArchive',
    keywords: ['restore', 'snapshot', 'disaster recovery'],
  },
  {
    label: 'Migrations',
    link: '/management/migrations',
    routerLinkActive: 'active',
    icon: 'lucideArrowRightLeft',
    keywords: ['import', 'move', 'transfer'],
  },
  {
    label: 'Mail',
    link: '/management/mail',
    routerLinkActive: 'active',
    icon: 'lucideMail',
    keywords: ['smtp', 'email', 'notifications', 'dkim'],
  },
  {
    label: 'GitHub Setup',
    link: '/apps/repositories/github-setup',
    routerLinkActive: 'active',
    icon: 'lucideGithub',
    keywords: ['integration', 'oauth', 'webhook'],
  },
  {
    label: 'Access',
    link: '/management/access',
    routerLinkActive: 'active',
    icon: 'lucideKeyRound',
    keywords: ['iam', 'roles', 'permissions', 'rbac', 'users'],
  },
  {
    label: 'Projects',
    link: '/management/projects',
    routerLinkActive: 'active',
    icon: 'lucideFolders',
    keywords: ['organization', 'workspace', 'team'],
  },
  {
    label: 'Updates',
    link: '/management/updates',
    routerLinkActive: 'active',
    icon: 'lucideDownload',
    keywords: ['upgrade', 'release', 'version', 'platform'],
  },
  {
    label: 'How it is run',
    link: '/management/operating-context',
    routerLinkActive: 'active',
    icon: 'lucideBookOpen',
    keywords: ['architecture', 'ops', 'runbook', 'operating model'],
  },
  {
    label: 'Agents',
    link: '/agents',
    routerLinkActive: 'active',
    icon: 'lucideBot',
    keywords: ['ai', 'assistant', 'automation', 'copilot'],
  },
  {
    label: 'Settings',
    link: '/settings',
    routerLinkActive: 'active',
    icon: 'lucideSettings',
    keywords: ['profile', 'preferences', 'account'],
  },
];
