import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import { applicationEntityRef } from '../application/application-surface';
import {
  CatalogInstallSurfaceInput,
  CatalogInstallSurfaceRevision,
  buildCatalogInstallSurface,
  catalogInstallEntityRef,
  presentedContent,
} from './catalog-install-surface';

const GENERATED_AT = '2026-09-07T14:00:00.000Z';
const INSTALL_ID = 'inst-42';
const PAGE_ID = `catalog-install:${INSTALL_ID}`;

function input(over: Partial<CatalogInstallSurfaceInput> = {}): CatalogInstallSurfaceInput {
  return {
    installId: INSTALL_ID,
    install: {
      id: INSTALL_ID,
      slug: 'immich',
      displayName: 'Immich',
      status: 'RUNNING',
      skipEndpoint: false,
      hasEndpoint: true,
      hasError: false,
    },
    isLoading: false,
    hasLoadError: false,
    progressPct: 100,
    endpointState: 'ready',
    endpointReady: true,
    components: [
      { id: 'app-1', name: 'immich-server', status: 'running', isPrimary: true },
      { id: 'app-2', name: 'immich-postgres', status: 'running', isPrimary: false },
    ],
    databaseComponentCount: 1,
    ...over,
  };
}

function snapshotOf(over: Partial<CatalogInstallSurfaceInput> = {}): SurfaceSnapshot {
  return buildCatalogInstallSurface(input(over), { revision: 1, generatedAt: GENERATED_AT })!;
}

const scope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === id);
const obsOf = (s: SurfaceSnapshot, scopeId: string, key: string) =>
  scope(s, scopeId)?.observations?.find((o) => o.key === key);

