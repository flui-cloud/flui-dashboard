export type AccessRole = 'viewer' | 'operator' | 'maintainer' | 'owner';

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

export interface AccessDeltaApp {
  id: string;
  name: string;
  slug: string;
  clusterName: string;
}

export interface AccessDelta {
  principal: { type: string; ref: string };
  summary: string;
  losesNothing: boolean;
  losesEverything: boolean;
  principalIsPlatformAdmin: boolean;
  sectionsClosed: { key: string }[];
  sectionsDowngraded: { key: string }[];
  sectionsOpened: { key: string }[];
  coverage: 'exact' | 'snapshot' | 'unknown';
  applicationsLost: AccessDeltaApp[];
  applicationsLostCount: number;
  applicationsGained: AccessDeltaApp[];
  applicationsGainedCount: number;
  permissionsLost: string[];
  permissionsGained: string[];
  note?: string;
}

const plural = (n: number): string => (n === 1 ? '' : 's');

const sectionNames = (sections: { key: string }[]): string =>
  sections.map((s) => SECTION_LABELS[s.key] ?? s.key).join(', ');

function applicationsLostLine(d: AccessDelta): string {
  const listed = d.applicationsLost.map((a) => a.slug).join(', ');
  const hidden = d.applicationsLostCount - d.applicationsLost.length;
  const more = hidden > 0 ? `, and ${hidden} more` : '';
  return `Loses ${d.applicationsLostCount} application${plural(d.applicationsLostCount)}: ${listed}${more}`;
}

function unknownCoverageLines(d: AccessDelta): string[] {
  return [
    d.note ??
      'The application inventory could not be read, so what this takes away is not known.',
    'Do not read the empty list as "nothing".',
  ];
}

/**
 * The sentence that stops the preview from claiming to be the whole story.
 *
 * A delta is computed from the bindings this installation holds. Since a rung
 * can also be conferred in the identity provider (decision 101) and the preview
 * has no token to read for somebody who is not the caller, the count is of Flui
 * grants only — so it can overstate a loss (they keep the rung) as easily as a
 * gain (they had it already). Only for a person: a group or a service account
 * has no provider claim behind it.
 */
const IDP_CAVEAT =
  'Counted from grants made in Flui only. A role conferred in your identity provider is not read here, so this can overstate the change.';

export interface AccessDeltaLineOptions {
  /** The installation authenticates through an identity provider. */
  identityProvider?: boolean;
}

function idpCaveatLines(
  d: AccessDelta,
  opts?: AccessDeltaLineOptions,
): string[] {
  return opts?.identityProvider && d.principal.type === 'user'
    ? [IDP_CAVEAT]
    : [];
}

export function accessDeltaLines(
  d: AccessDelta,
  opts?: AccessDeltaLineOptions,
): string[] {
  if (d.coverage === 'unknown') {
    return [...unknownCoverageLines(d), ...idpCaveatLines(d, opts)];
  }

  const lines: string[] = [];
  if (d.applicationsLostCount > 0) {
    lines.push(applicationsLostLine(d));
    if (d.coverage === 'snapshot') {
      lines.push(
        'That list is today’s: the scope is a standing rule, so it also covers whatever matches later.',
      );
    }
  }
  if (d.sectionsClosed.length) {
    lines.push('Sections that close: ' + sectionNames(d.sectionsClosed));
  }
  if (d.sectionsDowngraded.length) {
    lines.push(
      'Sections that become read-only: ' + sectionNames(d.sectionsDowngraded),
    );
  }
  if (d.permissionsLost.length) {
    lines.push('Permissions given up: ' + d.permissionsLost.join(', '));
  }
  if (d.applicationsGainedCount > 0) {
    lines.push(
      `Gains ${d.applicationsGainedCount} application${plural(d.applicationsGainedCount)}.`,
    );
  }
  if (d.sectionsOpened.length) {
    lines.push('Sections that open: ' + sectionNames(d.sectionsOpened));
  }
  if (d.losesEverything) lines.push('They are left with no access at all.');
  lines.push(...idpCaveatLines(d, opts));
  return lines;
}
