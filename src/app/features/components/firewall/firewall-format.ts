import { StatusTone } from '../../../ui/primitives/status';
import { ToneLabel } from '../cluster/cluster-firewall-format';

export interface RuleLike {
  readonly description?: string;
  readonly direction: string;
  readonly protocol: string;
  readonly port?: string;
  readonly sourceIps?: readonly string[];
  readonly destinationIps?: readonly string[];
}

export type RuleChange = 'same' | 'added' | 'removed' | 'changed';

export interface RuleComparisonRow {
  readonly rule: RuleLike;
  readonly change: RuleChange;
  readonly previous?: RuleLike;
}

const COVERAGE: Record<string, ToneLabel> = {
  FULL: { tone: 'success', label: 'All nodes ready' },
  PARTIAL: { tone: 'warning', label: 'Partial coverage' },
  ORPHANED: { tone: 'error', label: 'Orphaned' },
  UNKNOWN: { tone: 'neutral', label: 'Unknown' },
};

const CLUSTER: Record<string, StatusTone> = {
  ready: 'success',
  creating: 'progress',
  scaling: 'progress',
  deleting: 'progress',
  stopped: 'warning',
  error: 'error',
  deletion_failed: 'error',
  lost: 'error',
};

const CHANGE: Record<RuleChange, ToneLabel> = {
  same: { tone: 'success', label: 'In sync' },
  added: { tone: 'warning', label: 'Added' },
  removed: { tone: 'warning', label: 'Removed' },
  changed: { tone: 'warning', label: 'Changed' },
};

export function coverageState(status: string | null | undefined): ToneLabel {
  return COVERAGE[status ?? ''] ?? COVERAGE['UNKNOWN'];
}

export function clusterState(status = 'unknown'): ToneLabel {
  const label = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  return { tone: CLUSTER[status] ?? 'neutral', label };
}

export function changeState(change: RuleChange): ToneLabel {
  return CHANGE[change];
}

export function ruleDirection(rule: RuleLike): string {
  return rule.direction === 'in' ? 'Inbound' : 'Outbound';
}

export function ruleProtocol(rule: RuleLike): string {
  return (rule.protocol ?? '').toUpperCase();
}

export function rulePort(rule: RuleLike): string {
  return rule.protocol === 'icmp' || !rule.port ? '—' : rule.port;
}

export function ruleCidrs(rule: RuleLike): string {
  const ips = rule.direction === 'in' ? rule.sourceIps : rule.destinationIps;
  return ips?.length ? ips.join(', ') : '—';
}

export function ruleSummary(rule: RuleLike): string {
  const port = rulePort(rule);
  const proto = port === '—' ? ruleProtocol(rule) : `${ruleProtocol(rule)} ${port}`;
  const cidrs = ruleCidrs(rule);
  const preposition = rule.direction === 'in' ? 'from' : 'to';
  const target = cidrs === '—' ? '' : ` ${preposition} ${cidrs}`;
  return `${ruleDirection(rule)} ${proto}${target}`;
}

function ruleKey(rule: RuleLike): string {
  return JSON.stringify([
    rule.description ?? '',
    rule.direction,
    rule.protocol,
    rule.protocol === 'icmp' ? '' : (rule.port ?? ''),
    [...(rule.sourceIps ?? [])].sort((a, b) => a.localeCompare(b)),
    [...(rule.destinationIps ?? [])].sort((a, b) => a.localeCompare(b)),
  ]);
}

export function isRuleApplied(rule: RuleLike, applied: readonly RuleLike[]): boolean {
  const key = ruleKey(rule);
  return applied.some((r) => ruleKey(r) === key);
}

export function compareRules(
  desired: readonly RuleLike[],
  applied: readonly RuleLike[],
): RuleComparisonRow[] {
  const remaining = [...applied];
  const rows: RuleComparisonRow[] = [];
  const unmatched: RuleLike[] = [];
  for (const rule of desired) {
    const key = ruleKey(rule);
    const at = remaining.findIndex((r) => ruleKey(r) === key);
    if (at >= 0) {
      remaining.splice(at, 1);
      rows.push({ rule, change: 'same' });
    } else {
      unmatched.push(rule);
    }
  }
  for (const rule of unmatched) {
    const at = remaining.findIndex((r) => !!rule.description && r.description === rule.description);
    if (at >= 0) {
      const [previous] = remaining.splice(at, 1);
      rows.push({ rule, change: 'changed', previous });
    } else {
      rows.push({ rule, change: 'added' });
    }
  }
  for (const rule of remaining) rows.push({ rule, change: 'removed' });
  return rows;
}
