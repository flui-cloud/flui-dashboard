import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideGithub,
  lucideLoader,
  lucideCheck,
  lucideExternalLink,
} from '@ng-icons/lucide';
import { GenerateWorkflowResult } from '../../service/application.service';

export type WorkflowGenerationState = 'idle' | 'generating' | 'committing' | 'waiting' | 'done' | 'error';

@Component({
  selector: 'app-generate-workflow-step',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({ lucideGithub, lucideLoader, lucideCheck, lucideExternalLink }),
  ],
  template: `
    <div class="space-y-5">
      <!-- Summary before confirming -->
      @if (generationState() === 'idle') {
        <div class="space-y-3">
          <p class="text-sm text-muted-foreground">
            Flui will generate a GitHub Actions workflow and Dockerfile, commit them to your repository, and trigger the first build.
          </p>
          <ul class="space-y-2 text-sm">
            <li class="flex items-center gap-2">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></span>
              <span>A <code class="font-mono text-xs bg-muted px-1 rounded">.github/workflows/flui-build.yml</code> file will be created</span>
            </li>
            <li class="flex items-center gap-2">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></span>
              <span>A <code class="font-mono text-xs bg-muted px-1 rounded">Dockerfile</code> will be created (or updated if it has <code class="font-mono text-xs bg-muted px-1 rounded">#flui-managed</code>)</span>
            </li>
            <li class="flex items-center gap-2">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></span>
              <span>Environment variables are NOT included in the workflow</span>
            </li>
          </ul>

          <button
            type="button"
            (click)="confirm.emit()"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <ng-icon name="lucideGithub" class="h-4 w-4" />
            Commit workflow and start build
          </button>
        </div>
      }

      <!-- In-progress states -->
      @if (['generating', 'committing', 'waiting'].includes(generationState())) {
        <div class="space-y-3">
          @for (step of progressSteps; track step.state) {
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

      <!-- Done state -->
      @if (generationState() === 'done' && result()) {
        @let r = result()!;
        <div class="space-y-3">
          <div class="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <ng-icon name="lucideCheck" class="h-4 w-4" />
            Workflow committed successfully
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
              Build started. Redirecting to monitoring...
            } @else {
              Waiting for GitHub Actions to register the run...
            }
          </p>
        </div>
      }

      <!-- Error state -->
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
  result = input<GenerateWorkflowResult | null>(null);
  errorMessage = input<string | null>(null);

  confirm = output<void>();

  readonly progressSteps: { state: WorkflowGenerationState; label: string }[] = [
    { state: 'generating', label: 'Generating workflow...' },
    { state: 'committing', label: 'Committing to repository...' },
    { state: 'waiting', label: 'Waiting for GitHub Actions to start the build...' },
  ];

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
