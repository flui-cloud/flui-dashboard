export type AccessRole = 'viewer' | 'editor' | 'manager' | 'owner';

export type AccessPrincipalType = 'user' | 'group' | 'service_account';

export interface AccessPrincipal {
  type: AccessPrincipalType;
  ref: string;
}

export interface AccessSelector {
  slugs?: string[];
  type?: 'system' | 'user';
  kind?: string;
  clusterId?: string;
  clusterName?: string;
  provider?: string;
  project?: string;
  tags?: string[];
  // Follows the resource rather than its location, so a grant covers what its holder creates next.
  owner?: string;
}

export type AccessScope =
  | { type: 'global' }
  | { type: 'section'; section: string }
  | { type: 'cluster'; cluster: string }
  | { type: 'selector'; selector: AccessSelector };

export interface AccessBinding {
  principal: AccessPrincipal;
  role: AccessRole;
  scope: AccessScope;
}

export interface PrincipalOption {
  type: AccessPrincipalType;
  ref: string;
  displayName: string;
}

export interface RoleDef {
  key: AccessRole;
  name: string;
  description: string;
  permissions: string[];
  assignable: boolean;
  grantable: boolean;
  revocable: boolean;
}

export interface AppAttributes {
  id: string;
  slug: string;
  name: string;
  type: 'system' | 'user';
  kind: string;
  clusterId: string;
  clusterName: string;
  provider: string;
  project?: string;
  tags: string[];
  // Null when the app belongs to nobody: system apps, API-key installs.
  owner?: string | null;
}

export interface ClusterOption {
  id: string;
  name: string;
  provider: string;
}

export interface SectionOption {
  key: string;
  name: string;
}

export interface GrantRecord {
  id: string;
  binding: AccessBinding;
}

export type UserStatus = 'active' | 'invited' | 'disabled';

export interface UserRecord {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  role: AccessRole;
  isAdmin: boolean;
  status: UserStatus;
  isBootstrapAdmin?: boolean;
  isSystemUser?: boolean;
}

export interface GroupRecord {
  name: string;
  description?: string;
  members: string[];
}

export type ScopeKind =
  | 'everything'
  | 'cluster'
  | 'project'
  | 'app'
  | 'kind'
  | 'tag'
  | 'section';

export const SECTION_LABELS: Record<string, string> = {
  home: 'Home',
  workloads: 'Workloads',
  deploy: 'Deploy',
  clusters: 'Clusters',
  infrastructure: 'Infrastructure',
  firewall: 'Firewall',
  providers: 'Providers',
  backup: 'Backup',
  mail: 'Mail',
  projects: 'Projects',
  access: 'Access',
  settings: 'Settings',
};

export const ALL_SECTION_KEYS = Object.keys(SECTION_LABELS);

export function sectionsForPermissions(
  perms: readonly string[],
  isGlobal: boolean,
): string[] {
  const any = (p: string) => perms.includes(p);
  const global = (p: string) => isGlobal && perms.includes(p);
  const keys = new Set<string>(['home', 'settings']);
  if (any('app:read')) keys.add('workloads');
  if (any('app:create')) keys.add('deploy');
  if (global('cluster:read')) keys.add('clusters');
  if (global('cluster:manage')) {
    keys.add('infrastructure');
    keys.add('firewall');
    keys.add('providers');
    keys.add('backup');
    keys.add('mail');
  }
  if (global('iam:assign-role')) {
    keys.add('projects');
    keys.add('access');
  }
  return ALL_SECTION_KEYS.filter((k) => keys.has(k));
}