describe('catalog install surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('validates while installing, when it failed, when the endpoint was skipped, and when not found', () => {
    expectValidSurface(
      snapshotOf({
        install: { id: INSTALL_ID, slug: 'immich', displayName: 'Immich', status: 'INSTALLING', skipEndpoint: false, hasEndpoint: false, hasError: false },
        progressPct: 40,
        endpointState: null,
        endpointReady: false,
        components: [],
        databaseComponentCount: 0,
      }),
    );
    expectValidSurface(
      snapshotOf({
        install: { id: INSTALL_ID, slug: 'immich', displayName: 'Immich', status: 'FAILED', skipEndpoint: false, hasEndpoint: false, hasError: true },
        endpointState: null,
        endpointReady: false,
      }),
    );
    expectValidSurface(snapshotOf({ install: { id: INSTALL_ID, slug: 'immich', displayName: 'Immich', status: 'RUNNING', skipEndpoint: true, hasEndpoint: false, hasError: false }, endpointState: null, endpointReady: false }));
    expectValidSurface(snapshotOf({ install: null, hasLoadError: true }));
  });

  it('names the install, primary, reason route', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([
      { scopeId: PAGE_ID, entityRef: catalogInstallEntityRef(INSTALL_ID), reason: 'route' },
    ]);
    expect(scope(snapshot, PAGE_ID)!.entities![0].role).toBe('primary');
  });

  it('emits nothing while the install is still being fetched', () => {
    expect(buildCatalogInstallSurface(input({ install: null, isLoading: true }), { revision: 1, generatedAt: GENERATED_AT })).toBeNull();
    expect(buildCatalogInstallSurface(input({ installId: null }), { revision: 1, generatedAt: GENERATED_AT })).toBeNull();
  });

  it('describes "Install not found." as a coded view error naming the install the route asked for', () => {
    const snapshot = snapshotOf({ install: null, hasLoadError: true });
    expect(scope(snapshot, PAGE_ID)!.state).toEqual({
      loading: false,
      error: true,
      errorCode: 'flui.catalog_install.not_found',
    });
    expect(snapshot.scopes.length).toBe(1);
  });

  it('shows the percentage only while the bar is on the screen', () => {
    expect(obsOf(snapshotOf(), PAGE_ID, 'flui.catalog_install.progress')).toBeUndefined();
    const installing = snapshotOf({
      install: { id: INSTALL_ID, slug: 'immich', displayName: 'Immich', status: 'INSTALLING', skipEndpoint: false, hasEndpoint: false, hasError: false },
      progressPct: 40,
    });
    expect(obsOf(installing, PAGE_ID, 'flui.catalog_install.progress')!.presentedAs).toEqual({ value: 40, unit: '%' });
  });

  // Playbook §6 point 2: a failed install is domain news, not the view failing to render.
  it('keeps a FAILED install out of scope.state and in its status and a boolean', () => {
    const snapshot = snapshotOf({
      install: { id: INSTALL_ID, slug: 'immich', displayName: 'Immich', status: 'FAILED', skipEndpoint: false, hasEndpoint: false, hasError: true },
      endpointState: null,
      endpointReady: false,
    });
    expect(scope(snapshot, PAGE_ID)!.state).toEqual({ loading: false });
    expect(obsOf(snapshot, PAGE_ID, 'flui.catalog_install.status')!.presentedAs.text).toBe('FAILED');
    expect(obsOf(snapshot, PAGE_ID, 'flui.catalog_install.has_error')!.presentedAs.value).toBe(true);
  });

  it('gives every component the canonical application ref and marks the primary one', () => {
    const primary = scope(snapshotOf(), `${PAGE_ID}:components:app-1`)!;
    expect(primary.entities).toEqual([{ ref: applicationEntityRef('app-1'), label: 'immich-server', role: 'related' }]);
    expect(primary.observations!.find((o) => o.key === 'flui.application.primary_component')!.presentedAs.value).toBe(true);
  });

  it('says whether an endpoint exists and is ready, and never names the host', () => {
    const snapshot = snapshotOf();
    expect(obsOf(snapshot, PAGE_ID, 'flui.catalog_install.has_endpoint')!.presentedAs.value).toBe(true);
    expect(obsOf(snapshot, PAGE_ID, 'flui.catalog_install.endpoint_state')!.presentedAs.text).toBe('ready');
    expect(obsOf(snapshot, PAGE_ID, 'flui.catalog_install.endpoint_ready')!.presentedAs.value).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('resolvedFqdn');
  });

  // Playbook §7 — the two redaction calls this page forces.
  it('redacts: no connection coordinates, no fqdn, no backend error sentence', () => {
    const json = JSON.stringify(
      snapshotOf({
        install: { id: INSTALL_ID, slug: 'immich', displayName: 'Immich', status: 'FAILED', skipEndpoint: false, hasEndpoint: true, hasError: true },
      }),
    );
    expect(json).not.toContain('errorMessage');
    expect(json).not.toContain('connInfo');
    expect(json).not.toContain('password');
    expect(json).not.toContain('.example.com');
    expect(json).not.toContain('5432');
  });

  it('bumps the revision on real change, and accepts it against the previous snapshot', () => {
    const tracker = new CatalogInstallSurfaceRevision();
    const before = input({
      install: { id: INSTALL_ID, slug: 'immich', displayName: 'Immich', status: 'INSTALLING', skipEndpoint: false, hasEndpoint: false, hasError: false },
      progressPct: 40,
    });
    const first = buildCatalogInstallSurface(before, { revision: tracker.next(presentedContent(before)), generatedAt: GENERATED_AT })!;
    const after = { ...before, progressPct: 80 };
    const second = buildCatalogInstallSurface(after, {
      revision: tracker.next(presentedContent(after)),
      generatedAt: '2026-09-07T14:00:05.000Z',
    })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when nothing presented actually changed', () => {
    const tracker = new CatalogInstallSurfaceRevision();
    expect(tracker.next(presentedContent(input()))).toBe(tracker.next(presentedContent(input())));
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    expect(validateSurfaceSemantics(stale, { previousSnapshot: first })).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });
});
