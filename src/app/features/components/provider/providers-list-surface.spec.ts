import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  ProvidersSurfaceInput,
  ProvidersSurfaceRevision,
  buildProvidersSurface,
  presentedContent,
  providerEntityRef,
} from './providers-list-surface';
import type { ProviderDefinitionDto } from '../../../core/api';

const HETZNER: ProviderDefinitionDto = {
  id: 'hetzner' as ProviderDefinitionDto.IdEnum,
  name: 'hetzner',
  displayName: 'Hetzner',
  description: 'European cloud provider',
  logoUrl: '',
  websiteUrl: 'https://hetzner.com',
  documentationUrl: 'https://docs.hetzner.com',
  enabled: true,
  capabilities: {} as ProviderDefinitionDto['capabilities'],
  configurationSchema: {},
};

function input(over: Partial<ProvidersSurfaceInput> = {}): ProvidersSurfaceInput {
  return {
    filteredRows: [{ providerId: 'hetzner', displayName: 'Hetzner', status: 'active' }],
    totalProvidersCount: 4,
    searchTerm: '',
    statusFilter: '',
    credentialTypeFilter: '',
    isLoading: false,
    configuringProvider: null,
    ...over,
  };
}

function snapshotOf(over: Partial<ProvidersSurfaceInput> = {}): SurfaceSnapshot {
  const snapshot = buildProvidersSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
  if (!snapshot) throw new Error('the producer described nothing');
  return snapshot;
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((sc) => sc.id === 'providers:list')!;

describe('providers list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new ProvidersSurfaceRevision();
    const a = input();
    const b = input({ searchTerm: 'hetz' });
    const first = buildProvidersSurface(a, { revision: tracker.next(presentedContent(a)), generatedAt: '2026-09-02T09:00:00.000Z' })!;
    const second = buildProvidersSurface(b, { revision: tracker.next(presentedContent(b)), generatedAt: '2026-09-02T09:01:00.000Z' })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('never names an entity in attention when no provider is being configured — every row is related, not primary', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'providers', reason: 'route' }]);
    const row = snapshot.scopes.find((s) => s.id === 'providers:list:hetzner')!;
    expect(row.entities).toEqual([{ ref: providerEntityRef('hetzner'), label: 'Hetzner', role: 'related' }]);
  });

  it('names the provider being configured as the one selected entity, in addition to its related row', () => {
    const snapshot = snapshotOf({ configuringProvider: HETZNER });
    expect(snapshot.attention).toEqual([
      { scopeId: 'providers:configure:hetzner', entityRef: providerEntityRef('hetzner'), reason: 'selection' },
      { scopeId: 'providers', reason: 'route' },
    ]);
    const selection = snapshot.scopes.find((s) => s.id === 'providers:configure:hetzner')!;
    expect(selection.entities).toEqual([{ ref: providerEntityRef('hetzner'), label: 'Hetzner', role: 'selected' }]);
  });

  it('reports completeness against the true total, and marks filtered when a filter is active', () => {
    const snapshot = snapshotOf({ searchTerm: 'hetz' });
    expect(listScope(snapshot).completeness).toEqual({ shown: 1, total: 4, filtered: true });
  });

  it('presents an honest empty list rather than an invented one when nothing has loaded yet', () => {
    const snapshot = snapshotOf({ filteredRows: [], totalProvidersCount: 0, isLoading: true });
    expect(listScope(snapshot).state).toEqual({ loading: true, empty: true });
    expect(snapshot.scopes.filter((s) => s.kind === 'region').length).toBe(0);
  });

  it('redacts: nothing from the configuration wizard (credential form values) ever reaches the snapshot', () => {
    const json = JSON.stringify(snapshotOf({ configuringProvider: HETZNER }));
    expect(json).not.toContain('apiKey');
    expect(json).not.toContain('secretKey');
    expect(json).not.toContain('accessKey');
    expect(json).not.toContain('password');
  });
});
