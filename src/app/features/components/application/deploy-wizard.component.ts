import { Component, OnInit, OnDestroy, inject, effect, untracked } from '@angular/core';
import { RepositoryService } from '../../service/repository.service';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';
import { CatalogService } from '../../service/catalog.service';
import { AuthzInstallService } from '../../service/authz-install.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlWizardSteps } from '../../../ui/patterns/wizard-steps';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { DEPLOY_WIZARD_PROVIDERS, DEPLOY_WIZARD_STEP_COMPONENTS } from './deploy-wizard.providers';
import { DeployWizardForm } from './deploy-wizard.state';
import { DeployWizardEnv } from './deploy-wizard-env';
import { DeployWizardRepository } from './deploy-wizard-repository';
import { DeployWizardImage } from './deploy-wizard-image';
import { DeployWizardCluster } from './deploy-wizard-cluster';
import { DeployWizardReview } from './deploy-wizard-review';
import { DeployWizardDeploy } from './deploy-wizard-deploy';
import { DeployWizardNavigation } from './deploy-wizard-navigation';
import { DeployWizardSurfaceFeed } from './deploy-wizard-surface-feed';

@Component({
  selector: 'app-deploy-wizard',
  imports: [
    FlPageHeader,
    FlPanel,
    FlWizardSteps,
    FlButton,
    FlSpinner,
    DEPLOY_WIZARD_STEP_COMPONENTS,
  ],
  providers: DEPLOY_WIZARD_PROVIDERS,
  template: `
    <div class="fl-page">
      <fl-page-header title="Deploy an application" [breadcrumb]="breadcrumb">
        <span headerMeta>Pick a source and a cluster, review the settings, then deploy.</span>
      </fl-page-header>

      <div class="fl-wizard">
        <nav aria-label="Steps">
          <fl-wizard-steps [steps]="form.wizardSteps()" [current]="form.currentStepIndex()" />
        </nav>

        <fl-panel [title]="form.currentStep()?.title" [flush]="true">
          <div class="p-4">
            @switch (form.currentStepId()) {
              @case ('source') {
                <app-deploy-step-source
                  [flow]="form.flowSubtype()"
                  (flowSelect)="nav.selectFlow($event)"
                  (openTemplates)="nav.navigateToTemplates()"
                />
              }

              @case ('template-picker') {
                <app-deploy-step-template-picker
                  [templates]="form.templates()"
                  [loading]="form.isLoadingTemplates()"
                  [selected]="state.selectedTemplate()?.framework ?? null"
                  (templateSelect)="nav.selectTemplate($event)"
                />
              }

              @case ('template-settings') {
                <app-deploy-step-template-settings
                  [template]="state.selectedTemplate()"
                  [hasRepoScope]="repoService.hasRepoScope()"
                  [repoName]="state.newRepoName()"
                  [repoOwner]="state.newRepoOwner()"
                  [isPrivate]="state.newRepoPrivate()"
                  [nameError]="form.templateNameError()"
                  (repoNameChange)="state.newRepoName.set($event)"
                  (repoOwnerChange)="state.newRepoOwner.set($event)"
                  (privateChange)="state.newRepoPrivate.set($event)"
                  (connectGithub)="nav.navigateToRepositories()"
                />
              }

              @case ('docker_image') {
                <app-deploy-step-docker-image
                  [imageRef]="form.selectedImageRef()"
                  [kind]="form.selectedKind()"
                  [kindOptions]="form.kindOptions"
                  (imageSelected)="image.onImageSelected($event)"
                  (clear)="image.clearImageRef()"
                  (kindChange)="image.setKind($event)"
                />
              }

              @case ('repository') {
                <app-deploy-step-repository
                  [tab]="form.repoTab()"
                  [loading]="form.isLoadingRepos()"
                  [repos]="form.connectedRepos()"
                  [selectedId]="form.selectedRepo()?.id ?? null"
                  [publicRepo]="form.selectedPublicRepo()"
                  (tabChange)="form.repoTab.set($event)"
                  (repoSelect)="repo.selectRepository($event)"
                  (publicRepoSelect)="repo.onPublicRepoSelected($event)"
                  (clearPublic)="repo.clearPublicRepo()"
                  (connectRepos)="nav.navigateToRepositories()"
                />
              }

              @case ('analysis') {
                <app-deploy-step-analysis
                  [state]="form.analysisBranch()"
                  [manifest]="form.manifestForSelector()?.manifest"
                  [valid]="form.validManifests()"
                  [invalid]="form.invalidManifests()"
                  [selectedPath]="form.selectedManifestPath()"
                  [branch]="form.selectedBranch()"
                  [repoId]="form.selectedRepo()?.id ?? null"
                  [fetchError]="form.manifestFetchError()"
                  [agentPrompt]="repo.manifestAgentPrompt()"
                  [promptCopied]="repo.manifestPromptCopied()"
                  (download)="repo.downloadManifest()"
                  (manifestSelect)="repo.selectManifest($event)"
                  (retry)="repo.triggerManifestCheck()"
                  (copyPrompt)="repo.copyManifestPrompt()"
                />
              }

              @case ('generate') {
                <app-deploy-step-generate
                  [marketplace]="form.flowSubtype() === 'marketplace'"
                  [appName]="state.catalogDetail()?.name"
                  [installPhase]="state.installPhase()"
                  [installConnected]="!!state.currentInstall()"
                  [installError]="state.installError()"
                  [progress]="catalog.installProgress()"
                  [orchestrationPhase]="state.orchestrationPhase()"
                  [orchestrationError]="state.orchestrationError()"
                  [steps]="deploy.orchestrationView()"
                  [pullRequestUrl]="state.workflowPullRequestUrl()"
                  (retry)="deploy.deployApplication()"
                  (retryConnect)="deploy.retryMarketplaceConnect()"
                />
              }
              @case ('environment') {
                <div class="fl-stack">
                  <app-deploy-step-environment
                    [flow]="form.flowSubtype()"
                    [isImage]="form.sourceType() === 'docker_image'"
                    [newRepo]="
                      (state.newRepoOwner() || '(your account)') + '/' + state.newRepoName()
                    "
                    [loadingBranches]="form.isLoadingBranches()"
                    [branches]="form.availableBranches()"
                    [branch]="form.selectedBranch()"
                    [branchesFailed]="form.branchesFailed()"
                    [port]="form.appPort()"
                    [portDiscovering]="form.portDiscovering()"
                    [portAutoDetected]="form.portAutoDetected()"
                    [exposedPorts]="form.exposedPorts()"
                    [replicas]="form.appReplicas()"
                    [autoscale]="form.appAutoscale()"
                    [maxReplicas]="form.appMaxReplicas()"
                    [loadingProfiles]="form.loadingProfiles()"
                    [profiles]="form.availableProfiles()"
                    [selectedProfile]="form.selectedProfile()"
                    (branchChange)="repo.selectBranch($event)"
                    (portChange)="form.appPort.set($event); form.portAutoDetected.set(false)"
                    (replicasChange)="form.appReplicas.set($event)"
                    (autoscaleChange)="form.appAutoscale.set($event)"
                    (maxReplicasChange)="form.appMaxReplicas.set($event)"
                    (profileChange)="form.selectedProfile.set($event)"
                  />
                  @if (form.sourceType() === 'docker_image') {
                    <app-deploy-env-health-check
                      [type]="form.probeType()"
                      [path]="form.probeHttpPath()"
                      [initialDelay]="form.probeInitialDelay()"
                      [period]="form.probePeriod()"
                      [failureThreshold]="form.probeFailureThreshold()"
                      [port]="form.appPort()"
                      [expanded]="form.probeExpanded()"
                      (typeChange)="form.probeType.set($event)"
                      (pathChange)="form.probeHttpPath.set($event)"
                      (initialDelayChange)="form.probeInitialDelay.set($event)"
                      (periodChange)="form.probePeriod.set($event)"
                      (failureThresholdChange)="form.probeFailureThreshold.set($event)"
                      (expandedChange)="form.probeExpanded.set($event)"
                    />
                  }
                  @if (form.flowSubtype() === 'existing-repo') {
                    <app-env-suggestions-panel
                      [loading]="form.envDetectionLoading()"
                      [result]="form.envDetectionResult()"
                      [error]="form.envDetectionError()"
                      [selectedIndex]="form.selectedCandidateIndex()"
                      (cancelDetection)="env.cancelEnvDetection()"
                      (candidateSelected)="env.applyDetectedVars($event)"
                      (reanalyze)="env.analyzeAndSuggestEnvVars()"
                    />
                  }
                  <app-deploy-env-vars
                    [mode]="form.envMode()"
                    [vars]="form.envVars()"
                    [rawJson]="form.rawEnvJson()"
                    [jsonError]="form.jsonError()"
                    [meta]="form.detectedVarMeta()"
                    [unreviewedDefaults]="env.hasUnreviewedDefaults()"
                    (modeChange)="env.setEnvMode($event)"
                    (add)="env.addEnvVar()"
                    (remove)="env.removeEnvVar($event)"
                    (keyChange)="env.updateEnvKey($event.index, $event.value)"
                    (valueChange)="env.updateEnvValue($event.index, $event.value)"
                    (toggleSecret)="env.toggleEnvSecret($event)"
                    (rawJsonChange)="env.updateRawEnvJson($event)"
                  />
                </div>
              }

              @case ('cluster') {
                <app-deploy-step-cluster
                  [loading]="form.isLoadingClusters()"
                  [clusters]="form.activeClusters()"
                  [selectedId]="form.selectedCluster()?.id ?? null"
                  [projectId]="state.projectId()"
                  [showCapacity]="!!form.selectedCluster() && form.flowSubtype() !== 'marketplace'"
                  [checking]="form.checkingAvailability()"
                  [availability]="form.resourceAvailability()"
                  [availabilityMessage]="clusters.getAvailabilityMessage()"
                  [showExposure]="clusters.showExposure()"
                  [exposureMode]="state.exposureMode()"
                  [capabilitiesLoading]="catalog.capabilitiesLoading()"
                  [canUseInternal]="state.canUseInternalExposure()"
                  [internalMissingLabel]="clusters.internalHostingMissingLabel()"
                  [showOverrides]="
                    form.flowSubtype() === 'existing-repo' && !!state.manifestResult()?.manifest
                  "
                  [overrideName]="state.overrideName()"
                  [overrideFqdn]="state.overrideFqdn()"
                  [declaredName]="state.manifestResult()?.manifest?.metadata.name ?? ''"
                  [nameChanged]="repo.installNameChanged()"
                  (clusterSelect)="clusters.selectCluster($event)"
                  (projectChange)="state.projectId.set($event)"
                  (createCluster)="nav.navigateToCluster()"
                  (smallerProfile)="nav.goToConfigStep()"
                  (exposureChange)="state.exposureMode.set($event)"
                  (configureDns)="nav.navigateToClusterDns()"
                  (overrideNameChange)="state.overrideName.set($event)"
                  (overrideFqdnChange)="state.overrideFqdn.set($event)"
                >
                  @if (form.selectedCluster() && form.flowSubtype() === 'marketplace') {
                    <app-catalog-resources-review />
                    <app-catalog-udp-ports-notice />
                  }
                </app-deploy-step-cluster>
              }

              @case ('catalog-overview') {
                <app-catalog-overview-step />
              }

              @case ('catalog-inputs') {
                <app-catalog-inputs-step />
              }

              @case ('catalog-config') {
                <app-catalog-config-step />
              }

              @case ('catalog-features') {
                <app-catalog-features-step />
              }

              @case ('catalog-domain') {
                <app-catalog-domain-step />
              }

              @case ('catalog-linked-bb') {
                <app-catalog-linked-bb-step />
              }

              @case ('catalog-dependencies') {
                <app-catalog-dependencies-step />
              }

              @case ('review') {
                <app-deploy-step-review
                  [blockedReason]="clusters.canDeployReason()"
                  [authzNotReady]="clusters.authzNotReady()"
                  [authzInstalling]="authzInstall.installing()"
                  [authzError]="authzInstall.error()"
                  [error]="form.deployError() || state.orchestrationError()"
                  [flow]="form.flowSubtype()"
                  [checksLoading]="form.manifestChecksLoading()"
                  [checksError]="form.manifestChecksError()"
                  [checks]="form.manifestChecks()"
                  [envCount]="env.getEnvVarsCount()"
                  [secretCount]="env.getSecretVarsCount()"
                  [catalogInputs]="review.getCatalogInputsCount()"
                  [catalogOverrides]="review.getCatalogOverridesCount()"
                  [catalogSecrets]="review.getCatalogSecretsCount()"
                  [inputsStep]="
                    form.stepIds().includes('catalog-inputs') ? 'catalog-inputs' : 'catalog-config'
                  "
                  [cluster]="form.selectedCluster()"
                  [checking]="form.checkingAvailability()"
                  [availability]="form.resourceAvailability()"
                  [availabilityMessage]="clusters.getAvailabilityMessage()"
                  [appName]="review.getApplicationName()"
                  [roomWait]="clusters.roomWaitAhead()"
                  [editable]="form.stepIds()"
                  (edit)="nav.editStep($event)"
                  (configureDns)="nav.navigateToClusterDns()"
                  (installAuthProxy)="clusters.installAuthProxy()"
                  (authProxySettings)="nav.navigateToAuthProxy()"
                  (smallerProfile)="nav.goToConfigStep()"
                >
                  <ng-container ngProjectAs="[reviewSource]">
                    @if (
                      form.sourceType() !== 'docker_image' && form.flowSubtype() === 'marketplace'
                    ) {
                      <app-deploy-review-marketplace
                        [detail]="state.catalogDetail()"
                        [displayName]="state.catalogDisplayName()"
                        [authLabel]="
                          state.catalogHasAuthChoice() ? review.catalogAuthModeLabel() : null
                        "
                        [showFeatures]="state.catalogFeatureOptions().length > 0"
                        [featureLabels]="review.enabledFeatureLabels()"
                        [linkedRefs]="state.linkedBbRefs()"
                        [linkedInstance]="state.selectedReusableInstance()"
                        [internalDeploy]="form.isInternalDeploy()"
                        [internalUrl]="review.internalUrlPreview()"
                        [domainMode]="state.domainMode()"
                        [autoFqdn]="review.autoFqdnPreview()"
                        [requestedDomain]="state.requestedDomain()"
                        [tls]="state.enableTls()"
                        [masterRelevant]="state.allowMasterPlacementRelevant()"
                        [masterAllowed]="state.allowMasterPlacement()"
                        [editable]="form.stepIds()"
                        (edit)="nav.editStep($event)"
                        (masterAllowedChange)="state.allowMasterPlacement.set($event)"
                      />
                    } @else {
                      <app-deploy-review-source
                        [kind]="
                          form.sourceType() === 'docker_image'
                            ? 'image'
                            : form.flowSubtype() === 'template'
                              ? 'template'
                              : 'repo'
                        "
                        [imageRef]="form.selectedImageRef()"
                        [port]="form.appPort()"
                        [replicas]="form.appReplicas()"
                        [profile]="form.selectedProfileInfo()"
                        [probeType]="form.probeType()"
                        [probePath]="form.probeHttpPath()"
                        [templateName]="
                          (state.selectedTemplate()?.displayName ?? '') +
                          ' ' +
                          (state.selectedTemplate()?.version ?? '')
                        "
                        [newRepo]="
                          (state.newRepoOwner() || '(your account)') + '/' + state.newRepoName()
                        "
                        [repoPrivate]="state.newRepoPrivate()"
                        [config]="state.deployConfig()"
                        [repoName]="
                          form.selectedRepo()?.name ?? form.selectedPublicRepo()?.full_name ?? ''
                        "
                        [branch]="form.selectedBranch()"
                        [defaultsSource]="state.defaultsSource()"
                        [manifestName]="
                          state.manifestResult()?.valid
                            ? (state.manifestResult()?.manifest?.metadata.name ?? null)
                            : null
                        "
                        [framework]="state.confirmedFramework()"
                        [internal]="state.exposureMode() === 'internal'"
                        [internalUrl]="review.internalUrlPreview()"
                        [editable]="form.stepIds()"
                        (edit)="nav.editStep($event)"
                      />
                    }
                  </ng-container>
                  @if (form.flowSubtype() === 'marketplace') {
                    <app-catalog-resources-review />
                    <app-catalog-udp-ports-notice />
                  }
                </app-deploy-step-review>
              }
            }
          </div>

          <div class="fl-wizard__footer border-t border-fl-border px-4 py-3">
            <button flButton="ghost" type="button" (click)="nav.navigateBack()">Cancel</button>
            <button
              flButton
              type="button"
              [disabled]="form.currentStepIndex() === 0"
              (click)="nav.previousStep()"
            >
              Previous
            </button>
            @if (form.currentStepIndex() < form.steps().length - 1 || form.steps().length === 1) {
              <button
                flButton="primary"
                type="button"
                [disabled]="!form.canProceed()"
                (click)="nav.nextStep()"
              >
                Next
              </button>
            } @else if (
              !(form.flowSubtype() === 'marketplace' && state.installPhase() === 'running')
            ) {
              <button
                flButton="primary"
                type="button"
                [disabled]="!form.canComplete() || form.isDeploying() || !form.canDeploy()"
                [attr.title]="clusters.canDeployReason()"
                (click)="deploy.deployApplication()"
              >
                @if (form.isDeploying()) {
                  <fl-spinner
                    [label]="form.flowSubtype() === 'marketplace' ? 'Installing' : 'Deploying'"
                  />
                  {{ form.flowSubtype() === 'marketplace' ? 'Installing…' : 'Deploying…' }}
                } @else {
                  {{ form.flowSubtype() === 'marketplace' ? 'Install' : 'Deploy' }}
                }
              </button>
            }
          </div>
        </fl-panel>
      </div>
    </div>
  `,
})
export class DeployWizardComponent implements OnInit, OnDestroy {
  readonly state = inject(DeployWizardStateService);
  readonly repoService = inject(RepositoryService);
  readonly catalog = inject(CatalogService);
  protected readonly authzInstall = inject(AuthzInstallService);
  protected readonly form = inject(DeployWizardForm);
  protected readonly env = inject(DeployWizardEnv);
  protected readonly repo = inject(DeployWizardRepository);
  protected readonly image = inject(DeployWizardImage);
  protected readonly clusters = inject(DeployWizardCluster);
  protected readonly review = inject(DeployWizardReview);
  protected readonly deploy = inject(DeployWizardDeploy);
  protected readonly nav = inject(DeployWizardNavigation);
  private readonly surfaceFeed = inject(DeployWizardSurfaceFeed);
  private readonly currentSurface = inject(CurrentSurfaceService);

  readonly surface = this.surfaceFeed.surface;

  protected readonly breadcrumb: readonly Crumb[] = [
    { label: 'Applications', link: '/apps/applications' },
    { label: 'Deploy' },
  ];

  constructor() {
    effect(() => {
      if (this.form.currentStep().id !== 'cluster' || this.form.selectedCluster()) return;
      const only = this.form.activeClusters();
      if (only.length === 1) untracked(() => this.clusters.selectCluster(only[0]));
    });
    effect(() => {
      const clusterId = this.state.clusterId();
      if (clusterId && this.form.isInternalDeploy()) {
        void this.authzInstall.loadForCluster(clusterId);
      }
    });
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnInit(): void {
    this.nav.bootstrap();
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }
}
