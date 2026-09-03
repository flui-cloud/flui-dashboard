import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  FirewallClusterManagementSurfaceInput,
  FirewallClusterManagementSurfaceRevision,
  buildFirewallClusterManagementSurface,
  firewallEntityRef,
  presentedContent,
} from './firewall-cluster-management-surface';
import { FirewallExtended } from '../../model/firewall-v2.models';
import { FirewallResponseDto } from '../../../core/api/model/models';

function firewall(over: Partial<FirewallExtended> = {}): FirewallExtended {
  return {
    id: 'fw-1',
    clusterId: 'cl-1',
    desiredRules: [{ direction: 'in', protocol: 'tcp', port: '443' } as any],
    reconciliationStatus: FirewallResponseDto.ReconciliationStatusEnum.InSync,
    hasDrift: false,
    coverageStatus: FirewallResponseDto.CoverageStatusEnum.Full,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    clusterInfo: { clusterName: 'prod', clusterStatus: 'ready' as any, totalNodes: 3, readyNodes: 3, nodes: [] },
    statusBadgeColor: 'green',
    statusBadgeLabel: 'In Sync',
    driftIndicator: '',
    errorMessage: undefined,
    lastReconciliationAt: '2026-01-02T00:00:00.000Z',
    providerFirewallId: 'prov-fw-1',
    ...over,
  } as FirewallExtended;
}

function input(over: Partial<FirewallClusterManagementSurfaceInput> = {}): FirewallClusterManagementSurfaceInput {
  const list = over.firewalls ?? [firewall()];
  return {
    firewalls: list,
    totalCount: over.totalCount ?? list.length,
    isLoading: false,
    searchQuery: '',
    statusFilter: undefined,
    coverageFilter: undefined,
    ...over,
  };
}

function snapshotOf(over: Partial<FirewallClusterManagementSurfaceInput> = {}): SurfaceSnapshot {
  return buildFirewallClusterManagementSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const rowScope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === `cluster-firewalls:firewalls:${id}`)!;

describe('firewall cluster management surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('names only the page in attention — the whole card links out, there is no in-place selection', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'cluster-firewalls', reason: 'route' }]);
    expect(rowScope(snapshot, 'fw-1').entities![0].role).toBe('related');
  });

  it('uses the namespaced firewall ref for the row entity', () => {
    expect(rowScope(snapshotOf(), 'fw-1').entities![0].ref).toBe(firewallEntityRef('fw-1'));
  });

  it('presents reconciliation/coverage status, drift, rule count and node readiness', () => {
    const obs = rowScope(snapshotOf(), 'fw-1').observations!;
    expect(obs.find((o) => o.key === 'flui.firewall.reconciliation_status')?.presentedAs.text).toBe('IN_SYNC');
    expect(obs.find((o) => o.key === 'flui.firewall.coverage_status')?.presentedAs.text).toBe('FULL');
    expect(obs.find((o) => o.key === 'flui.firewall.has_drift')?.presentedAs.value).toBe(false);
    expect(obs.find((o) => o.key === 'flui.firewall.rule_count')?.presentedAs.value).toBe(1);
    expect(obs.find((o) => o.key === 'flui.firewall.ready_nodes')?.presentedAs.value).toBe(3);
    expect(obs.find((o) => o.key === 'flui.firewall.total_nodes')?.presentedAs.value).toBe(3);
  });

  it('redacts: raw errorMessage text never reaches the snapshot even when present', () => {
    const json = JSON.stringify(snapshotOf({ firewalls: [firewall({ errorMessage: 'panic: dial tcp 10.0.0.5:443: connection refused' })] }));
    expect(json).not.toContain('panic:');
    expect(json).not.toContain('connection refused');
  });

  it('never carries desiredRules structures — only their count', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('"protocol"');
    expect(json).not.toContain('"443"');
  });

  it('declares filtered when a filter narrows the visible set', () => {
    const snapshot = snapshotOf({ statusFilter: 'DRIFT' });
    expect(listScope(snapshot).completeness).toEqual({ shown: 1, total: 1, filtered: true });
  });

  it('marks loading/empty from the real signals, never inventing rows', () => {
    const loading = snapshotOf({ firewalls: [], isLoading: true });
    expect(listScope(loading).state).toEqual({ loading: true, empty: true });
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new FirewallClusterManagementSurfaceRevision();
    const first = buildFirewallClusterManagementSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-08-20T09:13:00.000Z' });
    const changed = input({ firewalls: [firewall({ hasDrift: true })] });
    const second = buildFirewallClusterManagementSurface(changed, { revision: tracker.next(presentedContent(changed)), generatedAt: '2026-08-20T09:14:00.000Z' });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  // The invalid-revision check needs a real failing case exercised, not just trusted.
  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });
});
