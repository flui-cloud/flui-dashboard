import { Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RepositoryService } from '../../service/repository.service';
import { TemplateService } from '../../service/template.service';
import { CatalogService } from '../../service/catalog.service';
import { PlatformVersionService } from '../../service/platform-version.service';
import { DeployWizardStateService, FlowSubtype } from '../../service/deploy-wizard-state.service';
import { TemplateResponseDto } from '../../../core/api/model/templateResponseDto';
import { DeployWizardForm } from './deploy-wizard.state';
import { DeployWizardEnv } from './deploy-wizard-env';
import { DeployWizardRepository } from './deploy-wizard-repository';
import { DeployWizardImage } from './deploy-wizard-image';
import { DeployWizardCluster } from './deploy-wizard-cluster';

type SelectableFlow = 'image' | 'template' | 'existing-repo' | 'marketplace';

@Injectable()
export class DeployWizardNavigation {
  private readonly form = inject(DeployWizardForm);
  private readonly env = inject(DeployWizardEnv);
  private readonly repo = inject(DeployWizardRepository);
  private readonly image = inject(DeployWizardImage);
  private readonly cluster = inject(DeployWizardCluster);
  private readonly state = inject(DeployWizardStateService);
  private readonly repoService = inject(RepositoryService);
  private readonly templateService = inject(TemplateService);
  private readonly catalog = inject(CatalogService);
  private readonly platformVersion = inject(PlatformVersionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  bootstrap(): void {
    void this.platformVersion.load();
    void (async () => {
      this.cluster.loadClusters();
      this.image.loadProfiles();
      this.repo.loadRepositories();
      this.loadTemplates();

      await this.refreshOAuthStatus();
      await this.applyQueryParams();
    })();
  }

  private async refreshOAuthStatus(): Promise<boolean> {
    try {
      await this.repoService.checkOAuthStatus();
      return true;
    } catch {
      return false;
    }
  }

  private async applyQueryParams(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const templateFw = params.get('template');
    const repoId = params.get('repoId');
    const catalogSlug = params.get('catalogSlug');
    const autoConnectTo = params.get('autoConnectTo');

    if (catalogSlug) {
      this.selectFlow('marketplace');
      const detail = await this.catalog.loadDetail(catalogSlug);
      if (detail) {
        this.state.initializeFromCatalog(detail);
        if (autoConnectTo) {
          this.state.pendingLinkedInstallId.set(autoConnectTo);
          this.state.linkedInstallIdPreset.set(true);
        }
        this.form.currentStepIndex.set(1);
      }
    } else if (templateFw) {
      this.selectFlow('template');
      await this.loadTemplates();
      const tpl = this.form.templates().find((t) => t.framework === templateFw);
      if (tpl) {
        this.state.selectedTemplate.set(tpl);
        this.advanceToTemplateSettings();
      } else {
        this.form.currentStepIndex.set(1);
      }
    } else if (repoId) {
      this.selectFlow('existing-repo');
      await this.repo.loadRepositories();
      const repo = this.form.connectedRepos().find((r) => r.id === repoId);
      if (repo) {
        this.repo.selectRepository(repo);
        this.form.currentStepIndex.set(1);
        this.repo.loadBranches().then(() => this.repo.triggerManifestCheck());
      }
    }
  }

  async loadTemplates(): Promise<void> {
    if (this.form.templates().length > 0) return;
    this.form.isLoadingTemplates.set(true);
    try {
      await this.templateService.loadTemplates();
    } catch {
      return;
    } finally {
      this.form.isLoadingTemplates.set(false);
    }
  }

  nextStep(): void {
    const f = this.form;
    if (!f.canProceed()) return;

    const nextIndex = f.currentStepIndex() + 1;
    const nextStepId = f.steps()[nextIndex]?.id;
    const sub = f.flowSubtype();

    this.handleAnalysisStepEntry(nextStepId, sub);
    this.handleClusterStepEntryFlowC(nextStepId, sub);
    this.handleEnvironmentStepEntry(nextStepId, sub);
    this.handleReviewStepEntry(nextStepId, sub);
    this.handleClusterSelectionSync();

    f.currentStepIndex.set(Math.min(nextIndex, f.steps().length - 1));
  }

  private handleAnalysisStepEntry(nextStepId: string | undefined, sub: FlowSubtype): void {
    if (nextStepId === 'analysis' && sub === 'existing-repo') {
      this.repo.loadBranches().then(() => this.repo.triggerManifestCheck());
    }
  }

  private handleClusterStepEntryFlowC(nextStepId: string | undefined, sub: FlowSubtype): void {
    if (nextStepId !== 'cluster' || sub !== 'existing-repo') return;
    this.repo.syncManifestIntoState();
  }

  private handleEnvironmentStepEntry(nextStepId: string | undefined, sub: FlowSubtype): void {
    if (
      nextStepId === 'environment' &&
      sub === 'existing-repo' &&
      (this.form.selectedRepo() || this.form.selectedPublicRepo())
    ) {
      const manifestHasEnv = this.env.prefillEnvVarsFromManifest();
      if (!manifestHasEnv) {
        this.repo.loadBranches().then(() => this.env.analyzeAndSuggestEnvVars());
      }
    }

    if (nextStepId === 'environment' && sub === 'image') {
      this.image.inspectImagePorts();
    }
  }

  private handleReviewStepEntry(nextStepId: string | undefined, sub: FlowSubtype): void {
    if (nextStepId !== 'review') return;

    const clusterId = this.form.selectedCluster()?.id;
    if (!clusterId) return;

    if (sub === 'existing-repo') {
      this.repo.runManifestChecks(clusterId);
    }

    if (sub !== 'marketplace') {
      this.cluster.checkResourceAvailabilityForCluster(clusterId);
      return;
    }

    this.state.checkCatalogResourceAvailability(clusterId);
    this.state.refreshMasterPlacementRelevance(clusterId);
  }

  private handleClusterSelectionSync(): void {
    const f = this.form;
    if (f.currentStep().id !== 'cluster' || !f.selectedCluster()?.id) return;

    const clusterId = f.selectedCluster()!.id!;
    this.state.clusterId.set(clusterId);
    this.state.fetchClusterCapabilities(clusterId);
    if (f.flowSubtype() !== 'marketplace') return;

    const slug = this.state.catalogSlug();
    if (slug) {
      this.catalog.loadDetail(slug, clusterId).then((detail) => {
        if (detail) this.state.catalogDetail.set(detail);
      });
    }
    if (this.state.needsLinkedBbPicker()) {
      this.state.loadReusableInstances(clusterId);
    }
    if (this.state.needsDependencyPicker()) {
      this.state.loadDependencyInstances(clusterId);
    }
  }

  previousStep(): void {
    this.form.currentStepIndex.set(Math.max(this.form.currentStepIndex() - 1, 0));
  }

  goToConfigStep(): void {
    const configIdx = this.form.steps().findIndex((s) => s.id === 'environment');
    if (configIdx >= 0) this.form.currentStepIndex.set(configIdx);
  }

  editStep(stepId: string): void {
    const index = this.form.steps().findIndex((s) => s.id === stepId);
    if (index >= 0 && index < this.form.currentStepIndex()) this.form.currentStepIndex.set(index);
  }

  selectFlow(sub: SelectableFlow): void {
    const f = this.form;
    this.state.flowSubtype.set(sub);
    if (sub === 'image') {
      this.state.sourceType.set('docker_image');
      f.sourceType.set('docker_image');
    } else if (sub === 'marketplace') {
      this.state.sourceType.set(null);
      f.sourceType.set(null);
    } else {
      this.state.sourceType.set('git_build');
      f.sourceType.set('git_build');
    }

    f.selectedImageRef.set('');
    f.selectedRepo.set(null);
    f.selectedPublicRepo.set(null);
    f.manifestsForSelector.set(null);
    f.selectedManifestPath.set(null);
    f.manifestFetchError.set(null);
    f.manifestProblem.set(null);
    f.branchesProblem.set(null);

    if (sub === 'template') {
      this.loadTemplates();
    }
  }

  selectTemplate(template: TemplateResponseDto): void {
    this.state.initializeFromTemplate(template, this.form.selectedCluster()?.id ?? '');
    if (!this.state.newRepoName()) {
      this.state.newRepoName.set(`${template.framework}-app`.replaceAll(/[^a-zA-Z0-9._-]/g, '-'));
    }
  }

  private advanceToTemplateSettings(): void {
    this.state.initializeFromTemplate(
      this.state.selectedTemplate()!,
      this.form.selectedCluster()?.id ?? '',
    );
    this.form.currentStepIndex.set(2);
  }

  switchToTemplateFlow(): void {
    this.state.resetFlowState();
    this.selectFlow('template');
    this.form.currentStepIndex.set(1);
  }

  navigateBack(): void {
    this.router.navigate(['/apps/applications']);
  }

  navigateToRepositories(): void {
    this.router.navigate(['/apps/repositories']);
  }

  navigateToCluster(): void {
    this.router.navigate(['/cluster/create']);
  }

  navigateToClusterDns(): void {
    const id = this.state.clusterId();
    if (!id) return;
    this.router.navigate(['/infrastructure/domains/internal-hosting'], {
      queryParams: { clusterId: id },
    });
  }

  navigateToAuthProxy(): void {
    const id = this.state.clusterId();
    this.router.navigate(['/settings'], {
      queryParams: id ? { clusterId: id } : {},
      fragment: 'auth-proxy',
    });
  }

  navigateToTemplates(): void {
    this.router.navigate(['/apps/templates']);
  }
}
