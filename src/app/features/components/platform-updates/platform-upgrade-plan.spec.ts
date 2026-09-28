import {
  PlatformUpdateOperation,
  PlatformUpgradePlan,
} from '../../service/platform-update.service';
import {
  canApplyPlan,
  k3sNodeRows,
  planBlockers,
} from './platform-upgrade-plan';

const plan = (
  blockers: PlatformUpgradePlan['blockers'],
): PlatformUpgradePlan => ({
  planId: 'p1',
  fromVersion: '0.19.0',
  targetVersion: '0.20.0',
  bootstrapRef: 'abc',
  k3sVersion: 'v1.36.1+k3s1',
  migrations: 1,
  phases: [],
  advisories: [],
  blockers,
  applicable: blockers.every((b) => b.overridable),
  acknowledgement: 'Without a backup, a database migration cannot be undone.',
});

describe('the upgrade plan as the dashboard presents it', () => {
  it('lets a plan with no blocker be applied', () => {
    expect(canApplyPlan(plan([]), { withoutBackup: false })).toBeTrue();
  });

  it('needs the box ticked when the only blocker is a missing backup', () => {
    const p = plan([
      { phase: 'backup', message: 'No backup.', overridable: true },
    ]);
    expect(canApplyPlan(p, { withoutBackup: false })).toBeFalse();
    expect(canApplyPlan(p, { withoutBackup: true })).toBeTrue();
    expect(planBlockers(p).soft).toHaveSize(1);
  });

  it('refuses a plan with a hard blocker whatever is ticked', () => {
    const p = plan([{ phase: 'k3s', message: 'Node not Ready.' }]);
    expect(canApplyPlan(p, { withoutBackup: true })).toBeFalse();
    expect(planBlockers(p).hard.map((b) => b.message)).toEqual([
      'Node not Ready.',
    ]);
  });

  it('lists every node K3s touches, per cluster, in the order the phase runs them', () => {
    const op = {
      phases: [
        {
          key: 'k3s',
          title: 'Upgrade K3s',
          status: 'running',
          clusters: [
            {
              clusterId: 'w1',
              clusterName: 'work-1',
              clusterType: 'workload',
              status: 'done',
              nodes: [
                {
                  name: 'w1-a',
                  role: 'server',
                  fromVersion: 'v1',
                  version: 'v2',
                  status: 'done',
                },
              ],
            },
            {
              clusterId: 'ctl',
              clusterName: 'control',
              clusterType: 'control',
              status: 'running',
              nodes: [
                {
                  name: 'c-a',
                  role: 'server',
                  fromVersion: 'v1',
                  version: 'v1',
                  status: 'upgrading',
                },
              ],
            },
          ],
        },
      ],
    } as unknown as PlatformUpdateOperation;
    expect(k3sNodeRows(op).map((r) => [r.cluster, r.node, r.status])).toEqual([
      ['work-1', 'w1-a', 'done'],
      ['control', 'c-a', 'upgrading'],
    ]);
  });

  it('has no K3s rows for an image-only update', () => {
    expect(
      k3sNodeRows({ components: [] } as unknown as PlatformUpdateOperation),
    ).toEqual([]);
  });
});
