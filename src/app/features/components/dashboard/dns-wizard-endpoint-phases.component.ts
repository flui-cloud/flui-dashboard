import { Component, input, computed } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideCheckCircle, lucideLoader, lucideCircleX } from '@ng-icons/lucide';
import { AppEndpointStatus, AppEndpointPhase } from './dns-setup-wizard.service';

interface PhaseStep {
  phase: AppEndpointPhase;
  label: string;
}

const BASE_PHASES: PhaseStep[] = [
  { phase: 'creating-endpoint', label: 'Create endpoint' },
  { phase: 'checking-dns',      label: 'Verify DNS' },
  { phase: 'reconciling',       label: 'Reconcile ingress' },
  { phase: 'issuing-cert',      label: 'Issue staging certificate' },
  { phase: 'upgrading-to-prod', label: 'Upgrade to production certificate' },
  { phase: 'issuing-prod-cert', label: 'Issue production certificate' },
];

const PHASES_BY_SLUG: Record<string, PhaseStep[]> = {
  'flui-api': [
    ...BASE_PHASES,
    { phase: 'syncing-api',  label: 'Sync API config' },
    { phase: 'rollout-api',  label: 'Rollout' },
  ],
  'flui-web': [
    ...BASE_PHASES,
    { phase: 'syncing-web',  label: 'Sync web config' },
    { phase: 'rollout-web',  label: 'Rollout' },
  ],
  'zitadel': [
    ...BASE_PHASES,
    { phase: 'syncing-auth', label: 'Sync auth domain' },
    { phase: 'rollout-auth', label: 'Rollout' },
  ],
};

const PHASE_ORDER: AppEndpointPhase[] = [
  'creating-endpoint', 'checking-dns', 'reconciling', 'issuing-cert',
  'upgrading-to-prod', 'issuing-prod-cert',
  'syncing-auth', 'rollout-auth',
  'syncing-api', 'rollout-api',
  'syncing-web', 'rollout-web',
];

function phaseIndex(p: AppEndpointPhase): number {
  return PHASE_ORDER.indexOf(p);
}

@Component({
  selector: 'app-dns-wizard-endpoint-phases',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideCheckCircle, lucideLoader, lucideCircleX })],
  template: `
    <div class="mt-1.5 ml-6 flex flex-col gap-0.5">
      @for (step of steps(); track step.phase) {
        @let st = stepStatus(step.phase);
        <div class="flex items-center gap-1.5">
          @if (st === 'done') {
            <ng-icon name="lucideCheckCircle" class="h-3 w-3 text-emerald-500 flex-shrink-0" />
          } @else if (st === 'running') {
            <ng-icon name="lucideLoader" class="h-3 w-3 text-primary animate-spin flex-shrink-0" />
          } @else if (st === 'error') {
            <ng-icon name="lucideCircleX" class="h-3 w-3 text-destructive flex-shrink-0" />
          } @else {
            <div class="h-3 w-3 flex items-center justify-center flex-shrink-0">
              <div class="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"></div>
            </div>
          }
          <span
            class="text-xs"
            [class.text-foreground]="st === 'running' || st === 'done'"
            [class.text-muted-foreground]="st === 'pending'"
            [class.text-destructive]="st === 'error'"
          >
            {{ step.label }}
            @if (isRolloutPhase(step.phase) && st === 'running' && app().rolloutProgress !== null) {
              <span class="text-muted-foreground ml-1">({{ app().rolloutProgress }}%)</span>
            }
          </span>
        </div>
      }
    </div>
  `,
})
export class DnsWizardEndpointPhasesComponent {
  readonly app = input.required<AppEndpointStatus>();

  protected steps = computed(() => PHASES_BY_SLUG[this.app().key] ?? BASE_PHASES);

  protected stepStatus(phase: AppEndpointPhase): 'pending' | 'running' | 'done' | 'error' {
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
    // Find the last step that has been reached (before error)
    // We can approximate by the current certStatus / errorMessage
    // Just return the current phase in the sequence
    return steps.at(-1)!.phase;
  }

  protected isRolloutPhase(phase: AppEndpointPhase): boolean {
    return phase === 'rollout-auth' || phase === 'rollout-api' || phase === 'rollout-web';
  }
}
