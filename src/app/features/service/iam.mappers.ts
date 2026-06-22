import {
  AccessBinding,
  AccessPrincipalType,
  AccessRole,
  AccessScope,
  AccessSelector,
  AppAttributes,
  GrantRecord,
  GroupRecord,
  UserRecord,
  UserStatus,
} from '../model/iam.model';

export interface ApiRoleBinding {
  id: string;
  principalType: AccessPrincipalType;
  principalRef: string;
  role: AccessRole;
  scopeType: AccessScope['type'];
  scopeRef: string | null;
  selector: AccessSelector | null;
}

export interface CreateGrantBody {
  principalType: AccessPrincipalType;
  principalRef: string;
  role: AccessRole;
  scopeType: AccessScope['type'];
  scopeRef?: string;
  selector?: AccessSelector;
}

export interface ApiGroup {
  name: string;
  description: string | null;
  members: string[];
}

export interface IdentityUserDto {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  role: 'admin' | 'user' | 'readonly';
  state?: string;
  isBootstrapAdmin?: boolean;
  isSystemUser?: boolean;
}

export interface CreatedIdentityUserDto {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'readonly';
  tempPassword?: string;
  inviteLink?: string;
  inviteCode?: string;
}

export interface InviteLinkDto {
  inviteLink: string;
  inviteCode: string;
  userId: string;
  organizationId?: string;
}

const IDENTITY_TO_ACCESS_ROLE: Record<string, AccessRole> = {
  admin: 'manager',
  user: 'editor',
  readonly: 'viewer',
};

export function statusFromState(state?: string): UserStatus {
  const s = (state ?? '').toUpperCase();
  if (s.includes('INITIAL')) return 'invited';
  if (s.includes('INACTIVE') || s.includes('LOCKED') || s.includes('SUSPEND'))
    return 'disabled';
  return 'active';
}

export function toScope(
  scopeType: AccessScope['type'],
  scopeRef: string | null,
  selector: AccessSelector | null,
): AccessScope {
  switch (scopeType) {
    case 'global':
      return { type: 'global' };
    case 'section':
      return { type: 'section', section: scopeRef ?? '' };
    case 'cluster':
      return { type: 'cluster', cluster: scopeRef ?? '' };
    case 'selector':
      return { type: 'selector', selector: selector ?? {} };
  }
}

export function toGrantRecord(b: ApiRoleBinding): GrantRecord {
  return {
    id: b.id,
    binding: {
      principal: { type: b.principalType, ref: b.principalRef },
      role: b.role,
      scope: toScope(b.scopeType, b.scopeRef, b.selector),
    },
  };
}

export function toCreateBody(b: AccessBinding): CreateGrantBody {
  const base = {
    principalType: b.principal.type,
    principalRef: b.principal.ref,
    role: b.role,
  };
  switch (b.scope.type) {
    case 'global':
      return { ...base, scopeType: 'global' };
    case 'section':
      return { ...base, scopeType: 'section', scopeRef: b.scope.section };
    case 'cluster':
      return { ...base, scopeType: 'cluster', scopeRef: b.scope.cluster };
    case 'selector':
      return { ...base, scopeType: 'selector', selector: b.scope.selector };
  }
}

export function toGroupRecord(g: ApiGroup): GroupRecord {
  return {
    name: g.name,
    description: g.description ?? undefined,
    members: g.members ?? [],
  };
}

export function toUserRecord(u: IdentityUserDto): UserRecord {
  const displayName =
    u.displayName ||
    [u.firstName, u.lastName].filter(Boolean).join(' ') ||
    u.email;
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName ?? undefined,
    lastName: u.lastName ?? undefined,
    displayName,
    role: IDENTITY_TO_ACCESS_ROLE[u.role] ?? 'viewer',
    isAdmin: u.role === 'admin',
    status: statusFromState(u.state),
    isBootstrapAdmin: u.isBootstrapAdmin ?? false,
    isSystemUser: u.isSystemUser ?? false,
  };
}

export function matchesSelector(a: AppAttributes, s: AccessSelector): boolean {
  const equality: Array<[string | undefined, string | undefined]> = [
    [s.type, a.type],
    [s.kind, a.kind],
    [s.clusterId, a.clusterId],
    [s.clusterName, a.clusterName],
    [s.provider, a.provider],
    [s.project, a.project],
  ];
  if (equality.some(([sel, app]) => !!sel && sel !== app)) return false;
  if (s.slugs?.length && !s.slugs.includes(a.slug)) return false;
  if (s.tags?.length && !s.tags.every((t) => a.tags.includes(t))) return false;
  return true;
}
