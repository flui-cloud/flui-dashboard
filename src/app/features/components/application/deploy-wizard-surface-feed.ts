import { Injectable, computed, inject } from '@angular/core';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';
import {
  DeployWizardSurfaceInput,
  DeployWizardSurfaceRevision,
  buildDeployWizardSurface,
  presentedContent,
} from './deploy-wizard-surface';
import { DeployWizardForm } from './deploy-wizard.state';

@Injectable()
export class DeployWizardSurfaceFeed {
  private readonly form = inject(DeployWizardForm);
  private readonly state = inject(DeployWizardStateService);
  private readonly revision = new DeployWizardSurfaceRevision();

  readonly surface = computed(() => {
    const f = this.form;
    const repo = f.selectedRepo();
    const template = this.state.selectedTemplate();
    const cluster = f.selectedCluster();
    const input: DeployWizardSurfaceInput = {
      currentStepId: f.currentStepId(),
      currentStepTitle: f.currentStep()?.title ?? null,
      sourceType: f.sourceType(),
      flowSubtype: f.flowSubtype(),
      selectedCluster: cluster?.id && cluster?.name ? { id: cluster.id, name: cluster.name } : null,
      selectedRepositoryFullName: repo?.fullName ?? null,
      selectedTemplate: template
        ? { framework: template.framework, displayName: template.displayName }
        : null,
    };
    const content = presentedContent(input);
    if (!content) return null;
    return buildDeployWizardSurface(input, {
      revision: this.revision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });
}
