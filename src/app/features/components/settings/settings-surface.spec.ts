import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  SettingsSurfaceInput,
  SettingsSurfaceRevision,
  buildSettingsSurface,
  presentedContent,
  accountEntityRef,
  inferenceConnectionEntityRef,
} from './settings-surface';

function input(over: Partial<SettingsSurfaceInput> = {}): SettingsSurfaceInput {
  return {
    userId: 'user-1',
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    isAdmin: false,
    authMode: 'local',
    activeTab: 'profile',
    inferenceConnections: [],
    ...over,
  };
}

function snapshotOf(over: Partial<SettingsSurfaceInput> = {}): SurfaceSnapshot {
  const snapshot = buildSettingsSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
  if (!snapshot) throw new Error('the producer described nothing');
  return snapshot;
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((sc) => sc.id === 'settings:user-1')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('settings surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks, for every real tab', () => {
    expectValidSurface(snapshotOf({ activeTab: 'profile' }));
    expectValidSurface(snapshotOf({ activeTab: 'security' }));
    expectValidSurface(snapshotOf({ activeTab: 'agent-keys' }));
    expectValidSurface(snapshotOf({ activeTab: 'auth-proxy' }));
    expectValidSurface(
      snapshotOf({
        activeTab: 'inference-connections',
        inferenceConnections: [{ id: 'conn-1', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', modelsCount: 3, isDefault: true }],
      }),
    );
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new SettingsSurfaceRevision();
    const a = input();
    const b = input({ activeTab: 'security' });
    const first = buildSettingsSurface(a, { revision: tracker.next(presentedContent(a)!), generatedAt: '2026-09-02T09:00:00.000Z' })!;
    const second = buildSettingsSurface(b, { revision: tracker.next(presentedContent(b)!), generatedAt: '2026-09-02T09:01:00.000Z' })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('claims the page and the viewer\'s own account, with reason route', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([
      { scopeId: 'settings:user-1', entityRef: accountEntityRef('user-1'), reason: 'route' },
    ]);
    expect(pageScope(snapshot).entities).toEqual([
      { ref: accountEntityRef('user-1'), label: 'Ada Lovelace', role: 'primary' },
    ]);
  });

  it('presents the viewer\'s own email and auth mode, and admin only when true', () => {
    expect(observation(snapshotOf(), 'flui.settings.email')?.presentedAs.text).toBe('ada@example.com');
    expect(observation(snapshotOf(), 'flui.settings.auth_mode')?.presentedAs.text).toBe('local');
    expect(observation(snapshotOf(), 'flui.settings.is_admin')).toBeUndefined();
    expect(observation(snapshotOf({ isAdmin: true }), 'flui.settings.is_admin')?.presentedAs.value).toBe(true);
  });

  it('adds one tab scope for the active section, owned by the page scope', () => {
    const snapshot = snapshotOf({ activeTab: 'security' });
    const tab = snapshot.scopes.find((s) => s.kind === 'region')!;
    expect(tab.id).toBe('settings:user-1:tab:security');
    expect(tab.observations).toEqual([
      { key: 'flui.settings.active_tab', presentedAs: { text: 'security' }, source: 'ui' },
    ]);
  });

  it('adds no list scope for a tab other than inference-connections', () => {
    const snapshot = snapshotOf({ activeTab: 'security' });
    expect(snapshot.scopes.some((s) => s.kind === 'list')).toBeFalse();
  });

  it('presents each LLM connection\'s label/baseUrl/model count, never an API key value', () => {
    const snapshot = snapshotOf({
      activeTab: 'inference-connections',
      inferenceConnections: [{ id: 'conn-1', label: 'OpenAI (prod)', baseUrl: 'https://api.openai.com/v1', modelsCount: 5, isDefault: true }],
    });
    const row = snapshot.scopes.find((s) => s.id === 'settings:user-1:tab:inference-connections:list:conn-1')!;
    expect(row.entities).toEqual([
      { ref: inferenceConnectionEntityRef('conn-1'), label: 'OpenAI (prod)', role: 'related' },
    ]);
    const obs = Object.fromEntries(row.observations!.map((o) => [o.key, o.presentedAs.value ?? o.presentedAs.text]));
    expect(obs['flui.settings.connection_base_url']).toBe('https://api.openai.com/v1');
    expect(obs['flui.settings.connection_models_count']).toBe(5);
    expect(obs['flui.settings.connection_is_default']).toBe(true);
  });

  it('presents an honest empty connections list rather than an invented one', () => {
    const snapshot = snapshotOf({ activeTab: 'inference-connections', inferenceConnections: [] });
    const list = snapshot.scopes.find((s) => s.id === 'settings:user-1:tab:inference-connections:list')!;
    expect(list.state).toEqual({ empty: true });
  });

  it('produces no snapshot at all when there is no signed-in user yet — no invented account', () => {
    expect(buildSettingsSurface(input({ userId: null }), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' })).toBeNull();
  });

  it('redacts: no password field, no API key value, no security-tab or agent-keys/auth-proxy content reaches the snapshot', () => {
    const json = JSON.stringify(snapshotOf({ activeTab: 'security' }));
    expect(json).not.toContain('password');
    expect(json).not.toContain('currentPassword');
    const withConn = JSON.stringify(
      snapshotOf({
        activeTab: 'inference-connections',
        inferenceConnections: [{ id: 'conn-1', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', modelsCount: 1, isDefault: false }],
      }),
    );
    expect(withConn).not.toContain('sk-');
    expect(withConn).not.toContain('apiKey');
  });
});
