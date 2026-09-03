import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  AccessSurfaceInput,
  AccessSurfaceRevision,
  buildAccessSurface,
  presentedContent,
  grantEntityRef,
  personEntityRef,
  groupEntityRef,
  roleEntityRef,
} from './access-surface';
import type { AccessBinding, AccessRole, GrantRecord, GroupRecord, RoleDef, UserRecord } from '../../model/iam.model';

const USER: UserRecord = {
  id: 'user-1',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  role: 'viewer' as AccessRole,
  isAdmin: false,
  status: 'active',
};

const ADMIN: UserRecord = {
  id: 'user-2',
  email: 'grace@example.com',
  displayName: 'Grace Hopper',
  role: 'owner' as AccessRole,
  isAdmin: true,
  status: 'active',
};

const GRANT: GrantRecord = {
  id: 'grant-1',
  binding: {
    principal: { type: 'user', ref: 'ada@example.com' },
    role: 'operator' as AccessRole,
    scope: { type: 'global' } as AccessBinding['scope'],
  },
};

const GROUP: GroupRecord = { name: 'platform-team', description: 'Runs the platform', members: ['ada@example.com', 'grace@example.com'] };

const ROLE: RoleDef = {
  key: 'operator' as AccessRole,
  name: 'Operator',
  description: 'Can deploy and restart applications',
  permissions: ['app:deploy', 'app:restart'],
  assignable: true,
  grantable: true,
  revocable: true,
};

const roleName = (role: AccessRole) => (role === 'operator' ? 'Operator' : String(role));
const scopeText = (b: AccessBinding) => (b.scope.type === 'global' ? 'Everything' : 'Some scope');

function input(over: Partial<AccessSurfaceInput> = {}): AccessSurfaceInput {
  return {
    activeTab: 'grants',
    grants: [GRANT],
    users: [USER, ADMIN],
    usersError: null,
    groups: [GROUP],
    roles: [ROLE],
    roleName,
    scopeText,
    ...over,
  };
}

function snapshotOf(over: Partial<AccessSurfaceInput> = {}): SurfaceSnapshot {
  const snapshot = buildAccessSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
  if (!snapshot) throw new Error('the producer described nothing');
  return snapshot;
}

const rowsOf = (s: SurfaceSnapshot) => s.scopes.filter((sc) => sc.kind === 'region' && sc.entities?.length);

