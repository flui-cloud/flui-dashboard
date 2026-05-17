import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideGithub,
  lucideKey,
  lucideSettings,
  lucideServer,
  lucideCpu,
  lucideArrowLeft,
  lucideArrowRight,
  lucideLoader,
  lucideCheck,
} from '@ng-icons/lucide';
import { WizardStepperComponent, WizardStepperStep } from '../../../shared/components/wizard-stepper/wizard-stepper.component';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';
import { ApplicationService, GenerateWorkflowResult } from '../../service/application.service';
import { AppVariablesService } from '../../service/app-variables.service';
import { ClusterService } from '../../service/cluster.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { CreateApplicationDto } from '../../../core/api/model/createApplicationDto';
import { ClusterInfo } from '../../model/cluster.models';
import { ExtractEnvStepComponent } from './extract-env-step.component';
import { DeployConfigStepComponent } from './deploy-config-step.component';
import { RuntimeConfigStepComponent } from './runtime-config-step.component';
import { GenerateWorkflowStepComponent, WorkflowGenerationState } from './generate-workflow-step.component';

interface WizardStep {
  id: string;
  label: string;
  icon: string;
}

const WIZARD_STEPS: WizardStep[] = [
  { id: 'cluster',   label: 'Cluster',      icon: 'lucideServer' },
  { id: 'envvars',   label: 'Env Vars',     icon: 'lucideKey' },
  { id: 'config',    label: 'Deploy Config',icon: 'lucideSettings' },
  { id: 'runtime',   label: 'Runtime',      icon: 'lucideCpu' },
  { id: 'workflow',  label: 'Generate',     icon: 'lucideGithub' },
];

