import { StatusTone } from '../../../ui/primitives/status';
import { DeploymentProgress, DeploymentStep } from '../../model/application.models';

export interface DeployStepDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly progress: number;
}

export const DEPLOY_STEPS: readonly DeployStepDefinition[] = [
  {
    id: 'app_deploy_init',
    name: 'Initialization',
    description: 'Preparing deployment configuration',
    progress: 0,
  },
  {
    id: 'app_deploy_generate_manifests',
    name: 'Generate manifests',
    description: 'Generating deployment manifests',
    progress: 15,
  },
  {
    id: 'app_deploy_apply_manifests',
    name: 'Apply manifests',
    description: 'Applying manifests to the cluster',
    progress: 30,
  },
  {
    id: 'app_deploy_wait_ready',
    name: 'Wait for instances',
    description: 'Waiting for instances to be ready',
    progress: 60,
  },
  {
    id: 'app_deploy_finalize',
    name: 'Finalize',
    description: 'Finalizing and saving revision',
    progress: 90,
  },
];

type DeploymentStatus = DeploymentProgress['status'];
type StepStatus = DeploymentStep['status'];

export function mapDeploymentStatus(apiStatus: string): DeploymentStatus {
  if (apiStatus === 'COMPLETED' || apiStatus === 'completed') return 'completed';
  if (apiStatus === 'FAILED' || apiStatus === 'failed') return 'failed';
  if (apiStatus === 'IN_PROGRESS' || apiStatus === 'in_progress') return 'in_progress';
  return 'pending';
}

export function pendingDeploySteps(): DeploymentStep[] {
  return DEPLOY_STEPS.map((s) => ({ ...s, status: 'pending' as const }));
}

function stepStatusAt(
  index: number,
  currentIdx: number,
  allDone: boolean,
  errorMsg?: string,
): StepStatus {
  if (allDone || index < currentIdx) return 'completed';
  if (index === currentIdx) return errorMsg ? 'error' : 'running';
  return 'pending';
}

export function buildDeploySteps(
  previous: readonly DeploymentStep[],
  currentStepId: string,
  percentage: number,
  errorMsg: string | undefined,
  now: Date,
): DeploymentStep[] {
  const allDone = percentage >= 100 && !errorMsg;
  const currentIdx = DEPLOY_STEPS.findIndex((s) => s.id === currentStepId);
  return DEPLOY_STEPS.map((s, i) => {
    const status = stepStatusAt(i, currentIdx, allDone, errorMsg);
    const prev = previous.find((p) => p.id === s.id);
    const startedAt = prev?.startedAt ?? (status === 'running' ? now : undefined);
    const finished = status === 'completed' || status === 'error';
    const completedAt = finished && startedAt ? (prev?.completedAt ?? now) : undefined;
    return {
      ...s,
      status,
      startedAt,
      completedAt,
      errorMessage: i === currentIdx ? errorMsg : undefined,
    };
  });
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(seconds % 60).padStart(2, '0');
  return `${minutes}m ${remainingSeconds}s`;
}

export function secondsBetween(start: Date | undefined, end: Date | number): number | null {
  if (!start) return null;
  const endMs = typeof end === 'number' ? end : end.getTime();
  return Math.max(0, Math.floor((endMs - new Date(start).getTime()) / 1000));
}

export function stepElapsed(step: DeploymentStep, now: number): string {
  const seconds = secondsBetween(step.startedAt, step.completedAt ?? now);
  return seconds === null ? '' : formatDuration(seconds);
}

const DEPLOYMENT_STATES: Record<DeploymentStatus, { tone: StatusTone; label: string }> = {
  pending: { tone: 'neutral', label: 'Pending' },
  in_progress: { tone: 'progress', label: 'Deploying' },
  completed: { tone: 'success', label: 'Deployed' },
  failed: { tone: 'error', label: 'Failed' },
};

const STEP_STATES: Record<StepStatus, { tone: StatusTone; label: string }> = {
  pending: { tone: 'neutral', label: 'Pending' },
  running: { tone: 'progress', label: 'Running' },
  completed: { tone: 'success', label: 'Completed' },
  error: { tone: 'error', label: 'Failed' },
};

export function deploymentState(status: DeploymentStatus): { tone: StatusTone; label: string } {
  return DEPLOYMENT_STATES[status];
}

export function stepState(status: StepStatus): { tone: StatusTone; label: string } {
  return STEP_STATES[status];
}
