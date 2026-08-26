import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideGithub,
  lucideLoader,
  lucideCheck,
  lucideExternalLink,
  lucideGitPullRequest,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import {
  BuildExpectation,
  GenerateWorkflowResult,
  WorkflowConsent,
} from '../../service/application.service';

export type WorkflowGenerationState = 'idle' | 'generating' | 'committing' | 'waiting' | 'done' | 'error';

@Component({
  selector: 'app-generate-workflow-step',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({
      lucideGithub,
      lucideLoader,
      lucideCheck,
      lucideExternalLink,
      lucideGitPullRequest,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="space-y-5">
      @if (generationState() === 'idle') {
        @if (consentError()) {
          <div class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {{ consentError() }}
          </div>
        } @else if (!consent()) {
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
            Reading what would be written to your repository...
          </div>
        } @else {
          @let c = consent()!;
          <div class="space-y-5">
            <div class="space-y-2">
              <p class="text-sm">
                Flui is about to write to
                <code class="font-mono text-xs bg-muted px-1 rounded">{{ c.repository }}</code>.
                Here is everything it would write, and the workflow itself in full.
              </p>
              <div
                class="flex items-start gap-2 rounded-md border p-3 text-sm"
                [class]="c.delivery === 'pull-request'
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-orange-500/30 bg-orange-500/5'"
              >
                <ng-icon
                  [name]="c.delivery === 'pull-request' ? 'lucideGitPullRequest' : 'lucideTriangleAlert'"
                  class="h-4 w-4 shrink-0 mt-0.5"
                />
                <span>{{ c.deliveryNote }}</span>
              </div>
            </div>

            <div class="space-y-2">
              <h3 class="text-sm font-medium">What gets written</h3>
              <ul class="space-y-2">
                @for (w of c.writes; track w.target) {
                  <li class="text-sm">
                    <code class="font-mono text-xs bg-muted px-1 rounded">{{ w.target }}</code>
                    <span class="block text-muted-foreground text-xs mt-0.5">{{ w.what }}</span>
                  </li>
                }
              </ul>
            </div>

            <div class="space-y-2">
              <div class="flex items-baseline justify-between gap-3">
                <h3 class="text-sm font-medium">The workflow, in full</h3>
                <span class="text-xs text-muted-foreground">{{ workflowLineCount() }} lines</span>
              </div>
              <pre
                class="max-h-96 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs font-mono whitespace-pre"
              >{{ c.workflowYaml }}</pre>
              @if (c.webhookSecretNote) {
                <p class="text-xs text-muted-foreground">{{ c.webhookSecretNote }}</p>
              }
            </div>

            <ul class="space-y-1.5 text-sm text-muted-foreground">
              @if (c.usesYourActionsMinutes) {
                <li>The build runs on GitHub-hosted runners and spends <strong>your</strong> Actions minutes.</li>
              }
              @if (!c.builtOnFluiMachines) {
                <li>Your code is never compiled on Flui machines. Flui runs the resulting image, nothing else.</li>
              }
              @if (buildExpectation(); as e) {
                <li>{{ e.note }}</li>
              }
            </ul>

            <button
              type="button"
              (click)="confirm.emit()"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <ng-icon
                [name]="c.delivery === 'pull-request' ? 'lucideGitPullRequest' : 'lucideGithub'"
                class="h-4 w-4"
              />
              {{ c.delivery === 'pull-request' ? 'Open the pull request' : 'Commit to ' + c.branch + ' and start the build' }}
            </button>
          </div>
        }
      }

      @if (['generating', 'committing', 'waiting'].includes(generationState())) {
        <div class="space-y-3">
          @for (step of progressSteps(); track step.state) {
            <div class="flex items-center gap-3 text-sm">
              @if (isStepDone(step.state)) {
                <ng-icon name="lucideCheck" class="h-4 w-4 text-green-500 shrink-0" />
              } @else if (isStepActive(step.state)) {
                <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin text-primary shrink-0" />
              } @else {
                <span class="h-4 w-4 rounded-full border border-border shrink-0 block"></span>
              }
              <span [class]="isStepActive(step.state) ? 'text-foreground' : isStepDone(step.state) ? 'text-muted-foreground' : 'text-muted-foreground/50'">
                {{ step.label }}
              </span>
            </div>
          }
        </div>
      }

      @if (generationState() === 'done' && result()) {
        @let r = result()!;
        <div class="space-y-3">
          @if (r.pullRequestUrl) {
            <div class="flex items-center gap-2 text-sm">
              <ng-icon name="lucideGitPullRequest" class="h-4 w-4 text-primary" />
              Pull request opened. Nothing is building yet.
            </div>
            <a
              [href]="r.pullRequestUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
              Review and merge it on GitHub
            </a>
            <p class="text-sm text-muted-foreground">
              The first build starts when you merge. Close the pull request and nothing happens.
            </p>
          } @else {
            <div class="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <ng-icon name="lucideCheck" class="h-4 w-4" />
              Workflow committed
            </div>
            <a
              [href]="r.workflowUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
              View workflow file on GitHub
            </a>
            <p class="text-sm text-muted-foreground">
              @if (r.runId) {
                Build started. Opening the pipeline...
              } @else {
                Waiting for GitHub Actions to register the run...
              }
            </p>
          }
        </div>
      }

      @if (generationState() === 'error') {
        <div class="text-sm text-destructive">
          {{ errorMessage() }}
        </div>
      }
    </div>
  `,
})
export class GenerateWorkflowStepComponent {
  generationState = input<WorkflowGenerationState>('idle');
  consent = input<WorkflowConsent | null>(null);
  consentError = input<string | null>(null);
  buildExpectation = input<BuildExpectation | null>(null);
  result = input<GenerateWorkflowResult | null>(null);
  errorMessage = input<string | null>(null);

  confirm = output<void>();

  readonly workflowLineCount = computed(() => {
    const yaml = this.consent()?.workflowYaml;
    return yaml ? yaml.trimEnd().split('\n').length : 0;
  });

  readonly progressSteps = computed((): { state: WorkflowGenerationState; label: string }[] => [
    { state: 'generating', label: 'Preparing the application...' },
    { state: 'committing', label: 'Writing to your repository...' },
    {
      state: 'waiting',
      label:
        this.consent()?.delivery === 'pull-request'
          ? 'Opening the pull request...'
          : 'Waiting for GitHub Actions to start the build...',
    },
  ]);

  private readonly stateOrder: WorkflowGenerationState[] = ['generating', 'committing', 'waiting', 'done'];

  isStepDone(stepState: WorkflowGenerationState): boolean {
    const currentIdx = this.stateOrder.indexOf(this.generationState());
    const stepIdx = this.stateOrder.indexOf(stepState);
    return currentIdx > stepIdx;
  }

  isStepActive(stepState: WorkflowGenerationState): boolean {
    return this.generationState() === stepState;
  }
}
