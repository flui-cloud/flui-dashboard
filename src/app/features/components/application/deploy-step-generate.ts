import { Component, computed, input, output } from '@angular/core';
import {
  MarketplaceInstallPhase,
  TemplateOrchestrationPhase,
} from '../../service/deploy-wizard-state.service';
import { CatalogInstallStepProgress } from '../../service/catalog.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { CatalogSuccessStepComponent } from './deploy-wizard-catalog-steps/catalog-success-step.component';

export type OrchestrationStepState = 'done' | 'active' | 'pending';

export interface OrchestrationStepView {
  readonly id: string;
  readonly label: string;
  readonly state: OrchestrationStepState;
}

const STEP_TONE: Record<OrchestrationStepState, StatusTone> = {
  done: 'success',
  active: 'progress',
  pending: 'neutral',
};

@Component({
  selector: 'app-deploy-step-generate',
  imports: [FlAlert, FlUsageBar, FlButton, FlStatus, CatalogSuccessStepComponent],
  host: { class: 'fl-stack' },
  template: `
    @if (marketplace()) {
      @switch (installPhase()) {
        @case ('idle') {
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            Ready to install <span class="font-medium text-fl-ink">{{ appName() }}</span>. Select
            Install to start.
          </p>
        }
        @case ('failed') {
          @if (installConnected()) {
            <fl-alert tone="error" title="Connect failed">
              <span class="block">{{ installError() }}</span>
              <span class="mt-1 block">
                The app is installed but not connected. Retry the connection without reinstalling.
              </span>
              <button alertActions flButton size="sm" type="button" (click)="retryConnect.emit()">
                Retry connect
              </button>
            </fl-alert>
          } @else {
            <fl-alert tone="error" title="Install failed">
              {{ installError() }}
              <button alertActions flButton size="sm" type="button" (click)="retry.emit()">
                Retry
              </button>
            </fl-alert>
          }
        }
        @case ('running') {
          <app-catalog-success-step />
        }
        @default {
          <fl-status tone="progress" [label]="progress()?.stepLabel ?? 'Starting install'" />
          <fl-usage-bar
            label="Install progress"
            [percent]="progress()?.overallProgress ?? 0"
            [aside]="stepCount()"
            [warnAt]="101"
            [criticalAt]="101"
          />
        }
      }
    } @else {
      @switch (orchestrationPhase()) {
        @case ('idle') {
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            Ready to deploy. Select Deploy to start.
          </p>
        }
        @case ('error') {
          <fl-alert tone="error" title="Deployment failed">
            {{ orchestrationError() }}
            <button alertActions flButton size="sm" type="button" (click)="retry.emit()">
              Retry
            </button>
          </fl-alert>
        }
        @default {
          <ol class="m-0 flex list-none flex-col gap-3 p-0">
            @for (step of steps(); track step.id) {
              <li><fl-status [tone]="tone[step.state]" [label]="step.label" /></li>
            }
          </ol>
          @if (pullRequestUrl(); as prUrl) {
            <fl-alert tone="info" title="The workflow was proposed, not pushed">
              Nothing is building yet. The first build starts when you merge the pull request.
              <a
                alertActions
                flButton
                size="sm"
                [href]="prUrl"
                target="_blank"
                rel="noopener noreferrer"
                >Review the pull request on GitHub</a
              >
            </fl-alert>
          }
        }
      }
    }
  `,
})
export class DeployStepGenerate {
  readonly marketplace = input(false);
  readonly appName = input<string | null | undefined>(null);
  readonly installPhase = input<MarketplaceInstallPhase>('idle');
  readonly installConnected = input(false);
  readonly installError = input<string | null>(null);
  readonly progress = input<CatalogInstallStepProgress | null>(null);
  readonly orchestrationPhase = input<TemplateOrchestrationPhase>('idle');
  readonly orchestrationError = input<string | null>(null);
  readonly steps = input<readonly OrchestrationStepView[]>([]);
  readonly pullRequestUrl = input<string | null>(null);
  readonly retry = output<void>();
  readonly retryConnect = output<void>();
  protected readonly tone = STEP_TONE;
  protected readonly stepCount = computed(() => {
    const p = this.progress();
    return p?.totalSteps ? `Step ${p.stepIndex + 1} of ${p.totalSteps}` : undefined;
  });
}
