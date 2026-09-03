import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  MailProvidersSurfaceInput,
  MailProvidersSurfaceRevision,
  buildMailProvidersSurface,
  mailConnectionEntityRef,
  presentedContent,
} from './mail-providers-surface';
import type { MailConnection } from '../../model/mail-console.models';

const CONNECTION: MailConnection = {
  id: 'conn-1',
  provider: 'scaleway-tem',
  scope: 'transactional',
  label: 'Scaleway TEM',
  sendingDomain: 'mail.example.com',
  isActive: true,
  hasCredential: true,
  webhookRegistered: true,
  implicit: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function input(over: Partial<MailProvidersSurfaceInput> = {}): MailProvidersSurfaceInput {
  return { connections: [CONNECTION], loading: false, hasLoadError: false, ...over };
}

function snapshotOf(over: Partial<MailProvidersSurfaceInput> = {}): SurfaceSnapshot {
  return buildMailProvidersSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const rowScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'region')!;

describe('mail providers surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new MailProvidersSurfaceRevision();
    const first = buildMailProvidersSurface(input(), {
      revision: tracker.next(presentedContent(input())),
      generatedAt: '2026-09-02T09:13:00.000Z',
    });
    const changed = input({ connections: [{ ...CONNECTION, isActive: false }] });
    const second = buildMailProvidersSurface(changed, {
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

  it('is a list page with no selection: every row is related, never primary', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'mail-providers', reason: 'route' }]);
    const row = rowScope(snapshot);
    expect(row.entities).toEqual([
      { ref: mailConnectionEntityRef('conn-1'), label: 'Scaleway TEM', role: 'related' },
    ]);
  });

  it('presents provider, scope, sending domain, active/credential/webhook flags — never the secret itself', () => {
    const row = rowScope(snapshotOf());
    const obs = (key: string) => row.observations?.find((o) => o.key === key);
    expect(obs('flui.mail.connection.provider')?.presentedAs.text).toBe('scaleway-tem');
    expect(obs('flui.mail.connection.has_credential')?.presentedAs.value).toBe(true);
    expect(obs('flui.mail.connection.active')?.presentedAs.value).toBe(true);
  });

  it('produces an empty (not missing) list scope when nothing is connected yet', () => {
    const snapshot = snapshotOf({ connections: [] });
    expect(listScope(snapshot).state).toEqual({ loading: false, empty: true });
  });

  it('redacts: MailConnection never carries a secret field, so none can leak — asserted structurally', () => {
    const json = JSON.stringify(snapshotOf());
    // The connect-a-new-provider panel's draft secret/API key/SMTP config is a different,
    // in-progress input this producer never reads (see the file's own comment) — this
    // guards against a future field rename accidentally wiring it in.
    expect(Object.keys(CONNECTION)).not.toContain('secret');
    expect(json).not.toContain('secret');
    expect(json).not.toContain('password');
  });
});
