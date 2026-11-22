import { StatusTone } from '../../../ui/primitives/status';
import { AppBuildResponseDto } from '../../../core/api/model/appBuildResponseDto';
import { DeploymentStep } from '../../model/application.models';

export type BuildPhase = AppBuildResponseDto['status'];

export type BuildPagePhase = 'building' | 'confirm' | 'deploying' | 'completed' | 'failed';

type StepStatus = DeploymentStep['status'];

interface BuildPhaseDefinition {
  readonly id: BuildPhase;
  readonly name: string;
  readonly description: string;
}

export const BUILD_PHASES: readonly BuildPhaseDefinition[] = [
  { id: 'CLONING', name: 'Clone repository', description: 'Fetching the source code' },
  { id: 'ANALYZING', name: 'Detect framework', description: 'Reading the build plan' },
  { id: 'BUILDING', name: 'Build image', description: 'Building the container image' },
  { id: 'PUSHING', name: 'Push to registry', description: 'Uploading the image' },
];

const PHASE_ORDER: readonly BuildPhase[] = [
  'PENDING',
  'CLONING',
  'ANALYZING',
  'BUILDING',
  'PUSHING',
  'COMPLETED',
];

const STATUS_LABELS: Record<BuildPhase, string> = {
  PENDING: 'Queued',
  CLONING: 'Cloning',
  ANALYZING: 'Analyzing',
  BUILDING: 'Building',
  PUSHING: 'Pushing',
  COMPLETED: 'Built',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

function phaseIndex(status: BuildPhase): number {
  return PHASE_ORDER.indexOf(status);
}

function isTerminalBuild(status: string): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
}

function phaseStatus(phase: BuildPhase, status: BuildPhase): StepStatus {
  if (status === 'FAILED') return 'error';
  if (phaseIndex(status) > phaseIndex(phase)) return 'completed';
  if (status === phase) return 'running';
  return 'pending';
}

export function buildPhaseSteps(
  status: BuildPhase,
  descriptions: Partial<Record<BuildPhase, string | null>> = {},
): DeploymentStep[] {
  return BUILD_PHASES.map((phase) => ({
    id: phase.id,
    name: phase.name,
    description: descriptions[phase.id] || phase.description,
    status: phaseStatus(phase.id, status),
  }));
}

export function trackStepTimes(
  previous: readonly DeploymentStep[] | undefined,
  steps: readonly DeploymentStep[],
  now: Date,
): DeploymentStep[] {
  return steps.map((step) => {
    if (step.status === 'pending') return step;
    const prev = previous?.find((p) => p.id === step.id);
    const startedAt = prev?.startedAt ?? (step.status === 'running' ? now : undefined);
    const finished = step.status === 'completed' || step.status === 'error';
    const completedAt = finished && startedAt ? (prev?.completedAt ?? now) : undefined;
    return { ...step, startedAt, completedAt };
  });
}

export function buildProgressPercent(status: BuildPhase): number {
  const order = Math.max(0, phaseIndex(status));
  return Math.round((order / (PHASE_ORDER.length - 1)) * 100);
}

export function phasesFromLog(current: BuildPhase, line: string): BuildPhase[] {
  if (isTerminalBuild(current)) return [];
  const l = line.toLowerCase();
  const matches: BuildPhase[] = [];
  const early = current === 'PENDING' || current === 'CLONING';
  if (early && (l.includes('railpack') || l.includes('detected ') || l.includes('deploying as'))) {
    matches.push('ANALYZING');
  }
  if (
    (early || current === 'ANALYZING') &&
    (l.includes('railpack build') ||
      l.includes('buildctl') ||
      l.includes('#1 ') ||
      l.includes('load build definition'))
  ) {
    matches.push('BUILDING');
  }
  if (
    current === 'BUILDING' &&
    (l.includes('pushing') || l.includes('exporting') || l.includes('writing image'))
  ) {
    matches.push('PUSHING');
  }
  return matches;
}

export function buildPageState(
  phase: BuildPagePhase,
  status: BuildPhase,
): { tone: StatusTone; label: string } {
  switch (phase) {
    case 'building':
      return { tone: status === 'PENDING' ? 'neutral' : 'progress', label: STATUS_LABELS[status] };
    case 'confirm':
      return { tone: 'success', label: 'Built' };
    case 'deploying':
      return { tone: 'progress', label: 'Deploying' };
    case 'completed':
      return { tone: 'success', label: 'Running' };
    case 'failed':
      return status === 'CANCELLED'
        ? { tone: 'neutral', label: 'Cancelled' }
        : { tone: 'error', label: 'Failed' };
  }
}

export function shortId(id: string): string {
  return id.length > 12 ? `${id.substring(0, 12)}…` : id;
}
