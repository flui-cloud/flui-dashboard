import { Component, input, computed } from '@angular/core';
import { AppEndpointStatus, AppEndpointPhase } from './dns-setup-wizard.service';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

interface PhaseStep {
  phase: AppEndpointPhase;
  label: string;
}

const BASE_PHASES: PhaseStep[] = [
  { phase: 'creating-endpoint', label: 'Create endpoint' },
  { phase: 'checking-dns', label: 'Verify DNS' },
  { phase: 'reconciling', label: 'Reconcile ingress' },
  { phase: 'issuing-cert', label: 'Issue staging certificate' },
  { phase: 'upgrading-to-prod', label: 'Upgrade to production certificate' },
  { phase: 'issuing-prod-cert', label: 'Issue production certificate' },
];

const PHASES_BY_SLUG: Record<string, PhaseStep[]> = {
  'flui-api': [
    ...BASE_PHASES,
    { phase: 'syncing-api', label: 'Sync API config' },
    { phase: 'rollout-api', label: 'Rollout' },
  ],
  'flui-web': [
    ...BASE_PHASES,
    { phase: 'syncing-web', label: 'Sync web config' },
    { phase: 'rollout-web', label: 'Rollout' },
  ],
  zitadel: [
    ...BASE_PHASES,
    { phase: 'syncing-auth', label: 'Sync auth domain' },
    { phase: 'rollout-auth', label: 'Rollout' },
  ],
};

const PHASE_ORDER: AppEndpointPhase[] = [
  'creating-endpoint',
  'checking-dns',
  'reconciling',
  'issuing-cert',
  'upgrading-to-prod',
  'issuing-prod-cert',
  'syncing-auth',
  'rollout-auth',
  'syncing-api',
  'rollout-api',
  'syncing-web',
  'rollout-web',
];

function phaseIndex(p: AppEndpointPhase): number {
  return PHASE_ORDER.indexOf(p);
}

type StepStatus = 'pending' | 'running' | 'done' | 'error';

const STEP_TONES: Record<StepStatus, StatusTone> = {
  pending: 'neutral',
  running: 'progress',
  done: 'success',
  error: 'error',
};

@Component({
  selector: 'app-dns-wizard-endpoint-phases',
  imports: [FlStatus],
  template: `
    <ol class="m-0 flex list-none flex-col gap-1 p-0">
      @for (step of steps(); track step.phase) {
        @let st = stepStatus(step.phase);
        <li>
          <fl-status [tone]="stepTone(st)" [label]="stepLabel(step, st)" />
        </li>
      }
    </ol>
  `,
})
export class DnsWizardEndpointPhasesComponent {
  readonly app = input.required<AppEndpointStatus>();

  protected steps = computed(() => PHASES_BY_SLUG[this.app().key] ?? BASE_PHASES);

  protected stepStatus(phase: AppEndpointPhase): StepStatus {
    const current = this.app().phase;
    if (current === 'error') {
      const currentIdx = phaseIndex(this.lastActivePhase());
      const phaseIdx = phaseIndex(phase);
      if (phaseIdx < currentIdx) return 'done';
      if (phaseIdx === currentIdx) return 'error';
      return 'pending';
    }
    if (current === 'done' || current === 'idle') {
      return current === 'done' ? 'done' : 'pending';
    }
    const currentIdx = phaseIndex(current);
    const phaseIdx = phaseIndex(phase);
    if (phaseIdx < currentIdx) return 'done';
    if (phaseIdx === currentIdx) return 'running';
    return 'pending';
  }

  private lastActivePhase(): AppEndpointPhase {
    const steps = PHASES_BY_SLUG[this.app().key] ?? BASE_PHASES;
    return steps.at(-1)!.phase;
  }

  protected stepTone(status: StepStatus): StatusTone {
    return STEP_TONES[status];
  }

  protected stepLabel(step: PhaseStep, status: StepStatus): string {
    const progress = this.app().rolloutProgress;
    if (this.isRolloutPhase(step.phase) && status === 'running' && progress !== null) {
      return `${step.label} (${progress}%)`;
    }
    return step.label;
  }

  protected isRolloutPhase(phase: AppEndpointPhase): boolean {
    return phase === 'rollout-auth' || phase === 'rollout-api' || phase === 'rollout-web';
  }
}
