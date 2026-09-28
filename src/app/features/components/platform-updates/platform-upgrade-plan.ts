import {
  PlatformUpdateOperation,
  PlatformUpgradeBlocker,
  PlatformUpgradePlan,
} from '../../service/platform-update.service';

export function planBlockers(plan: PlatformUpgradePlan): {
  hard: PlatformUpgradeBlocker[];
  soft: PlatformUpgradeBlocker[];
} {
  return {
    hard: plan.blockers.filter((b) => !b.overridable),
    soft: plan.blockers.filter((b) => b.overridable),
  };
}

/** A missing backup is passed only by ticking the acknowledgement; nothing else is. */
export function canApplyPlan(
  plan: PlatformUpgradePlan,
  choice: { withoutBackup: boolean },
): boolean {
  const { hard, soft } = planBlockers(plan);
  if (hard.length > 0) return false;
  return soft.length === 0 || choice.withoutBackup;
}

export interface K3sNodeRow {
  cluster: string;
  clusterType: string;
  step: string | null;
  node: string;
  role: string;
  version: string | null;
  status: string;
  message?: string;
}

export function k3sNodeRows(operation: PlatformUpdateOperation): K3sNodeRow[] {
  const phase = operation.phases?.find((p) => p.key === 'k3s');
  const rows: K3sNodeRow[] = [];
  for (const cluster of phase?.clusters ?? []) {
    const steps = cluster.steps ?? [];
    const step = steps.length
      ? steps[Math.min(cluster.stepIndex ?? 0, steps.length - 1)]
      : null;
    for (const node of cluster.nodes ?? []) {
      rows.push({
        cluster: cluster.clusterName,
        clusterType: cluster.clusterType,
        step,
        node: node.name,
        role: node.role,
        version: node.version,
        status: node.status,
        message: node.message,
      });
    }
  }
  return rows;
}
