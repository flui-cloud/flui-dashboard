import { AppMetricsDto } from '../../../core/api/model/appMetricsDto';
import { PlacementVerdict } from '../../service/app-runtime.service';
import { AlertTone } from '../../../ui/patterns/alert';

export type ResourceKind = 'cpu' | 'memory';

export interface ResourceUsage {
  readonly percent: number | null;
  readonly amount: string;
}

export interface ResourceHint {
  readonly tone: AlertTone;
  readonly title: string;
  readonly body: string;
}

function formatCores(cores: number): string {
  if (cores >= 1) return `${cores.toFixed(2)} cores`;
  return `${(cores * 1000).toFixed(0)}m`;
}

function formatBytes(b: number): string {
  if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MiB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KiB`;
  return `${b.toFixed(0)} B`;
}

export function usageOf(m: AppMetricsDto, kind: ResourceKind): ResourceUsage {
  const used = (kind === 'cpu' ? m.cpu.usage_cores : m.memory.usage_bytes) ?? 0;
  const limit = (kind === 'cpu' ? m.cpu.limits_cores : m.memory.limits_bytes) ?? 0;
  return {
    percent: limit > 0 ? (used / limit) * 100 : null,
    amount: kind === 'cpu' ? formatCores(used) : formatBytes(used),
  };
}

export function resourceHint(percent: number, kind: ResourceKind): ResourceHint | null {
  const name = kind === 'cpu' ? 'CPU' : 'Memory';
  if (percent >= 90) {
    return {
      tone: 'error',
      title: `${name} almost at its maximum`,
      body: kind === 'cpu' ? 'Risk of throttling.' : 'Risk of an out-of-memory kill.',
    };
  }
  if (percent >= 70) {
    return {
      tone: 'warning',
      title: `${name} at ${percent.toFixed(0)}% of its maximum`,
      body: 'Consider raising the maximum.',
    };
  }
  if (percent > 0 && percent < 15) {
    return {
      tone: 'info',
      title: `${name} maximum well above use`,
      body: 'Consider lowering it.',
    };
  }
  return null;
}

export function verdictTone(verdict: PlacementVerdict): AlertTone {
  if (verdict === 'fits' || verdict === 'buys' || verdict === 'proposes') return 'info';
  return 'warning';
}
