import { Injectable, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { CreateApplicationDto } from '../../../core/api/model/createApplicationDto';
import { InstallPromptService } from '../../../core/services/install-prompt.service';
import { internalHostingErrorMessage } from '../../model/app-exposure';
import { OrchestrationStepView } from './deploy-step-generate';
import { DeployWizardForm } from './deploy-wizard.state';
import { DeployWizardEnv } from './deploy-wizard-env';
import { DeployWizardImage } from './deploy-wizard-image';
import { DeployWizardReview } from './deploy-wizard-review';

@Injectable()
export class DeployWizardDeploy {
  private readonly form = inject(DeployWizardForm);
  private readonly env = inject(DeployWizardEnv);
  private readonly image = inject(DeployWizardImage);
  private readonly review = inject(DeployWizardReview);
  private readonly state = inject(DeployWizardStateService);
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly installPrompt = inject(InstallPromptService);
  private readonly router = inject(Router);

  readonly orchestrationSteps = computed(() => {
    if (this.form.flowSubtype() === 'template') {
      return [
        { id: 'creating-repo', label: 'Creating GitHub repository from template' },
        { id: 'registering-repo', label: 'Registering repository with Flui' },
        { id: 'creating-app', label: 'Creating Flui application' },
        { id: 'generating-workflow', label: 'Committing build workflow to repository' },
      ] as const;
    }
    return [
      { id: 'creating-app', label: 'Submitting flui.yaml manifest & committing build workflow' },
    ] as const;
  });

  readonly orchestrationView = computed<OrchestrationStepView[]>(() =>
    this.orchestrationSteps().map((step) => {
      let state: OrchestrationStepView['state'] = 'pending';
      if (this.isOrchestrationStepDone(step.id)) state = 'done';
      else if (this.isOrchestrationStepActive(step.id)) state = 'active';
      return { id: step.id, label: step.label, state };
    }),
  );

  isOrchestrationStepDone(id: string): boolean {
    const order: string[] = this.orchestrationSteps().map((s) => s.id);
    const phase = this.state.orchestrationPhase();
    if (phase === 'done') return true;
    const currentIdx = order.indexOf(phase);
    const stepIdx = order.indexOf(id);
    if (currentIdx === -1) return false;
    return stepIdx < currentIdx;
  }

  isOrchestrationStepActive(id: string): boolean {
    return this.state.orchestrationPhase() === id;
  }

  async deployApplication(): Promise<void> {
    if (this.installPrompt.requireInstall()) return;
    if (!this.form.canComplete() || !this.form.canDeploy()) return;

    const cluster = this.form.selectedCluster();
    if (!cluster?.id) return;

    const sub = this.form.flowSubtype();

    if (sub === 'image') return this.deployImageFlow(cluster.id);
    if (sub === 'template') return this.deployTemplateFlow(cluster.id);
    if (sub === 'existing-repo') return this.deployExistingRepoFlow(cluster.id);
    if (sub === 'marketplace') return this.deployMarketplaceFlow(cluster.id);
  }

  private async deployImageFlow(clusterId: string): Promise<void> {
    const f = this.form;
    f.isDeploying.set(true);
    f.deployError.set(null);
    try {
      const envVars = this.env.buildEnvVarsList();
      if (envVars === null) return;

      const response = await firstValueFrom(
        this.applicationsApi.applicationsControllerCreate(clusterId, {
          name: this.review.getApplicationName(),
          projectId: this.state.projectId() ?? undefined,
          category: CreateApplicationDto.CategoryEnum.User,
          kind: f.selectedKind() as CreateApplicationDto.KindEnum,
          sourceType: CreateApplicationDto.SourceTypeEnum.DockerImage,
          sourceConfig: {
            imageRef: f.selectedImageRef(),
            pullPolicy: 'IfNotPresent',
          },
          port: f.appPort() ?? undefined,
          replicas: f.appReplicas(),
          ...(f.appAutoscale() && f.appMaxReplicas() > f.appReplicas()
            ? {
                scaling: {
                  enabled: true,
                  minReplicas: f.appReplicas(),
                  maxReplicas: f.appMaxReplicas(),
                },
              }
            : {}),
          resourceProfile: f.selectedProfile() as CreateApplicationDto.ResourceProfileEnum,
          exposure: this.state.exposureMode(),
          env: envVars.map((v) => ({ name: v.key, value: v.value, secret: v.isSecret })),
          autoDeploy: true,
          healthProbe: this.image.buildHealthProbe(),
        } as any),
      );

      if (response.operation?.id) {
        this.router.navigate(['/apps/deploy', response.operation.id], {
          queryParams: { appId: response.application.id },
        });
      } else {
        this.router.navigate(['/apps/applications', response.application.id]);
      }
    } catch (error) {
      console.error('Failed to start deployment:', error);
      const msg = internalHostingErrorMessage(error);
      f.deployError.set(msg ?? 'Failed to start deployment. Check logs for details.');
    } finally {
      f.isDeploying.set(false);
    }
  }

  private async deployTemplateFlow(clusterId: string): Promise<void> {
    await this.runOrchestration(clusterId, async () => {
      const appId = await this.state.orchestrateTemplateFlow();
      return appId && !this.state.workflowPullRequestUrl() ? appId : null;
    });
  }

  private async deployExistingRepoFlow(clusterId: string): Promise<void> {
    await this.runOrchestration(clusterId, () => this.state.orchestrateExistingRepoFlow());
  }

  private async runOrchestration(
    clusterId: string,
    orchestrate: () => Promise<string | null | undefined>,
  ): Promise<void> {
    const f = this.form;
    f.isDeploying.set(true);
    f.deployError.set(null);
    try {
      this.state.clusterId.set(clusterId);
      this.state.envVars.set(
        f.envVars().map((v) => ({ key: v.key, value: v.value, isSecret: v.isSecret })),
      );

      const appId = await orchestrate();
      if (appId) {
        setTimeout(() => {
          this.router.navigate(['/apps/deploy/gha-build', appId]);
        }, 1200);
      }
    } catch (error) {
      const msg = internalHostingErrorMessage(error);
      if (msg) f.deployError.set(msg);
    } finally {
      f.isDeploying.set(false);
    }
  }

  private async deployMarketplaceFlow(clusterId: string): Promise<void> {
    this.form.isDeploying.set(true);
    try {
      this.state.clusterId.set(clusterId);
      await this.state.orchestrateMarketplaceFlow();
    } finally {
      this.form.isDeploying.set(false);
    }
  }

  async retryMarketplaceConnect(): Promise<void> {
    this.form.isDeploying.set(true);
    try {
      await this.state.retryMarketplaceConnect();
    } finally {
      this.form.isDeploying.set(false);
    }
  }
}
