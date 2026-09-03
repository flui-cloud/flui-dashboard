import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  MailSuppressionsSurfaceInput,
  MailSuppressionsSurfaceRevision,
  buildMailSuppressionsSurface,
  presentedContent,
} from './mail-suppressions-surface';
import type { MailSuppression } from '../../model/mail-console.models';

const ENTRY: MailSuppression = {
  address: 'someone@example.org',
  reason: 'bounce',
  scope: 'all',
  at: '2026-08-30T00:00:00.000Z',
  detail: 'permanent failure: mailbox does not exist for someone@example.org',
};

function input(over: Partial<MailSuppressionsSurfaceInput> = {}): MailSuppressionsSurfaceInput {
  return { entries: [ENTRY], shownCount: 1, loading: false, hasLoadError: false, ...over };
}

function snapshotOf(over: Partial<MailSuppressionsSurfaceInput> = {}): SurfaceSnapshot {
  return buildMailSuppressionsSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.id === 'mail-suppressions')!;
const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('mail suppressions surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new MailSuppressionsSurfaceRevision();
    const first = buildMailSuppressionsSurface(input(), {
      revision: tracker.next(presentedContent(input())),
      generatedAt: '2026-09-02T09:13:00.000Z',
    });
    const changed = input({ entries: [ENTRY, { ...ENTRY, address: 'other@example.org', reason: 'complaint' }], shownCount: 2 });
    const second = buildMailSuppressionsSurface(changed, {
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

  it('never emits a per-row entity — no ref, no list-row scope names an address', () => {
    const snapshot = snapshotOf();
    expect(snapshot.scopes.every((s) => !s.entities || s.entities.length === 0)).toBe(true);
    expect(snapshot.scopes.filter((s) => s.kind === 'region').length).toBe(0);
  });

  it('presents only the aggregate total and a reason breakdown', () => {
    const snapshot = snapshotOf({
      entries: [ENTRY, { ...ENTRY, address: 'x@example.org', reason: 'complaint' }],
      shownCount: 2,
    });
    expect(observation(snapshot, 'flui.mail.suppressions.total')?.presentedAs.value).toBe(2);
    expect(observation(snapshot, 'flui.mail.suppressions.reason.bounce')?.presentedAs.value).toBe(1);
    expect(observation(snapshot, 'flui.mail.suppressions.reason.complaint')?.presentedAs.value).toBe(1);
  });

  it('declares the search filter narrowing shown vs total', () => {
    const snapshot = snapshotOf({ entries: [ENTRY, { ...ENTRY, address: 'x@example.org' }], shownCount: 1 });
    expect(listScope(snapshot).completeness).toEqual({ shown: 1, total: 2, filtered: true });
  });

  it('produces an empty (not missing) list scope when nothing is suppressed', () => {
    const snapshot = snapshotOf({ entries: [], shownCount: 0 });
    expect(listScope(snapshot).state).toEqual({ loading: false, empty: true });
  });

  it('redacts: no recipient address, no bounce/complaint detail text, ever reaches the snapshot', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('someone@example.org');
    expect(json).not.toContain('mailbox does not exist');
  });
});
