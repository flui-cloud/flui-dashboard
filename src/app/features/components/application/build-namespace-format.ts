import { StatusTone } from '../../../ui/primitives/status';
import { BuildJobInfoDto } from '../../../core/api/model/buildJobInfoDto';
import { BuildNamespaceResourcesResponseDto } from '../../../core/api/model/buildNamespaceResourcesResponseDto';
import { QueuedBuildInfoDto } from '../../../core/api/model/queuedBuildInfoDto';
import { BuildCacheInfoResponseDto } from '../../../core/api/model/buildCacheInfoResponseDto';
import { BuildCacheBreakdownResponseDto } from '../../../core/api/model/buildCacheBreakdownResponseDto';

export interface StatusView {
  readonly tone: StatusTone;
  readonly label: string;
}

export function formatAge(minutes: number): string {
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const QUEUED_LABELS: Record<QueuedBuildInfoDto['status'], string> = {
  PENDING: 'Queued',
  CLONING: 'Cloning',
  ANALYZING: 'Analyzing',
  BUILDING: 'Building',
  PUSHING: 'Pushing',
};

export function queuedStatus(status: QueuedBuildInfoDto['status']): StatusView {
  return {
    tone: status === 'PENDING' ? 'neutral' : 'progress',
    label: QUEUED_LABELS[status] ?? status,
  };
}

const PHASE_TONES: Record<string, StatusTone> = {
  Running: 'progress',
  Pending: 'neutral',
  Succeeded: 'success',
  Failed: 'error',
};

export function jobStatus(status: BuildJobInfoDto['status']): StatusView {
  return { tone: PHASE_TONES[status] ?? 'warning', label: status };
}

export function podStatus(phase: string): StatusView {
  return { tone: PHASE_TONES[phase] ?? 'warning', label: phase };
}

export function builderStatus(
  resources: BuildNamespaceResourcesResponseDto | null,
  state: { refused: boolean; error: boolean; cluster: boolean },
): StatusView {
  if (state.refused) return { tone: 'neutral', label: 'Not available' };
  if (state.error) return { tone: 'error', label: 'Unreachable' };
  if (!state.cluster) return { tone: 'neutral', label: 'No cluster selected' };
  if (!resources) return { tone: 'progress', label: 'Loading' };
  if (resources.jobs.some((j) => j.status === 'Failed' || j.status === 'Unknown')) {
    return { tone: 'warning', label: 'Failed tasks' };
  }
  if (resources.jobs.some((j) => j.status === 'Running')) {
    return { tone: 'progress', label: 'Building' };
  }
  if (resources.queuedBuilds.length > 0) return { tone: 'progress', label: 'Queued' };
  return { tone: 'success', label: 'Idle' };
}

export function cachePhaseStatus(phase: BuildCacheInfoResponseDto.PhaseEnum | null): StatusView {
  switch (phase) {
    case 'Bound':
      return { tone: 'success', label: 'Bound' };
    case 'Pending':
      return { tone: 'progress', label: 'Pending' };
    case 'Lost':
      return { tone: 'error', label: 'Lost' };
    default:
      return { tone: 'neutral', label: 'Unknown' };
  }
}

export function scanStatus(status: BuildCacheBreakdownResponseDto.ScanStatusEnum): StatusView {
  switch (status) {
    case 'ok':
      return { tone: 'success', label: 'Scanned' };
    case 'in_progress':
      return { tone: 'progress', label: 'Scanning' };
    case 'failed':
      return { tone: 'error', label: 'Scan failed' };
    case 'skipped':
      return { tone: 'warning', label: 'Scan skipped' };
    default:
      return { tone: 'neutral', label: 'Not scanned yet' };
  }
}

const UNITS: Record<string, number> = {
  '': 1,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
};

export function quantityToBytes(quantity: string | null): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*([KMGT]i?)?$/.exec((quantity ?? '').trim());
  if (!match) return null;
  const factor = UNITS[match[2] ?? ''];
  return factor ? Number(match[1]) * factor : null;
}

export function cacheUsagePercent(
  usedBytes: number | null,
  capacity: string | null,
): number | null {
  const total = quantityToBytes(capacity);
  if (usedBytes == null || !total) return null;
  return (usedBytes / total) * 100;
}