describe('access surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks, for every tab', () => {
    expectValidSurface(snapshotOf({ activeTab: 'grants' }));
    expectValidSurface(snapshotOf({ activeTab: 'people' }));
    expectValidSurface(snapshotOf({ activeTab: 'groups' }));
    expectValidSurface(snapshotOf({ activeTab: 'roles' }));
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new AccessSurfaceRevision();
    const a = input({ activeTab: 'groups' });
    const b = input({ activeTab: 'groups', groups: [GROUP, { name: 'other', members: [] }] });
    const first = buildAccessSurface(a, { revision: tracker.next(presentedContent(a)), generatedAt: '2026-09-02T09:00:00.000Z' })!;
    const second = buildAccessSurface(b, { revision: tracker.next(presentedContent(b)), generatedAt: '2026-09-02T09:01:00.000Z' })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('is a list page with no selection: attention names only the page, and no row is ever primary/selected', () => {
    const snapshot = snapshotOf({ activeTab: 'people' });
    expect(snapshot.attention).toEqual([{ scopeId: 'access', reason: 'route' }]);
    for (const row of rowsOf(snapshot)) {
      expect(row.entities![0].role).toBe('related');
    }
  });

  it('only builds the list for the active tab — the other three tabs contribute no rows', () => {
    const snapshot = snapshotOf({ activeTab: 'roles' });
    expect(rowsOf(snapshot).length).toBe(1);
    expect(snapshot.scopes.some((s) => s.id.includes(':tab:grants:'))).toBeFalse();
    expect(snapshot.scopes.some((s) => s.id.includes(':tab:people:'))).toBeFalse();
  });

  it('presents each grant\'s principal, role and scope exactly as the Grants table renders them', () => {
    const snapshot = snapshotOf({ activeTab: 'grants' });
    const row = snapshot.scopes.find((s) => s.id === 'access:tab:grants:list:grant-1')!;
    expect(row.entities).toEqual([{ ref: grantEntityRef('grant-1'), label: 'ada@example.com', role: 'related' }]);
    const obs = Object.fromEntries(row.observations!.map((o) => [o.key, o.presentedAs.text]));
    expect(obs['flui.access.grant_principal']).toBe('ada@example.com');
    expect(obs['flui.access.grant_role']).toBe('Operator');
    expect(obs['flui.access.grant_scope']).toBe('Everything');
  });

  it('presents a person\'s email — the field mask mode classifies TENANT_IDENTITY and substitutes when active — and nothing wider', () => {
    const snapshot = snapshotOf({ activeTab: 'people' });
    const row = snapshot.scopes.find((s) => s.id === `access:tab:people:list:${USER.id}`)!;
    expect(row.entities).toEqual([{ ref: personEntityRef(USER.id), label: USER.email, role: 'related' }]);
    const keys = row.observations!.map((o) => o.key);
    expect(keys).toContain('flui.access.person_email');
    expect(keys).not.toContain('flui.access.person_display_name');
    expect(keys).not.toContain('flui.access.person_first_name');
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain(USER.displayName);
  });

  it('marks admin only when true, mirroring the badge the row only shows for an admin', () => {
    const snapshot = snapshotOf({ activeTab: 'people' });
    const adminRow = snapshot.scopes.find((s) => s.id === `access:tab:people:list:${ADMIN.id}`)!;
    const plainRow = snapshot.scopes.find((s) => s.id === `access:tab:people:list:${USER.id}`)!;
    expect(adminRow.observations!.some((o) => o.key === 'flui.access.person_is_admin')).toBeTrue();
    expect(plainRow.observations!.some((o) => o.key === 'flui.access.person_is_admin')).toBeFalse();
  });

  it('presents a group\'s member count, never the members\' emails themselves', () => {
    const snapshot = snapshotOf({ activeTab: 'groups' });
    const row = snapshot.scopes.find((s) => s.id === 'access:tab:groups:list:platform-team')!;
    expect(row.entities).toEqual([{ ref: groupEntityRef('platform-team'), label: 'platform-team', role: 'related' }]);
    const obs = Object.fromEntries(row.observations!.map((o) => [o.key, o.presentedAs.value ?? o.presentedAs.text]));
    expect(obs['flui.access.group_member_count']).toBe(2);
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain('ada@example.com');
    expect(json).not.toContain('grace@example.com');
  });

  it('presents a role\'s name and description, never its raw permission strings', () => {
    const snapshot = snapshotOf({ activeTab: 'roles' });
    const row = snapshot.scopes.find((s) => s.id === 'access:tab:roles:list:operator')!;
    expect(row.entities).toEqual([{ ref: roleEntityRef('operator'), label: 'Operator', role: 'related' }]);
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain('app:deploy');
    expect(json).not.toContain('app:restart');
  });

  it('marks the people list as a view error, without carrying the raw backend message, when the fetch failed', () => {
    const snapshot = snapshotOf({ activeTab: 'people', usersError: 'connection reset by upstream identity service' });
    const list = snapshot.scopes.find((s) => s.id === 'access:tab:people:list')!;
    expect(list.state).toEqual(jasmine.objectContaining({ error: true }));
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain('connection reset by upstream identity service');
  });

  it('presents an honest empty list rather than an invented one before anything has loaded', () => {
    const snapshot = snapshotOf({ activeTab: 'people', users: [] });
    const list = snapshot.scopes.find((s) => s.id === 'access:tab:people:list')!;
    expect(list.state).toEqual({ empty: true });
    expect(rowsOf(snapshot).length).toBe(0);
  });
});
