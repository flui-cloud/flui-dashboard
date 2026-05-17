// ===== TYPES =====
// Il backend non tipizza le risposte nello spec OpenAPI (ritornano `any`),
// quindi definiamo qui le shape come da docs/SCALING_PHASE_1_2_API.md.

export type CrashCategory =
  | 'oom_killed'
  | 'crash_loop'
  | 'config_error'
  | 'image_pull_error'
  | 'probe_failure'
  | 'unschedulable'
  | 'unknown';

export type CrashSeverity = 'critical' | 'warning' | 'info';

export type SuggestedActionType = 'user_input' | 'redeploy' | 'manual' | 'auto';

export interface CrashEvidenceEvent {
  type: string;
  reason: string;
  message: string;
  count: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
}

export interface CrashEvidence {
  events?: CrashEvidenceEvent[];
  logsSnippet?: string;
  exitCode?: number;
  lastTerminationReason?: string;
  missingResource?: { kind: 'Secret' | 'ConfigMap'; name: string };
  missingEnvVar?: string;
  metric?: { name: string; value: number };
}

export interface SuggestedAction {
  type: SuggestedActionType;
  message: string;
  payload?: Record<string, unknown>;
}

export interface AutoFixActionPayload {
  autoFix: true;
  previousMemoryLimit: string;
  newMemoryLimit: string;
}

/**
 * Realtime WebSocket event published by the Actuator when it applies an
 * automatic remediation to a crashing application (phase 3).
 */
export interface AutoRemediationPayload {
  appId: string;
  diagnosisId: string;
  reason: 'OOMKilled';
  action: 'memory-limit-increase';
  previousMemoryLimit: string;
  newMemoryLimit: string;
  timestamp: string;
}

export interface CrashDiagnosis {
  id: string;
  applicationId: string;
  podName: string;
  containerName: string | null;
  category: CrashCategory;
  severity: CrashSeverity;
  title: string;
  explanation: string;
  evidence: CrashEvidence;
  patternMatchedKey: string | null;
  suggestedAction: SuggestedAction;
  resolvedAt: string | null;
  createdAt: string;
}

// ===== HELPERS =====

export function isUnresolved(d: CrashDiagnosis): boolean {
  return d.resolvedAt === null;
}

export function isAutoRemediated(d: CrashDiagnosis): boolean {
  return d.suggestedAction?.type === 'auto';
}

export function autoFixPayload(d: CrashDiagnosis): AutoFixActionPayload | null {
  const p = d.suggestedAction?.payload as AutoFixActionPayload | undefined;
  if (!p?.autoFix) return null;
  return p;
}

export function isRecent(d: CrashDiagnosis, minutes = 30): boolean {
  const created = new Date(d.createdAt).getTime();
  return Date.now() - created < minutes * 60_000;
}

export function severityBadgeClass(s: CrashSeverity): string {
  const base = 'text-xs px-2 py-0.5 rounded font-medium';
  switch (s) {
    case 'critical':
      return `${base} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
    case 'warning':
      return `${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`;
    default:
      return `${base} bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300`;
  }
}

export function severityBannerClass(s: CrashSeverity): string {
  switch (s) {
    case 'critical':
      return 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400';
    case 'warning':
      return 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-400';
    default:
      return 'bg-gray-50 dark:bg-gray-900/10 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-400';
  }
}

export function categoryIcon(c: CrashCategory): string {
  const map: Record<CrashCategory, string> = {
    oom_killed: 'lucideMemoryStick',
    crash_loop: 'lucideRefreshCw',
    config_error: 'lucideSettings',
    image_pull_error: 'lucideImageOff',
    probe_failure: 'lucideActivity',
    unschedulable: 'lucideCalendarX',
    unknown: 'lucideCircleHelp',
  };
  return map[c] ?? 'lucideCircleAlert';
}

export function categoryLabel(c: CrashCategory): string {
  const map: Record<CrashCategory, string> = {
    oom_killed: 'OOM Killed',
    crash_loop: 'Crash Loop',
    config_error: 'Config Error',
    image_pull_error: 'Image Pull Error',
    probe_failure: 'Probe Failure',
    unschedulable: 'Unschedulable',
    unknown: 'Unknown',
  };
  return map[c] ?? c;
}
