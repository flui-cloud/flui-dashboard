import { SidebarNavItem } from '@dawit-io/spartan-sidebar';

export const SHOW_SYSTEM_APPS_KEY = 'sidebar:showSystemApps';

export const MANAGEMENT_SECTION_BY_LABEL: Record<string, string> = {
  Providers: 'providers',
  Backup: 'backup',
  Migrations: 'backup',
  'GitHub Setup': 'providers',
  Access: 'access',
  Projects: 'projects',
  Settings: 'settings',
};

export const CLUSTER_ITEMS: SidebarNavItem[] = [
  {
    label: 'Clusters',
    link: '/cluster',
    routerLinkActive: 'active',
    icon: 'lucideBoxes',
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
    label: 'Settings',
    link: '/settings',
    routerLinkActive: 'active',
    icon: 'lucideSettings',
  },
];
