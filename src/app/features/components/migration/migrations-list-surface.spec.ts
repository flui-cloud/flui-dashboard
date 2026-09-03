import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  MigrationsListSurfaceInput,
  MigrationsListSurfaceRevision,
  buildMigrationsListSurface,
  migrationEntityRef,
  presentedContent,
} from './migrations-list-surface';
import type { AppMigration, MigrationRow } from '../../service/migration.service';

const APP_MIGRATION: AppMigration = {
  id: 'mig-1',
  srcAppId: 'app-1',
  srcClusterId: 'cl-1',
  targetClusterId: 'cl-2',
  cutoverMode: 'manual',
  status: 'ready',
  createdAt: '2026-09-01T00:00:00.000Z',
};

const ROW: MigrationRow = { type: 'app', ...APP_MIGRATION };

function input(over: Partial<MigrationsListSurfaceInput> = {}): MigrationsListSurfaceInput {
  return { migrations: [ROW], loading: false, hasLoadError: false, ...over };
}

function snapshotOf(over: Partial<MigrationsListSurfaceInput> = {}): SurfaceSnapshot {
  return buildMigrationsListSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const rowScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'region')!;

describe('migrations list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new MigrationsListSurfaceRevision();
    const first = buildMigrationsListSurface(input(), {
      revision: tracker.next(presentedContent(input())),
      generatedAt: '2026-09-02T09:13:00.000Z',
    });
    const changed = input({ migrations: [{ ...ROW, status: 'completed' }] });
    const second = buildMigrationsListSurface(changed, {
      revision: tracker.next(presentedContent(changed)),
      generatedAt: '2026-09-02T09:14:00.000Z',
    });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('is a list page with no selection — rows drive inline actions, not a detail route: attention names only the page', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'migrations', reason: 'route' }]);
    const row = rowScope(snapshot);
    expect(row.entities).toEqual([{ ref: migrationEntityRef(ROW), role: 'related' }]);
  });

  it('mints a composite ref disambiguated by migration type (app/db/full share no id space)', () => {
    expect(migrationEntityRef({ type: 'app', id: 'x' })).toBe('flui://migration/app:x');
    expect(migrationEntityRef({ type: 'db', id: 'x' })).toBe('flui://migration/db:x');
  });

  it('presents type, status, cutover mode and target cluster as shown in the row', () => {
    const row = rowScope(snapshotOf());
    const obs = (key: string) => row.observations?.find((o) => o.key === key);
    expect(obs('flui.migration.type')?.presentedAs.text).toBe('app');
    expect(obs('flui.migration.status')?.presentedAs.text).toBe('ready');
    expect(obs('flui.migration.cutover_mode')?.presentedAs.text).toBe('manual');
  });

  it('declares completeness, and truncates past the row cap', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ ...ROW, id: `m${i}` }));
    const snapshot = snapshotOf({ migrations: many });
    expect(listScope(snapshot).completeness).toEqual({ shown: 50, total: 60, truncated: true });
  });

  it('produces an empty (not missing) list scope when there are no migrations yet', () => {
    const snapshot = snapshotOf({ migrations: [] });
    expect(listScope(snapshot).state).toEqual({ loading: false, empty: true });
  });

  it('redacts: the raw migration error text never reaches a row, only a boolean flag', () => {
    const withError: MigrationRow = { ...ROW, errorMessage: 'panic: leaked token sk_live_MMM' };
    const json = JSON.stringify(snapshotOf({ migrations: [withError] }));
    expect(json).not.toContain('sk_live_MMM');
    const row = rowScope(snapshotOf({ migrations: [withError] }));
    expect(row.observations?.find((o) => o.key === 'flui.migration.has_error')?.presentedAs.value).toBe(true);
  });
});
