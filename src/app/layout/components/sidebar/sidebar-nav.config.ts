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
  },
  {
    label: 'Scaling',
    link: '/scaling',
    routerLinkActive: 'active',
    icon: 'lucideChartNoAxesColumnIncreasing',
  },
];

export const INFRASTRUCTURE_ITEMS: SidebarNavItem[] = [
  {
    label: 'Compute',
    link: '/infrastructure/compute',
    routerLinkActive: 'active',
    icon: 'lucideServer',
  },
  {
    label: 'Virtual Networks',
    link: '/infrastructure/vnet',
    routerLinkActive: 'active',
    icon: 'lucideNetwork',
  },
  {
    label: 'SSH Keys',
    link: '/infrastructure/keys',
    routerLinkActive: 'active',
    icon: 'lucideKeyRound',
  },
  {
    label: 'Domains',
    link: '/infrastructure/domains',
    routerLinkActive: 'active',
    icon: 'lucideGlobe',
  },
  {
    label: 'Platform',
    link: '/infrastructure/platform-components',
    routerLinkActive: 'active',
    icon: 'lucidePackage',
  },
];

export const FIREWALL_ITEMS: SidebarNavItem[] = [
  {
    label: 'Cluster Firewalls',
    link: '/infrastructure/firewall/clusters',
    routerLinkActive: 'active',
    icon: 'lucideShieldCheck',
  },
];

export const DEPLOY_ITEMS: SidebarNavItem[] = [
  {
    label: 'App Catalog',
    link: '/apps/catalog',
    routerLinkActive: 'active',
    icon: 'lucideStore',
  },
  {
    label: 'Repositories',
    link: '/apps/repositories',
    routerLinkActive: 'active',
    icon: 'lucideGitBranch',
  },
  {
    label: 'Templates',
    link: '/apps/templates',
    routerLinkActive: 'active',
    icon: 'lucideFileText',
  },
  {
    label: 'Deploy New',
    link: '/apps/deploy/new',
    routerLinkActive: 'active',
    icon: 'lucideRocket',
  },
];

export const ALL_MANAGEMENT_ITEMS: SidebarNavItem[] = [
  {
    label: 'Providers',
    link: '/management/providers',
    routerLinkActive: 'active',
    icon: 'lucideCloud',
  },
  {
    label: 'Backup',
    link: '/management/backup',
    routerLinkActive: 'active',
    icon: 'lucideArchive',
  },
  {
    label: 'Migrations',
    link: '/management/migrations',
    routerLinkActive: 'active',
    icon: 'lucideArrowRightLeft',
  },
  {
    label: 'Mail',
    link: '/management/mail',
    routerLinkActive: 'active',
    icon: 'lucideMail',
  },
  {
    label: 'GitHub Setup',
    link: '/apps/repositories/github-setup',
    routerLinkActive: 'active',
    icon: 'lucideGithub',
  },
  {
    label: 'Access',
    link: '/management/access',
    routerLinkActive: 'active',
    icon: 'lucideKeyRound',
  },
  {
    label: 'Projects',
    link: '/management/projects',
    routerLinkActive: 'active',
    icon: 'lucideFolders',
  },
  {
    label: 'How it is run',
    link: '/management/operating-context',
    routerLinkActive: 'active',
    icon: 'lucideBookOpen',
  },
  {
    label: 'Agents',
    link: '/settings/agents',
    routerLinkActive: 'active',
    icon: 'lucideBot',
  },
  {
    label: 'Settings',
    link: '/settings',
    routerLinkActive: 'active',
    icon: 'lucideSettings',
  },
];
