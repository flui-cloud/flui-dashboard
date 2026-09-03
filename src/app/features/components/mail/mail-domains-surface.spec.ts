import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  MailDomainsSurfaceInput,
  MailDomainsSurfaceRevision,
  buildMailDomainsSurface,
  mailDomainEntityRef,
  presentedContent,
} from './mail-domains-surface';
import type { MailDomainProofs } from '../../model/mail-console.models';

const DOMAIN: MailDomainProofs = {
  domain: 'mail.example.com',
  spf: 'ok',
  dkim: 'ok',
  dmarc: 'ok',
  verified: true,
  provider: 'scaleway-tem',
  scope: 'transactional',
  active: true,
  connectionId: 'conn-1',
};

function input(over: Partial<MailDomainsSurfaceInput> = {}): MailDomainsSurfaceInput {
  return { domains: [DOMAIN], loading: false, hasLoadError: false, ...over };
}

function snapshotOf(over: Partial<MailDomainsSurfaceInput> = {}): SurfaceSnapshot {
  return buildMailDomainsSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const rowScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'region')!;

describe('mail domains surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new MailDomainsSurfaceRevision();
    const first = buildMailDomainsSurface(input(), {
      revision: tracker.next(presentedContent(input())),
      generatedAt: '2026-09-02T09:13:00.000Z',
    });
    const changed = input({ domains: [{ ...DOMAIN, verified: false }] });
    const second = buildMailDomainsSurface(changed, {
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

  it('is a list page with no selection: every row is related, uses the same domain ref as mail-overview', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'mail-domains', reason: 'route' }]);
    const row = rowScope(snapshot);
    expect(row.entities).toEqual([
      { ref: mailDomainEntityRef('mail.example.com'), label: 'mail.example.com', role: 'related' },
    ]);
  });

  it('presents provider, scope, active and verified as shown in the row', () => {
    const row = rowScope(snapshotOf());
    const obs = (key: string) => row.observations?.find((o) => o.key === key);
    expect(obs('flui.mail.domain.provider')?.presentedAs.text).toBe('scaleway-tem');
    expect(obs('flui.mail.domain.scope')?.presentedAs.text).toBe('transactional');
    expect(obs('flui.mail.domain.active')?.presentedAs.value).toBe(true);
    expect(obs('flui.mail.domain.verified')?.presentedAs.value).toBe(true);
  });

  it('produces an empty (not missing) list scope when there are no domains yet', () => {
    const snapshot = snapshotOf({ domains: [] });
    expect(listScope(snapshot).state).toEqual({ loading: false, empty: true });
  });

  it('redacts: no DNS record value, no test-send recipient/subject/body, no connectionId ever reaches a row', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('conn-1');
    expect(json).not.toContain('TXT');
  });
});
