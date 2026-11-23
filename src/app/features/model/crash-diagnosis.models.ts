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

/** `resources` carries a change Flui applies when accepted; `auto` only appears on diagnoses from before that. */
export type SuggestedActionType = 'user_input' | 'redeploy' | 'manual' | 'resources' | 'auto';

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
