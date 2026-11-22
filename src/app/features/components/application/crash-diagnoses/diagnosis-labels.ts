import { StatusTone } from '../../../../ui/primitives/status';
import { CrashCategory, CrashSeverity } from '../../../model/crash-diagnosis.models';

export const SEVERITY_STATUS: Record<CrashSeverity, { tone: StatusTone; label: string }> = {
  critical: { tone: 'error', label: 'Critical' },
  warning: { tone: 'warning', label: 'Warning' },
  info: { tone: 'neutral', label: 'Info' },
};

const CATEGORY_LABELS: Record<CrashCategory, string> = {
  oom_killed: 'Out of memory',
  crash_loop: 'Crash loop',
  config_error: 'Configuration error',
  image_pull_error: 'Image pull error',
  probe_failure: 'Probe failure',
  unschedulable: 'Unschedulable',
  unknown: 'Unknown',
};

export function diagnosisCategoryLabel(category: CrashCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
