import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  ProviderSurfaceInput,
  ProviderSurfaceRevision,
  buildProviderSurface,
  presentedContent,
} from './provider-surface';
import { providerEntityRef } from './providers-list-surface';
import type { ProviderConfigurationDto, ProviderDefinitionDto } from '../../../core/api';
import type { HealthStatus } from '../../model/provider.models';

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

const CONFIG: ProviderConfigurationDto = {
  id: 'cfg-1',
  provider: 'hetzner' as ProviderConfigurationDto.ProviderEnum,
  status: 'active' as ProviderConfigurationDto.StatusEnum,
  enabledRegions: ['eu-central', 'eu-west'],
  isActive: true,
  credentialsType: 'api_key' as ProviderConfigurationDto.CredentialsTypeEnum,
  credentialsExpiresAt: '2027-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  lastHealthCheck: '2026-09-01T00:00:00.000Z',
};

const HEALTH: HealthStatus = { status: 'healthy', lastCheck: new Date('2026-09-01T00:00:00.000Z'), responseTime: 120 };

function input(over: Partial<ProviderSurfaceInput> = {}): ProviderSurfaceInput {
  return { provider: HETZNER, configuration: CONFIG, health: HEALTH, ...over };
}

function snapshotOf(over: Partial<ProviderSurfaceInput> = {}): SurfaceSnapshot {
  const snapshot = buildProviderSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
  if (!snapshot) throw new Error('the producer described nothing');
  return snapshot;
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((sc) => sc.id === 'provider-detail:hetzner')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('provider detail surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new ProviderSurfaceRevision();
    const a = input();
    const b = input({ configuration: { ...CONFIG, isActive: false } });
    const first = buildProviderSurface(a, { revision: tracker.next(presentedContent(a)!), generatedAt: '2026-09-02T09:00:00.000Z' })!;
    const second = buildProviderSurface(b, { revision: tracker.next(presentedContent(b)!), generatedAt: '2026-09-02T09:01:00.000Z' })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('claims the page and the provider itself, with reason route', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([
      { scopeId: 'provider-detail:hetzner', entityRef: providerEntityRef('hetzner'), reason: 'route' },
    ]);
    expect(pageScope(snapshot).entities).toEqual([
      { ref: providerEntityRef('hetzner'), label: 'Hetzner', role: 'primary' },
    ]);
  });

  it('presents configuration, credential metadata (never a value) and health, exactly as shown on screen', () => {
    const snapshot = snapshotOf();
    expect(observation(snapshot, 'flui.provider.status')?.presentedAs.text).toBe('active');
    expect(observation(snapshot, 'flui.provider.active')?.presentedAs.value).toBe(true);
    expect(observation(snapshot, 'flui.provider.credentials_type')?.presentedAs.text).toBe('api_key');
    expect(observation(snapshot, 'flui.provider.credentials_expires_at')?.presentedAs.text).toBe(CONFIG.credentialsExpiresAt);
    expect(observation(snapshot, 'flui.provider.enabled_regions_count')?.presentedAs.value).toBe(2);
    expect(observation(snapshot, 'flui.provider.health_status')?.presentedAs.text).toBe('healthy');
    expect(observation(snapshot, 'flui.provider.health_response_time_ms')?.presentedAs.value).toBe(120);
  });

  it('says nothing about configuration/health fields when neither has loaded yet', () => {
    const snapshot = snapshotOf({ configuration: undefined, health: null });
    expect(observation(snapshot, 'flui.provider.status')?.presentedAs.text).toBe('not_configured');
    expect(observation(snapshot, 'flui.provider.active')).toBeUndefined();
    expect(observation(snapshot, 'flui.provider.credentials_type')).toBeUndefined();
    expect(observation(snapshot, 'flui.provider.health_status')).toBeUndefined();
  });

  it('never invents scope.state from provider/configuration status — that is carried as an observation, not a view error', () => {
    expect(pageScope(snapshotOf()).state).toBeUndefined();
    const errored = { ...CONFIG, status: 'error' as ProviderConfigurationDto.StatusEnum };
    expect(pageScope(snapshotOf({ configuration: errored })).state).toBeUndefined();
  });

  it('produces no snapshot at all when the route id does not resolve to a known provider — no invented selection', () => {
    expect(buildProviderSurface(input({ provider: undefined }), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' })).toBeNull();
  });

  it('redacts: no credential value, no raw health error text, no transient error-toast text reaches the snapshot', () => {
    const leaky: HealthStatus = { status: 'unhealthy', lastCheck: new Date(), errors: ['panic: leaked token sk_live_ABC123'] };
    const json = JSON.stringify(snapshotOf({ health: leaky }));
    expect(json).not.toContain('sk_live_ABC123');
    expect(json).not.toContain('panic');
    // ProviderConfigurationDto never carries a credential value at all — nothing to assert
    // beyond the type not offering one; asserting the shape is stable is done by the
    // TypeScript compiler for this file (ProviderSurfaceInput has no such field).
  });
});
