import { StatusTone } from '../../../ui/primitives/status';

export type MonitorPhase =
  'queued' | 'building' | 'build_done' | 'deploying' | 'live' | 'build_failed' | 'deploy_failed';

export interface TimelineStep {
  readonly label: string;
  readonly phase: MonitorPhase;
  readonly activePhases: readonly MonitorPhase[];
  readonly donePhases: readonly MonitorPhase[];
}

export const TIMELINE_STEPS: readonly TimelineStep[] = [
  {
    label: 'Waiting in the GitHub Actions queue',
    phase: 'queued',
    activePhases: ['queued'],
    donePhases: ['building', 'build_done', 'deploying', 'live'],
  },
  {
    label: 'Build in progress',
    phase: 'building',
    activePhases: ['building'],
    donePhases: ['build_done', 'deploying', 'live'],
  },
  {
    label: 'Image ready, starting deploy',
    phase: 'build_done',
    activePhases: ['build_done', 'deploying'],
    donePhases: ['live'],
  },
  {
    label: 'Deploying to cluster',
    phase: 'deploying',
    activePhases: ['deploying'],
    donePhases: ['live'],
  },
  {
    label: 'Application live',
    phase: 'live',
    activePhases: [],
    donePhases: ['live'],
  },
];

export const BUILD_WARNING_MS = 25 * 60 * 1000;

export function isBuildPhase(phase: MonitorPhase): boolean {
  return phase === 'queued' || phase === 'building';
}

export function isFailedPhase(phase: MonitorPhase): boolean {
  return phase === 'build_failed' || phase === 'deploy_failed';
}

type StepStatus = 'done' | 'active' | 'pending';

export function timelineStepStatus(step: TimelineStep, phase: MonitorPhase): StepStatus {
  if (step.donePhases.includes(phase)) return 'done';
  if (step.activePhases.includes(phase)) return 'active';
  return 'pending';
}

const PHASE_STATES: Record<MonitorPhase, { tone: StatusTone; label: string }> = {
  queued: { tone: 'progress', label: 'Queued' },
  building: { tone: 'progress', label: 'Building' },
  build_done: { tone: 'progress', label: 'Built' },
  deploying: { tone: 'progress', label: 'Deploying' },
  live: { tone: 'success', label: 'Live' },
  build_failed: { tone: 'error', label: 'Build failed' },
  deploy_failed: { tone: 'error', label: 'Deploy failed' },
};

const STEP_STATES: Record<StepStatus, { tone: StatusTone; label: string }> = {
  done: { tone: 'success', label: 'Completed' },
  active: { tone: 'progress', label: 'Running' },
  pending: { tone: 'neutral', label: 'Pending' },
};

export function phaseState(phase: MonitorPhase): { tone: StatusTone; label: string } {
  return PHASE_STATES[phase];
}

export function stepStatusState(status: StepStatus): { tone: StatusTone; label: string } {
  return STEP_STATES[status];
}

export function elapsedSince(startIso: string | undefined, now: number): number | null {
  if (!startIso) return null;
  const startMs = new Date(startIso).getTime();
  if (Number.isNaN(startMs)) return null;
  const elapsedMs = now - startMs;
  return elapsedMs < 0 ? null : elapsedMs;
}

export function formatElapsed(elapsedMs: number): string {
  const totalSec = Math.floor(elapsedMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}
