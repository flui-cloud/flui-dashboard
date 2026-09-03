import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  MailOverviewSurfaceInput,
  MailOverviewSurfaceRevision,
  buildMailOverviewSurface,
  mailDomainEntityRef,
  presentedContent,
} from './mail-overview-surface';
import type { MailOverview } from '../../model/mail-console.models';

const OVERVIEW: MailOverview = {
  provider: 'scaleway-tem',
  window: { from: '2026-08-26T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z', name: '7d' },
  bucket: 'day',
  incident: null,
  kpis: [
    { id: 'sent', count: 120, rate: null, previousCount: 100, previousRate: null, delta: 20, tone: 'neutral' },
    { id: 'bounced', count: 3, rate: 0.025, previousCount: 2, previousRate: 0.02, delta: 1, tone: 'warn' },
  ],
  volume: [],
  domains: [{ domain: 'mail.example.com', spf: 'ok', dkim: 'ok', dmarc: 'ok', verified: true, sent: 120 }],
  senders: [
    {
      from: 'billing@app.example.com',
      domain: 'mail.example.com',
      application: null,
      sent: 120,
      delivered: 117,
      failed: 3,
      deliveredRate: 0.975,
      lastError: 'SMTP 550 mailbox full for someone@example.org',
      lastErrorAt: null,
      lastSentAt: null,
      lastDeliveredAt: null,
      status: 'delivering',
    },
  ],
  unregisteredDomains: [],
};

function input(over: Partial<MailOverviewSurfaceInput> = {}): MailOverviewSurfaceInput {
  return { overview: OVERVIEW, window: '7d', loading: false, hasLoadError: false, ...over };
}

function snapshotOf(over: Partial<MailOverviewSurfaceInput> = {}): SurfaceSnapshot {
  return buildMailOverviewSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.id === 'mail-overview')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('mail overview surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new MailOverviewSurfaceRevision();
    const first = buildMailOverviewSurface(input(), {
      revision: tracker.next(presentedContent(input())),
      generatedAt: '2026-09-02T09:13:00.000Z',
    });
    const changed = input({ window: '30d' });
    const second = buildMailOverviewSurface(changed, {
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

  it('names only the page in attention — no real selection on the KPI dashboard', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'mail-overview', reason: 'route' }]);
  });

  it('references domains as related entities, and presents the window and KPI counts', () => {
    const snapshot = snapshotOf();
    expect(observation(snapshot, 'flui.mail.window')?.presentedAs.text).toBe('7d');
    expect(observation(snapshot, 'flui.mail.kpi.sent')?.presentedAs.value).toBe(120);
    const domainRow = snapshot.scopes.find((s) => s.id.endsWith(':mail.example.com'))!;
    expect(domainRow.entities).toEqual([
      { ref: mailDomainEntityRef('mail.example.com'), label: 'mail.example.com', role: 'related' },
    ]);
  });

  it('shows loading/empty state, not a missing scope, before the overview has arrived', () => {
    const snapshot = snapshotOf({ overview: null, loading: true });
    expect(pageScope(snapshot).state).toEqual({ loading: true, empty: true });
    expect(snapshot.scopes.length).toBe(1);
  });

  it('never invents a domains list scope when there are none yet', () => {
    const snapshot = snapshotOf({ overview: { ...OVERVIEW, domains: [] } });
    expect(snapshot.scopes.some((s) => s.kind === 'list')).toBe(false);
  });

  it('redacts: no sender email address, no recipient, no raw SMTP error text ever reaches the snapshot', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('billing@app.example.com');
    expect(json).not.toContain('someone@example.org');
    expect(json).not.toContain('mailbox full');
  });

  it('redacts: the raw incident detail text never reaches the snapshot, only kind and title', () => {
    const withIncident: MailOverview = {
      ...OVERVIEW,
      incident: { kind: 'sender-down', title: 'Sending has stopped', detail: 'provider=scw code=INTERNAL_5xx trace=abc123', subject: 'x', since: null },
    };
    const snapshot = snapshotOf({ overview: withIncident });
    expect(observation(snapshot, 'flui.mail.incident_kind')?.presentedAs.text).toBe('sender-down');
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain('trace=abc123');
  });
});