@Component({
  selector: 'app-gha-deploy-wizard',
  standalone: true,
  imports: [
    CommonModule,
    NgIcon,
    WizardStepperComponent,
    ExtractEnvStepComponent,
    DeployConfigStepComponent,
    RuntimeConfigStepComponent,
    GenerateWorkflowStepComponent,
  ],
  providers: [
    DeployWizardStateService,
    provideIcons({ lucideGithub, lucideKey, lucideSettings, lucideServer, lucideCpu, lucideArrowLeft, lucideArrowRight, lucideLoader, lucideCheck }),
  ],
  template: `
    <div class="min-h-screen bg-background flex flex-col">
      <!-- Header -->
      <div class="border-b border-border px-6 py-4">
        <div class="flex items-center gap-3">
          <button type="button" (click)="goBack()" class="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
            <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
          </button>
          <div>
            <h1 class="text-lg font-semibold">Deploy with GitHub Actions</h1>
            @if (state.repositoryId()) {
              <p class="text-sm text-muted-foreground">
                {{ state.confirmedFramework() }} · {{ state.branch() }}
              </p>
            }
          </div>
        </div>
      </div>

      <div class="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-8">
        <!-- Stepper -->
        <app-wizard-stepper [steps]="stepperSteps()" [currentStepIndex]="currentStepIndex()" />

        <!-- Step content -->
        <div class="min-h-48">
          @switch (currentStep().id) {
            @case ('cluster') {
              <div class="space-y-3">
                <p class="text-sm text-muted-foreground">Select the cluster where the application will be deployed.</p>
                @if (isLoadingClusters()) {
                  <div class="flex items-center gap-2 text-sm text-muted-foreground">
                    <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                    Loading clusters...
                  </div>
                } @else {
                  <div class="space-y-2">
                    @for (cluster of availableClusters(); track cluster.id) {
                      <button
                        type="button"
                        (click)="selectCluster(cluster)"
                        [class]="getClusterButtonClass(cluster)"
                      >
                        <div>
                          <div class="font-medium text-sm">{{ cluster.name }}</div>
                          <div class="text-xs text-muted-foreground">{{ cluster.region }} · {{ cluster.nodeCount }} node(s)</div>
                        </div>
                        @if (selectedClusterId() === cluster.id) {
                          <ng-icon name="lucideCheck" class="h-4 w-4 text-primary ml-auto" />
                        }
                      </button>
                    }
                    @if (availableClusters().length === 0) {
                      <p class="text-sm text-muted-foreground">No clusters available. Create a cluster first.</p>
                    }
                  </div>
                }
              </div>
            }
            @case ('envvars') {
              <app-extract-env-step />
            }
            @case ('config') {
              <app-deploy-config-step />
            }
            @case ('runtime') {
              <app-runtime-config-step />
            }
            @case ('workflow') {
              <app-generate-workflow-step
                [generationState]="workflowState()"
                [result]="workflowResult()"
                [errorMessage]="workflowError()"
                (confirm)="onGenerateWorkflow()"
              />
            }
          }
        </div>

        <!-- Navigation -->
        <div class="flex items-center justify-between pt-4 border-t border-border">
          <button
            type="button"
            (click)="prevStep()"
            [disabled]="currentStepIndex() === 0"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
            Back
          </button>

          @if (!isLastStep()) {
            <button
              type="button"
              (click)="nextStep()"
              [disabled]="!canProceed()"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ng-icon name="lucideArrowRight" class="h-4 w-4" />
            </button>
          }

          @if (isLastStep() && workflowState() === 'idle') {
            <!-- Generate button is rendered inside the step component -->
          }
        </div>

        @if (globalError()) {
          <p class="text-sm text-destructive">{{ globalError() }}</p>
        }
      </div>
    </div>
  `,
})
export class GhaDeployWizardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly clusterService = inject(ClusterService);
  private readonly appService = inject(ApplicationService);
  private readonly appVariablesService = inject(AppVariablesService);
  private readonly applicationsApi = inject(ApplicationsService);

  state = inject(DeployWizardStateService);

  currentStepIndex = signal(0);
  isLoadingClusters = signal(false);
  selectedClusterId = signal<string>('');
  workflowState = signal<WorkflowGenerationState>('idle');
  workflowResult = signal<GenerateWorkflowResult | null>(null);
  workflowError = signal<string | null>(null);
  globalError = signal<string | null>(null);

  readonly availableClusters = computed(() =>
    this.clusterService.clusters().filter(c => !!c.id)
  );

  readonly steps = WIZARD_STEPS;
  readonly visibleSteps = computed(() =>
    this.state.needsRuntimeConfig() ? WIZARD_STEPS : WIZARD_STEPS.filter(s => s.id !== 'runtime')
  );

  readonly currentStep = computed(() => this.visibleSteps()[this.currentStepIndex()]);
  readonly isLastStep = computed(() => this.currentStepIndex() === this.visibleSteps().length - 1);

  readonly stepperSteps = computed((): WizardStepperStep[] =>
    this.visibleSteps().map((s, i) => ({
      id: s.id,
      title: s.label,
      icon: s.icon,
      isValid: true,
      isCompleted: i < this.currentStepIndex(),
    }))
  );

  readonly canProceed = computed(() => {
    const step = this.currentStep();
    if (step.id === 'cluster') return !!this.selectedClusterId();
    return true;
  });

  ngOnInit(): void {
    void (async () => {
      // Initialize from router navigation state
      const nav = this.router.getCurrentNavigation();
      const state = nav?.extras?.state as any ?? history.state;
  
      if (state?.repositoryId && state?.branch && state?.analysisResult) {
        this.state.initialize(
          state.repositoryId,
          state.branch,
          state.analysisResult,
          state.clusterId ?? ''
        );
        if (state.clusterId) {
          this.selectedClusterId.set(state.clusterId);
          this.state.clusterId.set(state.clusterId);
        }
      }
  
      this.isLoadingClusters.set(true);
      try {
        await this.clusterService.loadClusters();
        // Auto-select if only one cluster
        const clusters = this.availableClusters();
        if (clusters.length === 1 && !this.selectedClusterId()) {
          this.selectCluster(clusters[0]);
        }
      } finally {
        this.isLoadingClusters.set(false);
      }
    })();
  }

  selectCluster(cluster: ClusterInfo): void {
    this.selectedClusterId.set(cluster.id!);
    this.state.clusterId.set(cluster.id!);
  }

  nextStep(): void {
    if (this.currentStepIndex() < this.visibleSteps().length - 1) {
      this.currentStepIndex.update(i => i + 1);
    }
  }

  prevStep(): void {
    if (this.currentStepIndex() > 0) {
      this.currentStepIndex.update(i => i - 1);
    }
  }

  goBack(): void {
    this.router.navigate(['/apps/deploy/new']);
  }

  async onGenerateWorkflow(): Promise<void> {
    this.globalError.set(null);
    this.workflowError.set(null);

    try {
      // Step 1: Create application if not yet created
      let appId = this.state.applicationId();

      if (!appId) {
        this.workflowState.set('generating');
        const config = this.state.deployConfig();
        const response = await firstValueFrom(
          this.applicationsApi.applicationsControllerCreate(this.state.clusterId(), {
            name: `${this.state.confirmedFramework()}-${this.state.branch()}`.toLowerCase().replaceAll(/[^a-z0-9-]/g, '-'),
            category: CreateApplicationDto.CategoryEnum.User,
            sourceType: CreateApplicationDto.SourceTypeEnum.GitBuild,
            sourceConfig: {
              type: 'git_build',
              repositoryId: this.state.repositoryId(),
              branch: this.state.branch(),
              framework: this.state.confirmedFramework(),
            },
            port: config.port,
            replicas: config.minReplicas,
            resourceProfile: config.resourceProfile as CreateApplicationDto.ResourceProfileEnum,
            healthProbe: {
              type: 'http',
              httpPath: config.healthcheckPath,
              httpPort: config.port,
            },
            autoDeploy: false,
          } as any)
        );
        appId = response.application.id;
        this.state.applicationId.set(appId);
      }

      // Step 2: Save env vars
      const envVars = this.state.envVars();
      if (envVars.length > 0) {
        const plain: Record<string, string> = {};
        const sensitive: Record<string, string> = {};
        for (const v of envVars) {
          if (v.value !== '') {
            if (v.isSecret) sensitive[v.key] = v.value;
            else plain[v.key] = v.value;
          }
        }
        if (Object.keys(plain).length > 0) {
          await this.appVariablesService.upsertPlain(appId, plain);
        }
        if (Object.keys(sensitive).length > 0) {
          await this.appVariablesService.upsertSensitive(appId, sensitive);
        }
      }

      // Step 3: Generate V3 workflow (Dockerfile-first, universal)
      this.workflowState.set('committing');
      const result = await this.appService.generateWorkflowV3(appId, {
        branch: this.state.branch(),
        isFluiManaged: this.state.isFluiManaged(),
      });
      this.workflowResult.set(result);

      this.workflowState.set('waiting');

      // Wait a moment then navigate to monitor
      setTimeout(() => {
        this.workflowState.set('done');
        setTimeout(() => {
          this.router.navigate(['/apps/deploy/gha-build', appId]);
        }, 1500);
      }, 2000);

    } catch (e: any) {
      this.workflowState.set('error');
      const msg = e?.message ?? 'Failed to generate workflow';
      this.workflowError.set(msg);
      this.globalError.set(msg);
    }
  }

  getClusterButtonClass(cluster: ClusterInfo): string {
    const isSelected = this.selectedClusterId() === cluster.id;
    const base = 'flex items-center w-full p-3 rounded-lg border text-left transition-colors';
    return isSelected
      ? `${base} border-primary bg-primary/5`
      : `${base} border-border hover:border-primary/50 hover:bg-accent/30`;
  }
}
