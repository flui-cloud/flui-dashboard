import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  RepositoriesListSurfaceInput,
  RepositoriesListSurfaceRevision,
  repositoryEntityRef,
  buildRepositoriesListSurface,
  presentedContent,
} from './repositories-list-surface';
import { ConnectedRepository } from '../../service/repository.service';
import { GitProvider } from '../../model/application.models';

function repo(over: Partial<ConnectedRepository> = {}): ConnectedRepository {
  return {
    id: 'r1',
    name: 'billing-api',
    fullName: 'flui-cloud/billing-api',
    private: false,
    hasDockerfile: true,
    hasPackageJson: true,
    connected: true,
    provider: GitProvider.GitHub,
    url: 'https://github.com/flui-cloud/billing-api',
    branch: 'main',
    webhookEnabled: true,
    autoDeployEnabled: false,
    ...over,
  };
}

function input(over: Partial<RepositoriesListSurfaceInput> = {}): RepositoriesListSurfaceInput {
  return {
    pageState: 'connected',
    authMethod: 'github_app',
    allRepos: [repo()],
    connectedCount: 1,
    autoDeployCount: 0,
    importModalOpen: false,
    importSelectedCount: 0,
    deleteModalOpen: false,
    repoToDelete: null,
    ...over,
  };
}

function snapshotOf(over: Partial<RepositoriesListSurfaceInput> = {}): SurfaceSnapshot {
  return buildRepositoriesListSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
}

const pageScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.kind === 'page')!;
const listScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.kind === 'list');
const rowScopes = (snapshot: SurfaceSnapshot) => snapshot.scopes.filter((s) => s.kind === 'region');
const overlayScopes = (snapshot: SurfaceSnapshot) => snapshot.scopes.filter((s) => s.kind === 'overlay');
const observation = (snapshot: SurfaceSnapshot, key: string) =>
  pageScope(snapshot).observations?.find((o) => o.key === key);

describe('repositories list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new RepositoriesListSurfaceRevision();
    const first = buildRepositoriesListSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-08-20T09:13:00.000Z' });
    const second = buildRepositoriesListSurface(
      input({ connectedCount: 2 }),
      { revision: tracker.next(presentedContent(input({ connectedCount: 2 }))), generatedAt: '2026-08-20T09:14:00.000Z' },
    );
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });

  it('the main list has no selection: every row is related, and attention (when no overlay is open) names only the page', () => {
    const snapshot = snapshotOf({ allRepos: [repo({ id: 'r1' }), repo({ id: 'r2', fullName: 'flui-cloud/worker' })] });
    expect(snapshot.attention).toEqual([{ scopeId: 'repositories', reason: 'route' }]);
    for (const row of rowScopes(snapshot)) {
      expect(row.entities?.every((e) => e.role === 'related')).toBe(true);
    }
  });

  it('emits no list scope at all while the GitHub funnel has not reached "connected" — not an empty one', () => {
    const snapshot = snapshotOf({ pageState: 'not-connected', allRepos: [] });
    expect(listScope(snapshot)).toBeUndefined();
    expect(rowScopes(snapshot).length).toBe(0);
  });

  it('says nothing about stats/auth when not connected, something when connected', () => {
    expect(observation(snapshotOf({ pageState: 'not-connected' }), 'flui.repositories.total')).toBeUndefined();
    expect(observation(snapshotOf({ pageState: 'connected' }), 'flui.repositories.total')?.presentedAs.value).toBe(1);
  });

  it('the delete-confirm overlay names the one repository being confirmed, role selected, attention reason overlay', () => {
    const target = repo({ id: 'r9', fullName: 'flui-cloud/target' });
    const snapshot = snapshotOf({ deleteModalOpen: true, repoToDelete: target, allRepos: [target] });
    const overlays = overlayScopes(snapshot);
    expect(overlays.length).toBe(1);
    expect(overlays[0].entities).toEqual([{ ref: repositoryEntityRef('r9'), label: 'flui-cloud/target', role: 'selected' }]);
    expect(snapshot.attention).toEqual([
      { scopeId: 'repositories:delete', entityRef: repositoryEntityRef('r9'), reason: 'overlay' },
    ]);
  });

  it('the import overlay carries only a count, never entity refs for not-yet-imported candidates', () => {
    const snapshot = snapshotOf({ importModalOpen: true, importSelectedCount: 3 });
    const overlays = overlayScopes(snapshot);
    expect(overlays.length).toBe(1);
    expect(overlays[0].entities).toBeUndefined();
    expect(overlays[0].observations).toEqual([
      { key: 'flui.repositories.import_selected_count', presentedAs: { value: 3 }, source: 'ui' },
    ]);
    expect(snapshot.attention).toEqual([{ scopeId: 'repositories:import', reason: 'overlay' }]);
  });

  it('deterministic arbitration: if both overlays are somehow open, the entity-bearing delete overlay wins attention', () => {
    const target = repo({ id: 'r9' });
    const snapshot = snapshotOf({
      importModalOpen: true,
      importSelectedCount: 2,
      deleteModalOpen: true,
      repoToDelete: target,
      allRepos: [target],
    });
    expect(overlayScopes(snapshot).length).toBe(2);
    expect(snapshot.attention[0].scopeId).toBe('repositories:delete');
  });

  it('caps row scopes at the budget and declares truncation honestly', () => {
    const many = Array.from({ length: 25 }, (_, i) => repo({ id: `r${i}`, fullName: `org/app-${i}` }));
    const snapshot = snapshotOf({ allRepos: many });
    expect(rowScopes(snapshot).length).toBe(20);
    expect(listScope(snapshot)?.completeness).toEqual({ shown: 20, total: 25, truncated: true });
  });

  it('redacts: no repo URL, no clone URL, ever reaches the snapshot', () => {
    const withUrl = repo({ url: 'https://github.com/flui-cloud/super-secret-internal-repo' });
    const json = JSON.stringify(snapshotOf({ allRepos: [withUrl] }));
    expect(json).not.toContain('https://github.com');
    expect(json).not.toContain('super-secret-internal-repo');
  });
});
