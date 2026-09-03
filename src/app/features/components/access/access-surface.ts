import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type {
  AccessBinding,
  AccessRole,
  GrantRecord,
  GroupRecord,
  RoleDef,
  UserRecord,
} from '../../model/iam.model';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';
const PAGE_ID = 'access';
// A generous cap, not a real product limit — same budget-with-honesty approach as the
// vops fleet producer: `completeness` always carries the true total, `truncated` says
// when the cap actually bit.
const MAX_ROWS = 50;

export type AccessTabId = 'grants' | 'people' | 'groups' | 'roles';

export interface AccessSurfaceInput {
  activeTab: AccessTabId;
  grants: GrantRecord[];
  users: UserRecord[];
  usersError: string | null;
  groups: GroupRecord[];
  roles: RoleDef[];
  /** Same functions AccessComponent's own template calls to render the Grants table —
   * reused here rather than re-derived, per §3.4 (anti-drift). */
  roleName: (role: AccessRole) => string;
  scopeText: (binding: AccessBinding) => string;
}

export interface AccessSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

export function grantEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://access-grant/${id}`;
}
export function personEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://identity-user/${id}`;
}
export function groupEntityRef(name: string): string {
  return `${SURFACE_NAMESPACE}://access-group/${encodeURIComponent(name)}`;
}
export function roleEntityRef(key: string): string {
  return `${SURFACE_NAMESPACE}://access-role/${encodeURIComponent(key)}`;
}

