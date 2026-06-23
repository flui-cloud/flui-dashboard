import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { AppConfigService } from '../../core/services/app-config.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  AccessBinding,
  AccessRole,
  AccessScope,
  AppAttributes,
  ClusterOption,
  GrantRecord,
  GroupRecord,
  PrincipalOption,
  RoleDef,
  SectionOption,
  UserRecord,
  UserStatus,
} from '../model/iam.model';
import { ProjectOption } from '../model/project.model';
import {
  ApiGroup,
  ApiRoleBinding,
  CreatedIdentityUserDto,
  IdentityUserDto,
  InviteLinkDto,
  matchesSelector,
  toCreateBody,
  toGrantRecord,
  toGroupRecord,
  toUserRecord,
} from './iam.mappers';

export interface InviteResult {
  email: string;
  inviteLink?: string;
  inviteCode?: string;
  tempPassword?: string;
}

@Injectable({ providedIn: 'root' })
export class IamService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly notify = inject(NotificationService);

  private get iamBase(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/iam`;
  }

  readonly principals = signal<PrincipalOption[]>([]);

  readonly clusters = signal<ClusterOption[]>([]);

  readonly sections = signal<SectionOption[]>([
    { key: 'catalog', name: 'App Catalog' },
    { key: 'repositories', name: 'Repositories' },
    { key: 'access', name: 'Access' },
    { key: 'projects', name: 'Projects' },
  ]);

  readonly apps = signal<AppAttributes[]>([]);

  readonly projects = signal<ProjectOption[]>([]);

  readonly tags = computed(() =>
    Array.from(new Set(this.apps().flatMap((a) => a.tags))).sort((a, b) =>
      a.localeCompare(b),
    ),
  );

  readonly kinds = computed(() =>
    Array.from(new Set(this.apps().map((a) => a.kind))).sort((a, b) =>
      a.localeCompare(b),
    ),
  );

  readonly roles = signal<RoleDef[]>([
    { key: 'viewer', name: 'Viewer', description: 'Read-only across everything in scope.', permissions: ['app:read', 'cluster:read'] },
    { key: 'editor', name: 'Editor', description: 'View, modify, deploy and operate apps. Cannot manage access.', permissions: ['app:read', 'app:write', 'app:deploy', 'app:create', 'scale:execute', 'migration:execute'] },
    { key: 'manager', name: 'Manager', description: 'Editor + manage access at this scope and below.', permissions: ['app:read', 'app:write', 'app:deploy', 'app:create', 'app:delete', 'scale:execute', 'migration:execute', 'cluster:read', 'cluster:manage', 'iam:assign-role'] },
  ]);

  private readonly _grants = signal<GrantRecord[]>([]);
  readonly grants = this._grants.asReadonly();

  private readonly _groups = signal<GroupRecord[]>([]);
  readonly groups = this._groups.asReadonly();

  private readonly _users = signal<UserRecord[]>([]);
  readonly users = this._users.asReadonly();

  private readonly _usersError = signal<string | null>(null);
  readonly usersError = this._usersError.asReadonly();

  private readonly _lastInvite = signal<InviteResult | null>(null);
  readonly lastInvite = this._lastInvite.asReadonly();

  refresh(): void {
    this.loadRoles();
    this.loadGrants();
    this.loadGroups();
    this.loadResources();
    this.loadPrincipals();
    this.loadClusters();
    this.loadUsers();
    this.loadProjects();
  }

  private loadProjects(): void {
    this.http
      .get<ProjectOption[]>(`${this.appConfig.apiBaseUrl}/api/v1/projects`)
      .subscribe({
        next: (rows) =>
          this.projects.set(rows.map((r) => ({ slug: r.slug, name: r.name }))),
        error: () => this.projects.set([]),
      });
  }

  private loadRoles(): void {
    this.http.get<RoleDef[]>(`${this.iamBase}/roles`).subscribe({
      next: (roles) => {
        if (roles.length) this.roles.set(roles);
      },
      error: () => {
        /* keep built-in seed */
      },
    });
  }

  private loadResources(): void {
    this.http.get<AppAttributes[]>(`${this.iamBase}/resources`).subscribe({
      next: (apps) => this.apps.set(apps),
      error: () => this.apps.set([]),
    });
  }

  private loadPrincipals(): void {
    this.http.get<PrincipalOption[]>(`${this.iamBase}/principals`).subscribe({
      next: (p) => this.principals.set(p),
      error: () => this.principals.set([]),
    });
  }

  private loadClusters(): void {
    this.http
      .get<Array<{ id: string; name: string; provider: string }>>(
        `${this.appConfig.apiBaseUrl}/api/v1/infrastructure/clusters`,
      )
      .subscribe({
        next: (rows) =>
          this.clusters.set(
            rows.map((c) => ({
              id: c.id,
              name: c.name,
              provider: c.provider,
            })),
          ),
        error: () => this.clusters.set([]),
      });
  }

  private loadGrants(): void {
    this.http.get<ApiRoleBinding[]>(`${this.iamBase}/grants`).subscribe({
      next: (rows) => this._grants.set(rows.map((r) => toGrantRecord(r))),
      error: () => this._grants.set([]),
    });
  }

  private loadGroups(): void {
    this.http.get<ApiGroup[]>(`${this.iamBase}/groups`).subscribe({
      next: (rows) => this._groups.set(rows.map((g) => toGroupRecord(g))),
      error: () => this._groups.set([]),
    });
  }

  addGrant(binding: AccessBinding): void {
    this.http
      .post<ApiRoleBinding>(`${this.iamBase}/grants`, toCreateBody(binding))
      .subscribe({
        next: (row) => this._grants.update((g) => [toGrantRecord(row), ...g]),
        error: (e) => this.fail('create grant', e),
      });
  }

  removeGrant(id: string): void {
    this.http.delete<void>(`${this.iamBase}/grants/${id}`).subscribe({
      next: () => this._grants.update((g) => g.filter((x) => x.id !== id)),
      error: (e) => this.fail('remove grant', e),
    });
  }

  private loadUsers(): void {
    this._usersError.set(null);
    this.http
      .get<IdentityUserDto[]>(`${this.appConfig.apiBaseUrl}/api/v1/auth/users`)
      .subscribe({
        next: (rows) => this._users.set(rows.map((u) => toUserRecord(u))),
        error: (e) => {
          this._users.set([]);
          this._usersError.set(this.errorMessage(e));
        },
      });
  }

  globalGrantOf(email: string): GrantRecord | undefined {
    return this._grants().find(
      (g) =>
        g.binding.principal.type === 'user' &&
        g.binding.principal.ref === email &&
        g.binding.scope.type === 'global',
    );
  }

  setUserGlobalRole(email: string, role: AccessRole | null): void {
    const existing = this.globalGrantOf(email);
    if (existing?.binding.role === role) return;
    if (existing) this.removeGrant(existing.id);
    if (role) {
      this.addGrant({
        principal: { type: 'user', ref: email },
        role,
        scope: { type: 'global' },
      });
    }
  }

  setUserAdmin(id: string, makeAdmin: boolean): void {
    this.http
      .patch<void>(`${this.appConfig.apiBaseUrl}/api/v1/auth/users/${id}/role`, {
        role: makeAdmin ? 'admin' : 'user',
      })
      .subscribe({
        next: () =>
          this._users.update((u) =>
            u.map((x) => (x.id === id ? { ...x, isAdmin: makeAdmin } : x)),
          ),
        error: (e) => this.fail('change admin', e),
      });
  }

  inviteUser(input: {
    email: string;
    firstName: string;
    lastName: string;
    sendInvite: boolean;
    admin: boolean;
    access?: {
      mode: 'global' | 'project' | 'group';
      role: AccessRole;
      project?: string;
      group?: string;
    };
  }): void {
    this.http
      .post<CreatedIdentityUserDto>(
        `${this.appConfig.apiBaseUrl}/api/v1/auth/users`,
        {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          sendInvite: input.sendInvite,
          role: input.admin ? 'admin' : 'user',
        },
      )
      .subscribe({
        next: (u) => {
          this._lastInvite.set({
            email: u.email,
            inviteLink: u.inviteLink,
            inviteCode: u.inviteCode,
            tempPassword: u.tempPassword,
          });
          if (!input.admin && input.access) {
            this.assignInitialAccess(u.email, input.access);
          }
          this.loadUsers();
        },
        error: (e) => this.fail('invite user', e),
      });
  }

  private assignInitialAccess(
    email: string,
    access: {
      mode: 'global' | 'project' | 'group';
      role: AccessRole;
      project?: string;
      group?: string;
    },
  ): void {
    if (access.mode === 'group' && access.group) {
      this.addGroupMember(access.group, email);
      return;
    }
    const principal = { type: 'user' as const, ref: email };
    if (access.mode === 'global') {
      this.addGrant({ principal, role: access.role, scope: { type: 'global' } });
    } else if (access.mode === 'project' && access.project) {
      this.addGrant({
        principal,
        role: access.role,
        scope: { type: 'selector', selector: { project: access.project } },
      });
    }
  }

  createInviteLink(userId: string, email: string): void {
    this.http
      .post<InviteLinkDto>(
        `${this.appConfig.apiBaseUrl}/api/v1/auth/users/${userId}/invite-link`,
        {},
      )
      .subscribe({
        next: (r) =>
          this._lastInvite.set({
            email,
            inviteLink: r.inviteLink,
            inviteCode: r.inviteCode,
          }),
        error: (e) => this.fail('generate invite link', e),
      });
  }

  clearInvite(): void {
    this._lastInvite.set(null);
  }

  setUserStatus(_id: string, _status: UserStatus): void {
    this.notify.add({
      title: 'Enabling/disabling users isn’t available yet',
      type: 'info',
      source: 'manual',
    });
  }

  createGroup(name: string, description?: string): void {
    const body: { name: string; description?: string } = { name };
    if (description) body.description = description;
    this.http.post<ApiGroup>(`${this.iamBase}/groups`, body).subscribe({
      next: (g) =>
        this._groups.update((gs) =>
          [...gs, toGroupRecord(g)].sort((a, b) => a.name.localeCompare(b.name)),
        ),
      error: (e) => this.fail('create group', e),
    });
  }

  removeGroup(name: string): void {
    this.http.delete<void>(`${this.iamBase}/groups/${name}`).subscribe({
      next: () => this._groups.update((g) => g.filter((x) => x.name !== name)),
      error: (e) => this.fail('remove group', e),
    });
  }

  addGroupMember(name: string, email: string): void {
    this.http
      .post<ApiGroup>(
        `${this.iamBase}/groups/${name}/members/${encodeURIComponent(email)}`,
        {},
      )
      .subscribe({
        next: (g) => this.replaceGroup(g),
        error: (e) => this.fail('add member', e),
      });
  }

  removeGroupMember(name: string, email: string): void {
    this.http
      .delete<ApiGroup>(
        `${this.iamBase}/groups/${name}/members/${encodeURIComponent(email)}`,
      )
      .subscribe({
        next: (g) => this.replaceGroup(g),
        error: (e) => this.fail('remove member', e),
      });
  }

  matchApps(scope: AccessScope): AppAttributes[] {
    const apps = this.apps();
    switch (scope.type) {
      case 'global':
        return apps;
      case 'cluster':
        return apps.filter((a) => a.clusterId === scope.cluster);
      case 'section':
        return [];
      case 'selector':
        return apps.filter((a) => matchesSelector(a, scope.selector));
    }
  }

  roleName(key: AccessBinding['role']): string {
    return this.roles().find((r) => r.key === key)?.name ?? key;
  }

  clusterName(id: string): string {
    return this.clusters().find((c) => c.id === id)?.name ?? id;
  }

  sectionName(key: string): string {
    return this.sections().find((s) => s.key === key)?.name ?? key;
  }

  principalDisplay(p: AccessBinding['principal']): string {
    return (
      this.principals().find((x) => x.type === p.type && x.ref === p.ref)
        ?.displayName ?? p.ref
    );
  }

  private replaceGroup(g: ApiGroup): void {
    const rec = toGroupRecord(g);
    this._groups.update((gs) => gs.map((x) => (x.name === rec.name ? rec : x)));
  }

  private errorMessage(err: unknown): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? 'Unexpected error';
  }

  private fail(action: string, err: unknown): void {
    this.notify.add({
      title: `Couldn't ${action}`,
      body: this.errorMessage(err),
      type: 'error',
      source: 'manual',
    });
  }
}