function textObservation(
  key: string,
  value: string | undefined | null,
  source: ObservationSource,
): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function valueObservation(key: string, value: number | boolean, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

function titleCase(tab: string): string {
  return tab.charAt(0).toUpperCase() + tab.slice(1);
}

interface RowSpec {
  key: string;
  ref: string;
  label: string;
  observations: Observation[];
}

/**
 * Grants: the "Who" column is `principal.ref` — the email for a user principal, the
 * group name for a group one (verified against AccessBinding/PrincipalOption in
 * iam.model.ts: `ref` IS the email for a user, not a separate display name). This is
 * exactly the field the task's redaction note authorises — the same one the People
 * rows below present — nothing wider.
 */
function grantRow(grant: GrantRecord, roleName: AccessSurfaceInput['roleName'], scopeText: AccessSurfaceInput['scopeText']): RowSpec {
  return {
    key: grant.id,
    ref: grantEntityRef(grant.id),
    label: grant.binding.principal.ref,
    observations: [
      textObservation('flui.access.grant_principal_type', grant.binding.principal.type, 'api'),
      textObservation('flui.access.grant_principal', grant.binding.principal.ref, 'api'),
      textObservation('flui.access.grant_role', roleName(grant.binding.role), 'ui'),
      textObservation('flui.access.grant_scope', scopeText(grant.binding), 'ui'),
    ].filter((o): o is Observation => o !== null),
  };
}

/**
 * People: `email` is IdentityUser.email, classified TENANT_IDENTITY server-side (mask
 * mode substitutes it when active) — the one identity field this producer is authorised
 * to carry. Nothing else identity-adjacent is added: no `firstName`/`lastName`/
 * `displayName` (a second, wider identity field with no equivalent precedent), and no
 * raw role/permission internals — `isAdmin` is presented only when true, mirroring the
 * "Platform admin" badge that is the only admin-related thing the row actually renders
 * (a per-user *global role* label would need iam.globalGrantOf's own derivation, which
 * lives in PeopleTabComponent, not in data this producer already reads — left out; the
 * Grants tab already presents role assignments with their real role labels).
 */
function personRow(user: UserRecord): RowSpec {
  return {
    key: user.id,
    ref: personEntityRef(user.id),
    label: user.email,
    observations: [
      textObservation('flui.access.person_email', user.email, 'api'),
      textObservation('flui.access.person_status', user.status, 'api'),
      user.isAdmin ? valueObservation('flui.access.person_is_admin', true, 'api') : null,
    ].filter((o): o is Observation => o !== null),
  };
}

/**
 * Groups: member *count* only. The page also renders each member's email as a chip,
 * which is the same email field authorised above — but a group can hold many, and the
 * observation wire form (`presentedAs.text`, a single bounded string) has no clean way
 * to carry a list of them without concatenation. Left out rather than guessed at; see
 * the task report for this explicit call.
 */
function groupRow(group: GroupRecord): RowSpec {
  return {
    key: group.name,
    ref: groupEntityRef(group.name),
    label: group.name,
    observations: [
      valueObservation('flui.access.group_member_count', group.members.length, 'derived'),
      textObservation('flui.access.group_description', group.description, 'api'),
    ].filter((o): o is Observation => o !== null),
  };
}

/** Roles: name (as the entity label) and description — never `permissions`, the raw
 * capability-string list the page also renders, per the task's explicit boundary. */
function roleRow(role: RoleDef): RowSpec {
  return {
    key: role.key,
    ref: roleEntityRef(role.key),
    label: role.name,
    observations: [textObservation('flui.access.role_description', role.description, 'api')].filter(
      (o): o is Observation => o !== null,
    ),
  };
}

function rowsFor(input: AccessSurfaceInput): RowSpec[] {
  switch (input.activeTab) {
    case 'grants':
      return input.grants.map((g) => grantRow(g, input.roleName, input.scopeText));
    case 'people':
      return input.users.map(personRow);
    case 'groups':
      return input.groups.map(groupRow);
    case 'roles':
      return input.roles.map(roleRow);
  }
}

function totalFor(input: AccessSurfaceInput): number {
  switch (input.activeTab) {
    case 'grants':
      return input.grants.length;
    case 'people':
      return input.users.length;
    case 'groups':
      return input.groups.length;
    case 'roles':
      return input.roles.length;
  }
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Access has no single entity to focus on — every tab is a list, and a row here is
 * managed in place (an inline `<select>`, a chip's remove button), never navigated to.
 * Per §4 of the playbook (the vops fleet pattern): `attention` names only the page, and
 * every row is `role: 'related'`, never `'primary'`/`'selected'` — no selection state is
 * invented for a product that has none.
 */
export function presentedContent(input: AccessSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = { id: PAGE_ID, kind: 'page', label: 'Access' };

  const tabId = `${PAGE_ID}:tab:${input.activeTab}`;
  const tabScope: SemanticScopeSnapshot = {
    id: tabId,
    parentId: PAGE_ID,
    kind: 'region',
    label: titleCase(input.activeTab),
  };

  const listId = `${tabId}:list`;
  const total = totalFor(input);
  const allRows = rowsFor(input);
  const rows = allRows.slice(0, MAX_ROWS);
  const truncated = allRows.length > rows.length;

  // `state` describes this view, never domain health (§ "errori già fatti", punto 2): a
  // failed fetch of the people list is a view error, so it goes here — but the raw
  // message (`usersError`) is backend free text and is deliberately not carried, only
  // the fact that loading it failed.
  const listScope: SemanticScopeSnapshot = {
    id: listId,
    parentId: tabId,
    kind: 'list',
    observations: [valueObservation('flui.access.shown_count', rows.length, 'derived')],
    completeness: {
      shown: rows.length,
      total,
      ...(truncated ? { truncated: true } : {}),
    },
    state: {
      empty: rows.length === 0,
      ...(input.activeTab === 'people' && input.usersError ? { error: true } : {}),
    },
  };

  const rowScopes: SemanticScopeSnapshot[] = rows.map((row) => ({
    id: `${listId}:${row.key}`,
    parentId: listId,
    kind: 'region',
    entities: [{ ref: row.ref, label: row.label, role: 'related' } satisfies EntityReference],
    ...(row.observations.length ? { observations: row.observations } : {}),
  }));

  return {
    scopes: [pageScope, tabScope, listScope, ...rowScopes],
    attention: [{ scopeId: PAGE_ID, reason: 'route' }],
  };
}

export function buildAccessSurface(
  input: AccessSurfaceInput,
  context: AccessSurfaceContext,
): SurfaceSnapshot | null {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: `management/access/${input.activeTab}`,
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

/** Same content-hash approach as ApplicationSurfaceRevision — see application-surface.ts. */
export class AccessSurfaceRevision {
  private counter = 0;
  private lastHash = '';

  next(presented: PresentedContent): number {
    const hash = JSON.stringify(presented);
    if (hash !== this.lastHash) {
      this.lastHash = hash;
      this.counter += 1;
    }
    return this.counter;
  }
}
