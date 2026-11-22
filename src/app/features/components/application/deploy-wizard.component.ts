import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  effect,
  untracked,
} from '@angular/core';

import { Router, ActivatedRoute } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { WizardStepperStep } from '../../../shared/components/wizard-stepper/wizard-stepper.component';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCheck,
  lucideLoader,
  lucideCloud,
  lucideGitBranch,
  lucidePackage,
  lucideKey,
  lucidePlay,
  lucideSettings,
  lucideServer,
  lucideFileCode,
  lucideX,
  lucidePlus,
  lucideTrash,
  lucideCircleAlert,
  lucideAlertCircle,
  lucideBox,
  lucideInfo,
  lucideTriangleAlert,
  lucideContainer,
  lucideGitMerge,
  lucideCpu,
  lucideCircleCheck,
  lucideCircleX,
  lucideChevronDown,
  lucideChevronUp,
  lucideDownload,
  lucideGithub,
  lucideRocket,
  lucideStore,
  lucideDatabase,
  lucideSlidersHorizontal,
  lucideCopy,
  lucideLayers,
  lucideCircleHelp,
} from '@ng-icons/lucide';
import {
  RepositoryService,
  ConnectedRepository,
  RepositoryFluiManifest,
  RepositoryManifestEntry,
} from '../../service/repository.service';
import { ClusterService } from '../../service/cluster.service';
import { TemplateService } from '../../service/template.service';
import { DeployWizardStateService, FlowSubtype } from '../../service/deploy-wizard-state.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { ImagesService } from '../../../core/api/api/images.service';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { CreateApplicationDto } from '../../../core/api/model/createApplicationDto';
import { ManifestCheckDto } from '../../../core/api/model/manifestCheckDto';
import { ResourceProfileDto } from '../../../core/api/model/resourceProfileDto';
import { ResourceAvailabilityResponseDto } from '../../../core/api/model/resourceAvailabilityResponseDto';
import { TemplateResponseDto } from '../../../core/api/model/templateResponseDto';
import { EnvSuggestionsPanelComponent } from './env-suggestions-panel.component';
import { ToastService } from '../../../shared/services/toast.service';
import { PlatformVersionService } from '../../service/platform-version.service';
import { CatalogOverviewStepComponent } from './deploy-wizard-catalog-steps/catalog-overview-step.component';
import { CatalogInputsStepComponent } from './deploy-wizard-catalog-steps/catalog-inputs-step.component';
import { CatalogConfigStepComponent } from './deploy-wizard-catalog-steps/catalog-config-step.component';
import { CatalogDomainStepComponent } from './deploy-wizard-catalog-steps/catalog-domain-step.component';
import {
  CatalogFeaturesStepComponent,
  catalogAuthLabel,
} from './deploy-wizard-catalog-steps/catalog-features-step.component';
import { catalogOptionEnabled } from './deploy-wizard-catalog-steps/catalog-options';
import { CatalogLinkedBbStepComponent } from './deploy-wizard-catalog-steps/catalog-linked-bb-step.component';
import { CatalogDependenciesStepComponent } from './deploy-wizard-catalog-steps/catalog-dependencies-step.component';
import { CatalogUdpPortsNoticeComponent } from './deploy-wizard-catalog-steps/catalog-udp-ports-notice.component';
import { CatalogResourcesReviewComponent } from './deploy-wizard-catalog-steps/catalog-resources-review.component';
import { CatalogService } from '../../service/catalog.service';
import { PublicRepoSearchResultDto } from '../../../core/api/model/publicRepoSearchResultDto';
import {
  EnvironmentVariable,
  ApplicationKind,
  ApplicationKindEnum,
  suggestKindFromImageRef,
} from '../../model/application.models';
import { EnvVarDetectionResultDto } from '../../../core/api/model/envVarDetectionResultDto';
import { DetectedEnvVarDto } from '../../../core/api/model/detectedEnvVarDto';
import { ClusterInfo } from '../../model/cluster.models';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  DeployWizardSurfaceInput,
  DeployWizardSurfaceRevision,
  buildDeployWizardSurface,
  presentedContent,
} from './deploy-wizard-surface';
import { internalHostingErrorMessage } from '../../model/app-exposure';
import { stripHyphenEdges } from '../../../shared/utils/slug';
import { AuthzInstallService } from '../../service/authz-install.service';
import { AuthzInstallResponseDto } from '../../../core/api/model/authzInstallResponseDto';
import { InstallPromptService } from '../../../core/services/install-prompt.service';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlWizardSteps, WizardStep } from '../../../ui/patterns/wizard-steps';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { DeployStepAnalysis } from './deploy-step-analysis';
import { DeployStepDockerImage } from './deploy-step-docker-image';
import { DeployStepGenerate, OrchestrationStepView } from './deploy-step-generate';
import { DeployStepRepository } from './deploy-step-repository';
import { DeployStepSource } from './deploy-step-source';
import { DeployStepTemplatePicker } from './deploy-step-template-picker';
import { DeployStepTemplateSettings } from './deploy-step-template-settings';
import { DeployStepEnvironment } from './deploy-step-environment';
import { DeployEnvHealthCheck } from './deploy-env-health-check';
import { DeployEnvVars } from './deploy-env-vars';
import { DeployStepCluster } from './deploy-step-cluster';
import { DeployStepReview } from './deploy-step-review';
import { DeployReviewSource } from './deploy-review-source';
import { DeployReviewMarketplace } from './deploy-review-marketplace';

@Component({
  selector: 'app-deploy-wizard',
  imports: [
    FlPageHeader,
    FlPanel,
    FlWizardSteps,
    FlButton,
    FlSpinner,
    DeployStepSource,
    DeployStepTemplatePicker,
    DeployStepTemplateSettings,
    DeployStepDockerImage,
    DeployStepRepository,
    DeployStepAnalysis,
    DeployStepGenerate,
    DeployStepEnvironment,
    DeployEnvHealthCheck,
    DeployEnvVars,
    DeployStepCluster,
    DeployStepReview,
    DeployReviewSource,
    DeployReviewMarketplace,
    EnvSuggestionsPanelComponent,
    CatalogOverviewStepComponent,
    CatalogInputsStepComponent,
    CatalogConfigStepComponent,
    CatalogDomainStepComponent,
    CatalogFeaturesStepComponent,
    CatalogLinkedBbStepComponent,
    CatalogDependenciesStepComponent,
    CatalogResourcesReviewComponent,
    CatalogUdpPortsNoticeComponent,
  ],
  providers: [
    DeployWizardStateService,
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCheck,
      lucideLoader,
      lucideCloud,
      lucideGitBranch,
      lucidePackage,
      lucideKey,
      lucidePlay,
      lucideSettings,
      lucideServer,
      lucideFileCode,
      lucideX,
      lucidePlus,
      lucideTrash,
      lucideCircleAlert,
      lucideInfo,
      lucideTriangleAlert,
      lucideContainer,
      lucideGitMerge,
      lucideCpu,
      lucideCircleCheck,
      lucideCircleX,
      lucideChevronDown,
      lucideChevronUp,
      lucideDownload,
      lucideAlertCircle,
      lucideBox,
      lucideGithub,
      lucideRocket,
      lucideStore,
      lucideDatabase,
      lucideSlidersHorizontal,
      lucideCopy,
      lucideLayers,
      lucideCircleHelp,
    }),
  ],
  template: `
    <div class="fl-page">
      <fl-page-header title="Deploy an application" [breadcrumb]="breadcrumb">
        <span headerMeta>Pick a source and a cluster, review the settings, then deploy.</span>
      </fl-page-header>

      <div class="fl-wizard">
        <nav aria-label="Steps">
          <fl-wizard-steps [steps]="wizardSteps()" [current]="currentStepIndex()" />
        </nav>

        <fl-panel [title]="currentStep()?.title" [flush]="true">
          <div class="p-4">
            @switch (currentStepId()) {
              @case ('source') {
                <app-deploy-step-source
                  [flow]="flowSubtype()"
                  (flowSelect)="selectFlow($event)"
                  (openTemplates)="navigateToTemplates()"
                />
              }

              @case ('template-picker') {
                <app-deploy-step-template-picker
                  [templates]="templates()"
                  [loading]="isLoadingTemplates()"
                  [selected]="state.selectedTemplate()?.framework ?? null"
                  (templateSelect)="selectTemplate($event)"
                />
              }

              @case ('template-settings') {
                <app-deploy-step-template-settings
                  [template]="state.selectedTemplate()"
                  [hasRepoScope]="repoService.hasRepoScope()"
                  [repoName]="state.newRepoName()"
                  [repoOwner]="state.newRepoOwner()"
                  [isPrivate]="state.newRepoPrivate()"
                  [nameError]="templateNameError()"
                  (repoNameChange)="state.newRepoName.set($event)"
                  (repoOwnerChange)="state.newRepoOwner.set($event)"
                  (privateChange)="state.newRepoPrivate.set($event)"
                  (connectGithub)="navigateToRepositories()"
                />
              }

              @case ('docker_image') {
                <app-deploy-step-docker-image
                  [imageRef]="selectedImageRef()"
                  [kind]="selectedKind()"
                  [kindOptions]="kindOptions"
                  (imageSelected)="onImageSelected($event)"
                  (clear)="clearImageRef()"
                  (kindChange)="setKind($event)"
                />
              }

              @case ('repository') {
                <app-deploy-step-repository
                  [tab]="repoTab()"
                  [loading]="isLoadingRepos()"
                  [repos]="connectedRepos()"
                  [selectedId]="selectedRepo()?.id ?? null"
                  [publicRepo]="selectedPublicRepo()"
                  (tabChange)="repoTab.set($event)"
                  (repoSelect)="selectRepository($event)"
                  (publicRepoSelect)="onPublicRepoSelected($event)"
                  (clearPublic)="clearPublicRepo()"
                  (connectRepos)="navigateToRepositories()"
                />
              }

              @case ('analysis') {
                <app-deploy-step-analysis
                  [state]="analysisBranch()"
                  [manifest]="manifestForSelector()?.manifest"
                  [valid]="validManifests()"
                  [invalid]="invalidManifests()"
                  [selectedPath]="selectedManifestPath()"
                  [branch]="selectedBranch()"
                  [repoId]="selectedRepo()?.id ?? null"
                  [fetchError]="manifestFetchError()"
                  [agentPrompt]="manifestAgentPrompt()"
                  [promptCopied]="manifestPromptCopied()"
                  (download)="downloadManifest()"
                  (manifestSelect)="selectManifest($event)"
                  (retry)="triggerManifestCheck()"
                  (copyPrompt)="copyManifestPrompt()"
                />
              }

              @case ('generate') {
                <app-deploy-step-generate
                  [marketplace]="flowSubtype() === 'marketplace'"
                  [appName]="state.catalogDetail()?.name"
                  [installPhase]="state.installPhase()"
                  [installConnected]="!!state.currentInstall()"
                  [installError]="state.installError()"
                  [progress]="catalog.installProgress()"
                  [orchestrationPhase]="state.orchestrationPhase()"
                  [orchestrationError]="state.orchestrationError()"
                  [steps]="orchestrationView()"
                  [pullRequestUrl]="state.workflowPullRequestUrl()"
                  (retry)="deployApplication()"
                  (retryConnect)="retryMarketplaceConnect()"
                />
              }
              @case ('environment') {
                <div class="fl-stack">
                  <app-deploy-step-environment
                    [flow]="flowSubtype()"
                    [isImage]="sourceType() === 'docker_image'"
                    [newRepo]="
                      (state.newRepoOwner() || '(your account)') + '/' + state.newRepoName()
                    "
                    [loadingBranches]="isLoadingBranches()"
                    [branches]="availableBranches()"
                    [branch]="selectedBranch()"
                    [branchesFailed]="branchesFailed()"
                    [port]="appPort()"
                    [portDiscovering]="portDiscovering()"
                    [portAutoDetected]="portAutoDetected()"
                    [exposedPorts]="exposedPorts()"
                    [replicas]="appReplicas()"
                    [autoscale]="appAutoscale()"
                    [maxReplicas]="appMaxReplicas()"
                    [loadingProfiles]="loadingProfiles()"
                    [profiles]="availableProfiles()"
                    [selectedProfile]="selectedProfile()"
                    (branchChange)="selectBranch($event)"
                    (portChange)="appPort.set($event); portAutoDetected.set(false)"
                    (replicasChange)="appReplicas.set($event)"
                    (autoscaleChange)="appAutoscale.set($event)"
                    (maxReplicasChange)="appMaxReplicas.set($event)"
                    (profileChange)="selectedProfile.set($event)"
                  />
                  @if (sourceType() === 'docker_image') {
                    <app-deploy-env-health-check
                      [type]="probeType()"
                      [path]="probeHttpPath()"
                      [initialDelay]="probeInitialDelay()"
                      [period]="probePeriod()"
                      [failureThreshold]="probeFailureThreshold()"
                      [port]="appPort()"
                      [expanded]="probeExpanded()"
                      (typeChange)="probeType.set($event)"
                      (pathChange)="probeHttpPath.set($event)"
                      (initialDelayChange)="probeInitialDelay.set($event)"
                      (periodChange)="probePeriod.set($event)"
                      (failureThresholdChange)="probeFailureThreshold.set($event)"
                      (expandedChange)="probeExpanded.set($event)"
                    />
                  }
                  @if (flowSubtype() === 'existing-repo') {
                    <app-env-suggestions-panel
                      [loading]="envDetectionLoading()"
                      [result]="envDetectionResult()"
                      [error]="envDetectionError()"
                      [selectedIndex]="selectedCandidateIndex()"
                      (cancelDetection)="cancelEnvDetection()"
                      (candidateSelected)="applyDetectedVars($event)"
                      (reanalyze)="analyzeAndSuggestEnvVars()"
                    />
                  }
                  <app-deploy-env-vars
                    [mode]="envMode()"
                    [vars]="envVars()"
                    [rawJson]="rawEnvJson()"
                    [jsonError]="jsonError()"
                    [meta]="detectedVarMeta()"
                    [unreviewedDefaults]="hasUnreviewedDefaults()"
                    (modeChange)="setEnvMode($event)"
                    (add)="addEnvVar()"
                    (remove)="removeEnvVar($event)"
                    (keyChange)="updateEnvKey($event.index, $event.value)"
                    (valueChange)="updateEnvValue($event.index, $event.value)"
                    (toggleSecret)="toggleEnvSecret($event)"
                    (rawJsonChange)="updateRawEnvJson($event)"
                  />
                </div>
              }

              @case ('cluster') {
                <app-deploy-step-cluster
                  [loading]="isLoadingClusters()"
                  [clusters]="activeClusters()"
                  [selectedId]="selectedCluster()?.id ?? null"
                  [projectId]="state.projectId()"
                  [showCapacity]="!!selectedCluster() && flowSubtype() !== 'marketplace'"
                  [checking]="checkingAvailability()"
                  [availability]="resourceAvailability()"
                  [availabilityMessage]="getAvailabilityMessage()"
                  [showExposure]="
                    !!selectedCluster() &&
                    flowSubtype() !== null &&
                    (flowSubtype() !== 'marketplace' ||
                      (state.catalogDetail()?.exposure === 'public' &&
                        state.catalogDetail()?.appType !== 'building-block' &&
                        state.catalogDetail()?.privatizable !== false))
                  "
                  [exposureMode]="state.exposureMode()"
                  [capabilitiesLoading]="catalog.capabilitiesLoading()"
                  [canUseInternal]="state.canUseInternalExposure()"
                  [internalMissingLabel]="internalHostingMissingLabel()"
                  [showOverrides]="
                    flowSubtype() === 'existing-repo' && !!state.manifestResult()?.manifest
                  "
                  [overrideName]="state.overrideName()"
                  [overrideFqdn]="state.overrideFqdn()"
                  [declaredName]="state.manifestResult()?.manifest?.metadata.name ?? ''"
                  [nameChanged]="installNameChanged()"
                  (clusterSelect)="selectCluster($event)"
                  (projectChange)="state.projectId.set($event)"
                  (createCluster)="navigateToCluster()"
                  (smallerProfile)="goToConfigStep()"
                  (exposureChange)="state.exposureMode.set($event)"
                  (configureDns)="navigateToClusterDns()"
                  (overrideNameChange)="state.overrideName.set($event)"
                  (overrideFqdnChange)="state.overrideFqdn.set($event)"
                >
                  @if (selectedCluster() && flowSubtype() === 'marketplace') {
                    <app-catalog-resources-review />
                    <app-catalog-udp-ports-notice />
                  }
                </app-deploy-step-cluster>
              }

              <!-- Marketplace: Overview + display name -->
              @case ('catalog-overview') {
                <app-catalog-overview-step />
              }

              <!-- Marketplace: User input prompts -->
              @case ('catalog-inputs') {
                <app-catalog-inputs-step />
              }

              <!-- Marketplace: Editable env overrides -->
              @case ('catalog-config') {
                <app-catalog-config-step />
              }

              <!-- Marketplace: auth mode + feature toggles -->
              @case ('catalog-features') {
                <app-catalog-features-step />
              }

              <!-- Marketplace: Domain choice -->
              @case ('catalog-domain') {
                <app-catalog-domain-step />
              }

              <!-- Marketplace: pick target building block instance -->
              @case ('catalog-linked-bb') {
                <app-catalog-linked-bb-step />
              }

              <!-- Marketplace: pick or auto-create dependencies (e.g. ferretdb → postgres) -->
              @case ('catalog-dependencies') {
                <app-catalog-dependencies-step />
              }

              @case ('review') {
                <app-deploy-step-review
                  [blockedReason]="canDeployReason()"
                  [authzNotReady]="authzNotReady()"
                  [authzInstalling]="authzInstall.installing()"
                  [authzError]="authzInstall.error()"
                  [error]="deployError() || state.orchestrationError()"
                  [flow]="flowSubtype()"
                  [checksLoading]="manifestChecksLoading()"
                  [checksError]="manifestChecksError()"
                  [checks]="manifestChecks()"
                  [envCount]="getEnvVarsCount()"
                  [secretCount]="getSecretVarsCount()"
                  [catalogInputs]="getCatalogInputsCount()"
                  [catalogOverrides]="getCatalogOverridesCount()"
                  [catalogSecrets]="getCatalogSecretsCount()"
                  [inputsStep]="
                    stepIds().includes('catalog-inputs') ? 'catalog-inputs' : 'catalog-config'
                  "
                  [cluster]="selectedCluster()"
                  [checking]="checkingAvailability()"
                  [availability]="resourceAvailability()"
                  [availabilityMessage]="getAvailabilityMessage()"
                  [appName]="getApplicationName()"
                  [roomWait]="roomWaitAhead()"
                  [editable]="stepIds()"
                  (edit)="editStep($event)"
                  (configureDns)="navigateToClusterDns()"
                  (installAuthProxy)="installAuthProxy()"
                  (authProxySettings)="navigateToAuthProxy()"
                  (smallerProfile)="goToConfigStep()"
                >
                  <ng-container ngProjectAs="[reviewSource]">
                    @if (sourceType() !== 'docker_image' && flowSubtype() === 'marketplace') {
                      <app-deploy-review-marketplace
                        [detail]="state.catalogDetail()"
                        [displayName]="state.catalogDisplayName()"
                        [authLabel]="state.catalogHasAuthChoice() ? catalogAuthModeLabel() : null"
                        [showFeatures]="state.catalogFeatureOptions().length > 0"
                        [featureLabels]="enabledFeatureLabels()"
                        [linkedRefs]="state.linkedBbRefs()"
                        [linkedInstance]="state.selectedReusableInstance()"
                        [internalDeploy]="isInternalDeploy()"
                        [internalUrl]="internalUrlPreview()"
                        [domainMode]="state.domainMode()"
                        [autoFqdn]="autoFqdnPreview()"
                        [requestedDomain]="state.requestedDomain()"
                        [tls]="state.enableTls()"
                        [masterRelevant]="state.allowMasterPlacementRelevant()"
                        [masterAllowed]="state.allowMasterPlacement()"
                        [editable]="stepIds()"
                        (edit)="editStep($event)"
                        (masterAllowedChange)="state.allowMasterPlacement.set($event)"
                      />
                    } @else {
                      <app-deploy-review-source
                        [kind]="
                          sourceType() === 'docker_image'
                            ? 'image'
                            : flowSubtype() === 'template'
                              ? 'template'
                              : 'repo'
                        "
                        [imageRef]="selectedImageRef()"
                        [port]="appPort()"
                        [replicas]="appReplicas()"
                        [profile]="selectedProfileInfo()"
                        [probeType]="probeType()"
                        [probePath]="probeHttpPath()"
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
                        [repoName]="selectedRepo()?.name ?? selectedPublicRepo()?.full_name ?? ''"
                        [branch]="selectedBranch()"
                        [defaultsSource]="state.defaultsSource()"
                        [manifestName]="
                          state.manifestResult()?.valid
                            ? (state.manifestResult()?.manifest?.metadata.name ?? null)
                            : null
                        "
                        [framework]="state.confirmedFramework()"
                        [internal]="state.exposureMode() === 'internal'"
                        [internalUrl]="internalUrlPreview()"
                        [editable]="stepIds()"
                        (edit)="editStep($event)"
                      />
                    }
                  </ng-container>
                  @if (flowSubtype() === 'marketplace') {
                    <app-catalog-resources-review />
                    <app-catalog-udp-ports-notice />
                  }
                </app-deploy-step-review>
              }
            }
          </div>

          <div class="fl-wizard__footer border-t border-fl-border px-4 py-3">
            <button flButton="ghost" type="button" (click)="navigateBack()">Cancel</button>
            <button
              flButton
              type="button"
              [disabled]="currentStepIndex() === 0"
              (click)="previousStep()"
            >
              Previous
            </button>
            @if (currentStepIndex() < steps().length - 1 || steps().length === 1) {
              <button
                flButton="primary"
                type="button"
                [disabled]="!canProceed()"
                (click)="nextStep()"
              >
                Next
              </button>
            } @else if (!(flowSubtype() === 'marketplace' && state.installPhase() === 'running')) {
              <button
                flButton="primary"
                type="button"
                [disabled]="!canComplete() || isDeploying() || !canDeploy()"
                [attr.title]="canDeployReason()"
                (click)="deployApplication()"
              >
                @if (isDeploying()) {
                  <fl-spinner
                    [label]="flowSubtype() === 'marketplace' ? 'Installing' : 'Deploying'"
                  />
                  {{ flowSubtype() === 'marketplace' ? 'Installing…' : 'Deploying…' }}
                } @else {
                  {{ flowSubtype() === 'marketplace' ? 'Install' : 'Deploy' }}
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
  /** The capacity check says it will not fit now: the honest estimate is "when scaling makes room". */
  protected readonly roomWaitAhead = computed(() => {
    const av = this.state.catalogAvailability();
    return !!av && !!av.reason && av.placement?.verdict !== 'fits';
  });

  private readonly router = inject(Router);
  private readonly installPrompt = inject(InstallPromptService);
  private readonly route = inject(ActivatedRoute);
  repoService = inject(RepositoryService);
  private readonly clusterService = inject(ClusterService);
  private readonly templateService = inject(TemplateService);
  state = inject(DeployWizardStateService);
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly imagesApi = inject(ImagesService);
  private readonly clustersApi = inject(InfrastructureClustersService);
  catalog = inject(CatalogService);
  protected authzInstall = inject(AuthzInstallService);
  private readonly toast = inject(ToastService);
  private readonly platformVersion = inject(PlatformVersionService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  /**
   * What a coding agent needs in order to write the manifest: where the
   * contract lives, and how to check what it produced.
   *
   * The schema is named by its URL rather than by a CLI command on purpose —
   * whoever is reading this screen is in a browser, may have no Flui CLI at
   * all, and `flui app init` would send them to a second sign-in before they
   * could write a single line.
   *
   * The URL is pinned to the version THIS installation validates with, taken
   * from `GET /version`. The floating one resolves to whatever the registry has
   * today, which is not the same thing: npm has run four minor versions ahead
   * of the compiled-in package before now, and an author following the unpinned
   * link would have been handed a contract this cluster does not agree to. On
   * an installation older than that field, the prompt names the schema without
   * a version rather than inventing one.
   */
  protected readonly manifestAgentPrompt = computed(() => {
    const spec = this.platformVersion.version()?.manifestSpec;
    const schemaUrl =
      spec?.applicationSchemaUrl ??
      'https://unpkg.com/@flui-cloud/spec/schemas/application.v1beta1.json';
    return [
      'Write a flui.yaml for this repository, following the schema at',
      schemaUrl,
      '- one kind: Application per deployable app. Then check it with:',
      'flui deploy --validate-only --cluster <cluster>',
      'which checks the schema and also asks this installation whether it would',
      'actually land — cluster, repository, build credentials, room, and what it',
      'would do. Without the Flui CLI the schema alone can be checked with:',
      'npx -p @flui-cloud/spec flui-spec validate flui.yaml',
    ].join('\n');
  });

  protected manifestPromptCopied = signal(false);

  async copyManifestPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.manifestAgentPrompt());
      this.manifestPromptCopied.set(true);
      setTimeout(() => this.manifestPromptCopied.set(false), 1500);
    } catch {
      this.toast.showError('Could not copy to clipboard');
    }
  }

  // Flow routing (Flow B/C) — mirrored from state service for easier template access
  readonly flowSubtype = this.state.flowSubtype;

  // Template picker state
  templates = this.templateService.templates;
  isLoadingTemplates = signal<boolean>(false);

  // Step management
  currentStepIndex = signal<number>(0);
  isDeploying = signal<boolean>(false);
  deployError = signal<string | null>(null);

  // Source type selection
  sourceType = signal<'docker_image' | 'git_build' | null>(null);

  // Docker image step
  selectedImageRef = signal<string>('');
  selectedKind = signal<ApplicationKind>(ApplicationKindEnum.Application);
  readonly kindOptions: { value: ApplicationKind; label: string }[] = [
    { value: ApplicationKindEnum.Database, label: 'Database' },
    { value: ApplicationKindEnum.Application, label: 'Application' },
    { value: ApplicationKindEnum.Tool, label: 'Tool' },
    { value: ApplicationKindEnum.System, label: 'System' },
  ];

  setKind(kind: ApplicationKind): void {
    this.selectedKind.set(kind);
  }

  readonly currentStepId = computed(() => this.steps()[this.currentStepIndex()]?.id ?? '');

  // Step 1: Repository
  isLoadingRepos = signal<boolean>(false);
  selectedRepo = signal<ConnectedRepository | null>(null);
  selectedPublicRepo = signal<PublicRepoSearchResultDto | null>(null);
  repoTab = signal<'mine' | 'public'>('mine');
  connectedRepos = this.repoService.connectedRepositories;

  // Step 2: Branch & Framework
  isLoadingBranches = signal<boolean>(false);
  availableBranches = signal<string[]>([]);
  selectedBranch = signal<string>('');
  /** True when the provider would not list them: the field degrades to free text rather than
   * offering names nobody read from the repository. */
  branchesFailed = signal<boolean>(false);

  // Step 3: Environment Variables
  envMode = signal<'key-value' | 'json'>('key-value');
  envVars = signal<EnvironmentVariable[]>([]);
  rawEnvJson = signal<string>('{}');
  jsonError = signal<string | null>(null);

  // Env var detection (git_build only)
  envDetectionLoading = signal(false);
  envDetectionResult = signal<EnvVarDetectionResultDto | null>(null);
  envDetectionError = signal<string | null>(null);
  selectedCandidateIndex = signal(0);
  detectedVarMeta = signal<Map<string, DetectedEnvVarDto>>(new Map());
  private currentAnalysisToken: symbol | null = null;

  // Configuration step (docker_image)
  appPort = signal<number | null>(null);
  appReplicas = signal<number>(1);
  appAutoscale = signal(false);
  appMaxReplicas = signal<number>(3);

  // Port discovery
  portDiscovering = signal<boolean>(false);
  portDiscoveredFrom = signal<string>(''); // imageRef that was inspected
  exposedPorts = signal<number[]>([]); // all ports found
  portAutoDetected = signal<boolean>(false); // true if current appPort was set by discovery

  // Health probe (docker_image)
  probeType = signal<'http' | 'tcp' | 'none'>('none');
  probeExpanded = signal<boolean>(false);
  probeHttpPath = signal<string>('/');
  probeInitialDelay = signal<number>(30);
  probePeriod = signal<number>(30);
  probeFailureThreshold = signal<number>(3);
  selectedProfile = signal<string>('small');
  availableProfiles = signal<ResourceProfileDto[]>([]);
  loadingProfiles = signal<boolean>(false);

  // Cluster resource availability (docker_image)
  resourceAvailability = signal<ResourceAvailabilityResponseDto | null>(null);
  checkingAvailability = signal<boolean>(false);

  /**
   * Deploy-side resource gate. All flows check that the cluster has enough
   * free resources for the RUNTIME pod (profile * replicas). Build-side
   * resources are no longer a concern — git_build flows run the build on
   * GitHub Actions runners, not on the cluster.
   */
  readonly isInternalDeploy = computed(() => {
    if (this.flowSubtype() === 'marketplace') {
      const d = this.state.catalogDetail();
      if (!d || d.appType === 'building-block') return false;
      return (
        d.exposure === 'internal' ||
        this.state.exposureMode() === CreateApplicationDto.ExposureEnum.Internal
      );
    }
    return this.state.exposureMode() === CreateApplicationDto.ExposureEnum.Internal;
  });

  readonly authzNotReady = computed(() => {
    if (!this.isInternalDeploy()) return false;
    const status = this.authzInstall.install()?.status;
    return status !== AuthzInstallResponseDto.StatusEnum.Running;
  });

  constructor() {
    // One cluster to choose from — always the case for a demo guest — is chosen
    // for the person, so the step does not sit with Next switched off.
    effect(() => {
      if (this.currentStep().id !== 'cluster' || this.selectedCluster()) return;
      const only = this.activeClusters();
      if (only.length === 1) untracked(() => this.selectCluster(only[0]));
    });
    effect(() => {
      const clusterId = this.state.clusterId();
      if (clusterId && this.isInternalDeploy()) {
        void this.authzInstall.loadForCluster(clusterId);
      }
    });

    // Publish this page's own Semantic Surface snapshot into the shared registry whenever
    // it changes — same pattern as ApplicationDetailComponent. ngOnDestroy clears it so the
    // snapshot never outlives this page.
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  readonly canDeploy = computed(() => {
    if (this.flowSubtype() === 'marketplace') {
      if (this.state.catalogDetail()?.installable === false) return false;
      return this.state.canSubmitMarketplaceResources();
    }
    const av = this.resourceAvailability();
    if (!av) return true; // still loading or no check performed yet — don't block
    return av.canDeploy;
  });

  /** Tooltip explaining why the install/deploy button is disabled (if it is). */
  readonly canDeployReason = computed<string | null>(() => {
    const detail = this.state.catalogDetail();
    if (this.flowSubtype() === 'marketplace' && detail?.installable === false) {
      const details = (detail.notInstallableDetails ?? []).map((d) => {
        switch (d) {
          case 'dns_zone':
            return 'DNS zone';
          case 'wildcard_issuer':
            return 'wildcard TLS issuer';
          case 'internal_wildcard_dns':
            return 'internal wildcard DNS';
          default:
            return d;
        }
      });
      const missing = details.length ? ` Missing: ${details.join(', ')}.` : '';
      return `This cluster does not support internal apps yet.${missing} Configure DNS on the cluster first.`;
    }
    return null;
  });

  readonly internalHostingMissingLabel = computed(() => {
    const missing = this.state.internalHostingMissing();
    if (missing.length === 0) return 'DNS configuration';
    return missing
      .map((k) => {
        switch (k) {
          case 'dns_zone':
            return 'DNS zone';
          case 'wildcard_issuer':
            return 'wildcard TLS issuer';
          case 'internal_wildcard_dns':
            return 'internal wildcard DNS';
          default:
            return k;
        }
      })
      .join(', ');
  });

  readonly selectedProfileInfo = computed(
    () => this.availableProfiles().find((p) => p.name === this.selectedProfile()) ?? null,
  );

  // Manifest check (Flow C — manifest-first, mirror of `flui deploy`)
  isCheckingManifest = signal<boolean>(false);
  manifestsForSelector = signal<RepositoryManifestEntry[] | null>(null);
  selectedManifestPath = signal<string | null>(null);
  manifestFetchError = signal<string | null>(null);

  /** Installation checks (target cluster, connected repo, build credentials,
   *  live capacity...) — what only this installation can say about the
   *  manifest, run against POST /applications/manifest/validate at the review
   *  step once a cluster is picked. `unknown` is not a failure: it means this
   *  installation could not answer, never that the manifest is wrong. */
  manifestChecks = signal<ManifestCheckDto[] | null>(null);
  manifestChecksLoading = signal<boolean>(false);
  manifestChecksError = signal<string | null>(null);

  /** Valid (kind: Application) manifests — the deployables of this repo. */
  readonly validManifests = computed<RepositoryManifestEntry[]>(() =>
    (this.manifestsForSelector() ?? []).filter((e) => e.valid),
  );

  /** Manifests that exist but failed validation — surfaced in the invalid branch. */
  readonly invalidManifests = computed<RepositoryManifestEntry[]>(() =>
    (this.manifestsForSelector() ?? []).filter((e) => !e.valid),
  );

  /**
   * The manifest driving the rest of the wizard, mapped to the single-manifest
   * shape consumed by the state service. In a monorepo (several valid
   * manifests) the user picks one in the analysis step; the first valid one is
   * pre-selected.
   */
  readonly manifestForSelector = computed<RepositoryFluiManifest | null>(() => {
    const entries = this.manifestsForSelector();
    if (!entries) return null;
    const branch = this.selectedBranch();
    if (entries.length === 0) return { present: false, branch };
    const chosen =
      entries.find((e) => e.valid && e.path === this.selectedManifestPath()) ??
      entries.find((e) => e.valid) ??
      entries[0];
    return {
      present: true,
      branch,
      path: chosen.path,
      content: chosen.content,
      valid: chosen.valid,
      validationError: chosen.validationError,
      manifest: chosen.manifest,
    };
  });

  /**
   * Branch state for the Flow C analysis step. The flui.yaml manifest is the
   * only accepted source of truth: without a valid manifest the wizard blocks
   * and points the user to `flui app init` — no Dockerfile fallback.
   */
  readonly analysisBranch = computed<
    'loading' | 'flui-ready' | 'manifest-invalid' | 'no-manifest' | 'check-failed'
  >(() => {
    if (this.isCheckingManifest()) return 'loading';
    if (this.manifestFetchError()) return 'check-failed';
    const entries = this.manifestsForSelector();
    if (!entries) return 'loading';
    if (entries.length === 0) return 'no-manifest';
    return this.validManifests().length > 0 ? 'flui-ready' : 'manifest-invalid';
  });

  // Step 4: Cluster
  isLoadingClusters = signal<boolean>(false);
  selectedCluster = signal<ClusterInfo | null>(null);
  allClusters = this.clusterService.clusters;
  activeClusters = computed(() => this.allClusters().filter((c) => c.status === 'active'));

  // Wizard steps definition — three flows share the same component, dispatched on flowSubtype.
  readonly steps = computed<WizardStepperStep[]>(() => {
    const ci = this.currentStepIndex();
    const sub = this.flowSubtype();

    /** Stamps every step in the array with the correct isCompleted flag —
     *  any step whose index is strictly less than the current step index
     *  is marked as completed (green). */
    const markCompleted = (raw: WizardStepperStep[]): WizardStepperStep[] =>
      raw.map((s, i) => ({ ...s, isCompleted: i < ci }));

    const sourceStep = this.buildSourceStep(sub);
    const clusterStep = this.buildClusterStep();
    const reviewStep = this.buildReviewStep();

    if (sub === 'image') {
      return markCompleted(this.buildImageFlowSteps(sourceStep, clusterStep, reviewStep));
    }
    if (sub === 'template') {
      return markCompleted(this.buildTemplateFlowSteps(sourceStep, clusterStep, reviewStep));
    }
    if (sub === 'existing-repo') {
      return markCompleted(this.buildExistingRepoFlowSteps(sourceStep, clusterStep, reviewStep));
    }
    if (sub === 'marketplace') {
      return markCompleted(this.buildMarketplaceFlowSteps(sourceStep, clusterStep, reviewStep));
    }

    // No flow picked yet — show only source step
    return markCompleted([sourceStep]);
  });

  private buildSourceStep(sub: FlowSubtype): WizardStepperStep {
    return {
      id: 'source',
      title: 'Source',
      icon: 'lucideSettings',
      isValid: !!sub,
      isCompleted: false, // stamped by markCompleted
    };
  }

  private buildClusterStep(): WizardStepperStep {
    return {
      id: 'cluster',
      title: 'Cluster',
      icon: 'lucideServer',
      isValid: !!this.selectedCluster(),
      isCompleted: false,
    };
  }

  private buildReviewStep(): WizardStepperStep {
    return {
      id: 'review',
      title: 'Review',
      icon: 'lucideCheck',
      // A dedicated app on a worker-less cluster must run on the control-plane node;
      // block proceeding while the placement toggle is shown but left unticked, since
      // the install would otherwise fail with NO_WORKER_FOR_DEDICATED_APP.
      isValid: !(this.state.allowMasterPlacementRelevant() && !this.state.allowMasterPlacement()),
      isCompleted: false,
    };
  }

  private buildImageFlowSteps(
    sourceStep: WizardStepperStep,
    clusterStep: WizardStepperStep,
    reviewStep: WizardStepperStep,
  ): WizardStepperStep[] {
    return [
      sourceStep,
      {
        id: 'docker_image',
        title: 'Docker image',
        icon: 'lucideContainer',
        isValid: !!this.selectedImageRef(),
        isCompleted: false,
      },
      {
        id: 'environment',
        title: 'Configuration',
        icon: 'lucideKey',
        isValid: true,
        isCompleted: false,
      },
      clusterStep,
      reviewStep,
    ];
  }

  private buildTemplateFlowSteps(
    sourceStep: WizardStepperStep,
    clusterStep: WizardStepperStep,
    reviewStep: WizardStepperStep,
  ): WizardStepperStep[] {
    return [
      sourceStep,
      {
        id: 'template-picker',
        title: 'Template',
        icon: 'lucideRocket',
        isValid: !!this.state.selectedTemplate(),
        isCompleted: false,
      },
      {
        id: 'template-settings',
        title: 'Repo settings',
        icon: 'lucideGithub',
        isValid: !!this.state.newRepoName() && !this.templateNameError(),
        isCompleted: false,
      },
      clusterStep,
      {
        id: 'environment',
        title: 'Env vars',
        icon: 'lucideKey',
        isValid: true,
        isCompleted: false,
      },
      reviewStep,
      {
        id: 'generate',
        title: 'Deploy',
        icon: 'lucidePlay',
        isValid: true,
        isCompleted: false,
      },
    ];
  }

  private buildExistingRepoFlowSteps(
    sourceStep: WizardStepperStep,
    clusterStep: WizardStepperStep,
    reviewStep: WizardStepperStep,
  ): WizardStepperStep[] {
    const hasRepo = !!(this.selectedRepo() || this.selectedPublicRepo());
    const analysisValid = this.analysisBranch() === 'flui-ready';

    return [
      sourceStep,
      {
        id: 'repository',
        title: 'Repository',
        icon: 'lucideGitBranch',
        isValid: hasRepo,
        isCompleted: false,
      },
      {
        id: 'analysis',
        title: 'Analysis',
        icon: 'lucideGithub',
        isValid: analysisValid,
        isCompleted: false,
      },
      clusterStep,
      {
        id: 'environment',
        title: 'Env vars',
        icon: 'lucideKey',
        isValid: true,
        isCompleted: false,
      },
      reviewStep,
      {
        id: 'generate',
        title: 'Deploy',
        icon: 'lucidePlay',
        isValid: true,
        isCompleted: false,
      },
    ];
  }

  private buildMarketplaceFlowSteps(
    sourceStep: WizardStepperStep,
    clusterStep: WizardStepperStep,
    reviewStep: WizardStepperStep,
  ): WizardStepperStep[] {
    const detail = this.state.catalogDetail();
    const hasPrompts = (detail?.userInputPrompts?.length ?? 0) > 0;
    const hasDefaultCredentials = !!detail?.defaultCredentials;
    const hasEditableEnv = (detail?.editableEnv?.length ?? 0) > 0;

    const marketplaceSteps: WizardStepperStep[] = [
      sourceStep,
      {
        id: 'catalog-overview',
        title: 'App',
        icon: 'lucideStore',
        isValid: !!detail && this.state.catalogDisplayNameValid(),
        isCompleted: false,
      },
    ];

    if (hasPrompts || hasDefaultCredentials) {
      marketplaceSteps.push({
        id: 'catalog-inputs',
        title: 'Configuration',
        icon: 'lucideKey',
        isValid: this.state.catalogInputsValid(),
        isCompleted: false,
      });
    }

    if (hasEditableEnv) {
      marketplaceSteps.push({
        id: 'catalog-config',
        title: 'Settings',
        icon: 'lucideSettings',
        isValid: true,
        isCompleted: false,
      });
    }

    if (this.state.needsCatalogFeaturesStep()) {
      marketplaceSteps.push({
        id: 'catalog-features',
        title: 'Features',
        icon: 'lucideSlidersHorizontal',
        isValid: true,
        isCompleted: false,
      });
    }

    marketplaceSteps.push(clusterStep);
    if (this.state.needsDependencyPicker()) {
      marketplaceSteps.push({
        id: 'catalog-dependencies',
        title: 'Dependencies',
        icon: 'lucideDatabase',
        isValid: this.state.catalogDependenciesValid(),
        isCompleted: false,
      });
    }
    if (this.state.needsLinkedBbPicker()) {
      marketplaceSteps.push({
        id: 'catalog-linked-bb',
        title: 'Link ',
        icon: 'lucideDatabase',
        // Optional step: the user can skip and Connect later from the app page.
        isValid: true,
        isCompleted: false,
      });
    }
    if (
      detail?.exposesPublicEndpoint !== false &&
      this.state.exposureMode() !== CreateApplicationDto.ExposureEnum.Internal
    ) {
      marketplaceSteps.push({
        id: 'catalog-domain',
        title: 'Domain',
        icon: 'lucideCloud',
        isValid: this.state.catalogDomainValid(),
        isCompleted: false,
      });
    }
    marketplaceSteps.push(reviewStep, {
      id: 'generate',
      title: 'Install',
      icon: 'lucidePlay',
      isValid: true,
      isCompleted: false,
    });

    return marketplaceSteps;
  }

  // Template name validation (matches the backend regex from FRONTEND_TEMPLATE_DEPLOY.md)
  private static readonly REPO_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
  readonly templateNameError = computed(() => {
    const value = this.state.newRepoName();
    if (!value) return null;
    if (value.length > 100) return 'Maximum 100 characters.';
    if (!DeployWizardComponent.REPO_NAME_PATTERN.test(value))
      return 'Only letters, numbers, dots, dashes, and underscores.';
    return null;
  });

  readonly currentStep = computed(() => this.steps()[this.currentStepIndex()]);

  protected readonly breadcrumb: readonly Crumb[] = [
    { label: 'Applications', link: '/apps/applications' },
    { label: 'Deploy' },
  ];

  protected readonly wizardSteps = computed<WizardStep[]>(() =>
    this.steps().map((s) => ({ name: s.title.trim() })),
  );

  private readonly surfaceRevision = new DeployWizardSurfaceRevision();

  readonly surface = computed(() => {
    const repo = this.selectedRepo();
    const template = this.state.selectedTemplate();
    const cluster = this.selectedCluster();
    const input: DeployWizardSurfaceInput = {
      currentStepId: this.currentStepId(),
      currentStepTitle: this.currentStep()?.title ?? null,
      sourceType: this.sourceType(),
      flowSubtype: this.flowSubtype(),
      selectedCluster: cluster?.id && cluster?.name ? { id: cluster.id, name: cluster.name } : null,
      selectedRepositoryFullName: repo?.fullName ?? null,
      selectedTemplate: template
        ? { framework: template.framework, displayName: template.displayName }
        : null,
    };
    const content = presentedContent(input);
    if (!content) return null;
    return buildDeployWizardSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  ngOnInit(): void {
    // Idempotent, and the prompt below is wrong without it: the schema URL is
    // pinned to the version this installation reports.
    void this.platformVersion.load();
    void (async () => {
      // Background loads — none of these block the initial render
      this.loadClusters();
      this.loadProfiles();
      this.loadRepositories();

      // Kick off template loading if we're about to show the template picker
      this.loadTemplates();

      // Refresh OAuth status so hasRepoScope is accurate for the template flow
      try {
        await this.repoService.checkOAuthStatus();
      } catch {
        /* non-fatal */
      }

      const templateFw = this.route.snapshot.queryParamMap.get('template');
      const repoId = this.route.snapshot.queryParamMap.get('repoId');
      const catalogSlug = this.route.snapshot.queryParamMap.get('catalogSlug');
      const autoConnectTo = this.route.snapshot.queryParamMap.get('autoConnectTo');

      if (catalogSlug) {
        // Deep-link from the App Catalog → pre-select marketplace flow
        this.selectFlow('marketplace');
        const detail = await this.catalog.loadDetail(catalogSlug);
        if (detail) {
          this.state.initializeFromCatalog(detail);
          if (autoConnectTo) {
            this.state.pendingLinkedInstallId.set(autoConnectTo);
            this.state.linkedInstallIdPreset.set(true);
          }
          this.currentStepIndex.set(1); // skip the Source step
        }
      } else if (templateFw) {
        // Deep-link from templates-catalog → pre-select Flow B with a specific template
        this.selectFlow('template');
        // Wait for templates to finish loading before we can match the framework
        await this.loadTemplates();
        const tpl = this.templates().find((t) => t.framework === templateFw);
        if (tpl) {
          this.state.selectedTemplate.set(tpl);
          this.advanceToTemplateSettings();
        } else {
          // Unknown template — leave the user on the picker
          this.currentStepIndex.set(1);
        }
      } else if (repoId) {
        // Deep-link from the repositories page → pre-select Flow C existing-repo
        this.selectFlow('existing-repo');
        await this.loadRepositories();
        const repo = this.connectedRepos().find((r) => r.id === repoId);
        if (repo) {
          this.selectRepository(repo);
          this.currentStepIndex.set(1);
          this.loadBranches().then(() => this.triggerManifestCheck());
        }
      }
    })();
  }

  async loadTemplates(): Promise<void> {
    if (this.templates().length > 0) return;
    this.isLoadingTemplates.set(true);
    try {
      await this.templateService.loadTemplates();
    } catch {
      // silent — error surfaced via templateService.errorMessage
    } finally {
      this.isLoadingTemplates.set(false);
    }
  }

  // Load repositories
  async loadRepositories(): Promise<void> {
    this.isLoadingRepos.set(true);

    try {
      await this.repoService.loadRepositories();
    } catch (error) {
      console.error('❌ Failed to load repositories:', error);
    } finally {
      this.isLoadingRepos.set(false);
    }
  }

  // Navigation
  canProceed(): boolean {
    return this.currentStep().isValid;
  }

  canComplete(): boolean {
    const reviewIdx = this.steps().length - 1;
    return this.steps().every((step, idx) => idx === reviewIdx || step.isValid);
  }

  nextStep(): void {
    if (!this.canProceed()) return;

    const nextIndex = this.currentStepIndex() + 1;
    const nextStepId = this.steps()[nextIndex]?.id;
    const sub = this.flowSubtype();

    this.handleAnalysisStepEntry(nextStepId, sub);
    this.handleClusterStepEntryFlowC(nextStepId, sub);
    this.handleEnvironmentStepEntry(nextStepId, sub);
    this.handleReviewStepEntry(nextStepId, sub);
    this.handleClusterSelectionSync();

    this.currentStepIndex.set(Math.min(nextIndex, this.steps().length - 1));
  }

  // Flow C — check for the flui.yaml manifest when entering the analysis step
  private handleAnalysisStepEntry(nextStepId: string | undefined, sub: FlowSubtype): void {
    if (nextStepId === 'analysis' && sub === 'existing-repo') {
      this.loadBranches().then(() => this.triggerManifestCheck());
    }
  }

  // Flow C — sync state service with repo + manifest when entering cluster step from analysis
  private handleClusterStepEntryFlowC(nextStepId: string | undefined, sub: FlowSubtype): void {
    if (nextStepId !== 'cluster' || sub !== 'existing-repo') return;
    const repo = this.selectedRepo();
    const manifest = this.manifestForSelector();
    if (repo && manifest?.valid) {
      this.state.initializeFromManifest(
        repo.id,
        repo.fullName,
        this.selectedBranch(),
        manifest,
        this.selectedCluster()?.id ?? '',
      );
    }
  }

  private handleEnvironmentStepEntry(nextStepId: string | undefined, sub: FlowSubtype): void {
    // Flow C — env vars step: the manifest's deploy.env is the source of truth.
    // Source-code detection only runs when the manifest declares no env at all.
    if (
      nextStepId === 'environment' &&
      sub === 'existing-repo' &&
      (this.selectedRepo() || this.selectedPublicRepo())
    ) {
      const manifestHasEnv = this.prefillEnvVarsFromManifest();
      if (!manifestHasEnv) {
        this.loadBranches().then(() => this.analyzeAndSuggestEnvVars());
      }
    }

    // Flow A — inspect image ports when entering config step
    if (nextStepId === 'environment' && sub === 'image') {
      this.inspectImagePorts();
    }
  }

  private handleReviewStepEntry(nextStepId: string | undefined, sub: FlowSubtype): void {
    if (nextStepId !== 'review') return;

    const clusterId = this.selectedCluster()?.id;
    if (!clusterId) return;

    if (sub === 'existing-repo') {
      this.runManifestChecks(clusterId);
    }

    if (sub !== 'marketplace') {
      // Re-run the runtime resource check whenever the user advances PAST the
      // config step (where they could have changed profile/replicas) OR into
      // the review step. This catches the Flow C case: user picks cluster first
      // (check runs with template defaults) and then changes the profile in
      // flui-config — without this re-run the review would still show the
      // stale check from the cluster step.
      this.checkResourceAvailabilityForCluster(clusterId);
      return;
    }

    // Marketplace uses a dedicated capacity check with the manifest-declared
    // resources (or the user's overrides), not the generic profile-based one.
    this.state.checkCatalogResourceAvailability(clusterId);
    // Surface the control-plane placement toggle when a dedicated-storage app
    // targets a worker-less cluster, instead of failing the deploy later.
    this.state.refreshMasterPlacementRelevance(clusterId);
  }

  // Cluster sync — push the chosen cluster into the state service for Flow B/C/D
  private handleClusterSelectionSync(): void {
    if (this.currentStep().id !== 'cluster' || !this.selectedCluster()?.id) return;

    const clusterId = this.selectedCluster()!.id!;
    this.state.clusterId.set(clusterId);
    // Load cluster capabilities for all flows — marketplace uses them for the
    // Domain step branches, docker/git flows use them to gate the Internal
    // exposure option (hide if the cluster has no internal hosting).
    this.state.fetchClusterCapabilities(clusterId);
    if (this.flowSubtype() !== 'marketplace') return;

    // Refresh the catalog detail with the chosen clusterId so `installable`
    // and `notInstallableReason` reflect this cluster's readiness.
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
    this.currentStepIndex.set(Math.max(this.currentStepIndex() - 1, 0));
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

  async installAuthProxy(): Promise<void> {
    const id = this.state.clusterId();
    if (!id) return;
    await this.authzInstall.installAuthz(id);
  }

  navigateToTemplates(): void {
    this.router.navigate(['/apps/templates']);
  }

  // Step: Source type / flow selection
  selectFlow(sub: 'image' | 'template' | 'existing-repo' | 'marketplace'): void {
    this.state.flowSubtype.set(sub);
    if (sub === 'image') {
      this.state.sourceType.set('docker_image');
      this.sourceType.set('docker_image');
    } else if (sub === 'marketplace') {
      this.state.sourceType.set(null);
      this.sourceType.set(null);
    } else {
      this.state.sourceType.set('git_build');
      this.sourceType.set('git_build');
    }

    // Reset per-flow state on switch
    this.selectedImageRef.set('');
    this.selectedRepo.set(null);
    this.selectedPublicRepo.set(null);
    this.manifestsForSelector.set(null);
    this.selectedManifestPath.set(null);
    this.manifestFetchError.set(null);

    if (sub === 'template') {
      this.loadTemplates();
    }
  }

  // ===== Flow B — Template flow =====

  selectTemplate(template: TemplateResponseDto): void {
    // initializeFromTemplate is the single entry point that syncs deployConfig
    // (port, healthcheckPath, resourceProfile) + runtimeConfig from the template's
    // defaults. Calling .set on selectedTemplate alone would leave deployConfig
    // stuck on the initial {/health, port 3000, small} defaults and the Review
    // step would disagree with the template card.
    this.state.initializeFromTemplate(template, this.selectedCluster()?.id ?? '');
    if (!this.state.newRepoName()) {
      this.state.newRepoName.set(`${template.framework}-app`.replaceAll(/[^a-zA-Z0-9._-]/g, '-'));
    }
  }

  /** Jump forward past the picker when a template is pre-selected via query param. */
  private advanceToTemplateSettings(): void {
    this.state.initializeFromTemplate(
      this.state.selectedTemplate()!,
      this.selectedCluster()?.id ?? '',
    );
    this.currentStepIndex.set(2); // source=0, template-picker=1, template-settings=2
  }

  // ===== Flow C — Existing repo helpers =====

  /** User clicked "Switch to template flow" from the analysis or no-dockerfile branch. */
  switchToTemplateFlow(): void {
    // Reset Flow C state, switch to Flow B, land on the template picker
    this.state.resetFlowState();
    this.selectFlow('template');
    this.currentStepIndex.set(1); // template-picker
  }

  // ===== Generate step — orchestration progress helpers =====

  readonly orchestrationSteps = computed(() => {
    if (this.flowSubtype() === 'template') {
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

  private orchestrationOrder(): string[] {
    return this.orchestrationSteps().map((s) => s.id);
  }

  isOrchestrationStepDone(id: string): boolean {
    const order = this.orchestrationOrder();
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

  protected readonly orchestrationView = computed<OrchestrationStepView[]>(() =>
    this.orchestrationSteps().map((step) => {
      let state: OrchestrationStepView['state'] = 'pending';
      if (this.isOrchestrationStepDone(step.id)) state = 'done';
      else if (this.isOrchestrationStepActive(step.id)) state = 'active';
      return { id: step.id, label: step.label, state };
    }),
  );

  onPublicRepoSelected(repo: PublicRepoSearchResultDto): void {
    this.selectedPublicRepo.set(repo);
    this.selectedRepo.set(null);
    this.availableBranches.set([]);
    this.selectedBranch.set(repo.default_branch);
    this.loadBranches().then(() => {});
  }

  clearPublicRepo(): void {
    this.selectedPublicRepo.set(null);
    this.availableBranches.set([]);
    this.branchesFailed.set(false);
    this.selectedBranch.set('');
  }

  // Step: Docker image
  onImageSelected(imageRef: string): void {
    this.selectedImageRef.set(imageRef);
    this.selectedKind.set(suggestKindFromImageRef(imageRef));
  }

  clearImageRef(): void {
    this.selectedImageRef.set('');
  }

  // Step: Repository (git_build)
  selectRepository(repo: ConnectedRepository): void {
    this.selectedRepo.set(repo);
    this.selectedPublicRepo.set(null);
  }

  // Step 2: Branch & Framework
  async loadBranches(): Promise<void> {
    const publicRepo = this.selectedPublicRepo();
    const connectedRepo = this.selectedRepo();
    if (!publicRepo && !connectedRepo) return;

    this.isLoadingBranches.set(true);

    try {
      let branchNames: string[];
      if (publicRepo) {
        branchNames = await this.repoService.getPublicRepositoryBranches(publicRepo.full_name);
      } else {
        const branches = await this.repoService.getRepositoryBranches(connectedRepo!.id);
        branchNames = branches.map((b: any) => b.name || b);
      }
      this.availableBranches.set(branchNames);
      this.branchesFailed.set(false);

      // The repository's own default branch wins over any name we might favour: `main` is a
      // convention, not a fact, and a repository that calls it something else was being sent to a
      // branch it does not have.
      const currentBranch = this.selectedBranch();
      if (branchNames.length > 0 && !branchNames.includes(currentBranch)) {
        const declaredDefault = publicRepo?.default_branch ?? connectedRepo?.branch;
        this.selectedBranch.set(
          declaredDefault && branchNames.includes(declaredDefault)
            ? declaredDefault
            : branchNames[0],
        );
      }
    } catch (error) {
      // This used to offer `['main', 'master', 'develop']` — three names nobody had read from the
      // repository, presented in the same select as the real ones. A branch that does not exist
      // fails the deploy much later, with nothing pointing back here.
      console.error('Failed to load branches:', error);
      this.availableBranches.set([]);
      this.branchesFailed.set(true);
    } finally {
      this.isLoadingBranches.set(false);
    }
  }

  selectBranch(branch: string): void {
    this.selectedBranch.set(branch);

    // The flui.yaml manifest is branch-specific: refresh it and re-sync the
    // wizard state. If the new branch has no valid manifest the analysis step
    // turns invalid and deploy stays blocked.
    if (this.flowSubtype() === 'existing-repo' && this.selectedRepo()) {
      this.triggerManifestCheck().then(() => {
        const repo = this.selectedRepo();
        const manifest = this.manifestForSelector();
        if (repo && manifest?.valid) {
          this.state.initializeFromManifest(
            repo.id,
            repo.fullName,
            branch,
            manifest,
            this.selectedCluster()?.id ?? '',
          );
          if (this.currentStepId() === 'environment') {
            this.envVars.set([]);
            if (!this.prefillEnvVarsFromManifest()) {
              this.analyzeAndSuggestEnvVars();
            }
          }
        }
      });
      return;
    }

    if (this.currentStepId() === 'environment') {
      this.analyzeAndSuggestEnvVars();
    }
  }

  /**
   * Flow C analysis: fetch flui.yaml from the repo root (manifest-first).
   * The step unlocks only on a valid kind: Application manifest — no
   * Dockerfile fallback; the no-manifest branch points to `flui app init`.
   */
  async triggerManifestCheck(): Promise<void> {
    const repo = this.selectedRepo();
    if (!repo) return;

    this.isCheckingManifest.set(true);
    this.manifestsForSelector.set(null);
    this.selectedManifestPath.set(null);
    this.manifestFetchError.set(null);

    try {
      const result = await this.repoService.getFluiManifests(repo.id, this.selectedBranch());
      this.manifestsForSelector.set(result.manifests);
      const firstValid = result.manifests.find((e) => e.valid);
      if (firstValid) this.selectedManifestPath.set(firstValid.path);
    } catch (error: any) {
      this.manifestFetchError.set(error?.message || 'Failed to read flui.yaml manifests');
    } finally {
      this.isCheckingManifest.set(false);
    }
  }

  /**
   * Review step (Flow C): what only this installation can say about the
   * chosen flui.yaml against the chosen cluster — target cluster, connected
   * repository, build credentials, live capacity — via the dedicated
   * validate-only endpoint. Never blocks the deploy button on its own: a
   * `fail` still surfaces, but it is read alongside the checks, not gating.
   */
  private async runManifestChecks(clusterId: string): Promise<void> {
    const repo = this.selectedRepo();
    const manifest = this.manifestForSelector();
    if (!repo || !manifest?.valid || !manifest.content) {
      this.manifestChecks.set(null);
      return;
    }

    this.manifestChecksLoading.set(true);
    this.manifestChecksError.set(null);
    try {
      const response = await firstValueFrom(
        this.applicationsApi.applicationsControllerValidateManifest({
          yaml: manifest.content,
          clusterId,
          repoFullName: repo.fullName,
          branch: this.selectedBranch() || undefined,
        }),
      );
      this.manifestChecks.set(response.checks ?? null);
    } catch (error: any) {
      this.manifestChecksError.set(
        error?.error?.message || error?.message || 'Could not run installation checks.',
      );
      this.manifestChecks.set(null);
    } finally {
      this.manifestChecksLoading.set(false);
    }
  }

  /** Monorepo: pick which deployable (flui.yaml) this wizard run deploys. */
  selectManifest(path: string): void {
    this.selectedManifestPath.set(path);
  }

  protected installNameChanged = computed(() => {
    const declared = this.state.manifestResult()?.manifest?.metadata.name;
    const chosen = this.state.overrideName().trim();
    return !!declared && !!chosen && declared !== chosen;
  });

  protected downloadManifest(): void {
    const manifest = this.manifestForSelector();
    if (!manifest?.content) return;
    const url = URL.createObjectURL(new Blob([manifest.content], { type: 'application/yaml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = manifest.manifest?.metadata.name
      ? `${manifest.manifest.metadata.name}.flui.yaml`
      : 'flui.yaml';
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Prefill the env editor from the manifest's deploy.env. Values and
   * userInput entries become editable rows; platform-generated secrets
   * (valueFrom.generate / secretRef) are handled server-side and skipped.
   * Returns true when the manifest declares env vars (detection is skipped).
   */
  private prefillEnvVarsFromManifest(): boolean {
    const env = this.manifestForSelector()?.manifest?.deploy.env;
    if (!env?.length) return false;

    if (this.envVars().length === 0) {
      const entries = env
        .filter((e) => e.value !== undefined || e.valueFrom?.userInput)
        .map((e) => ({
          key: e.name,
          value: e.value ?? e.valueFrom?.userInput?.default ?? '',
          isSecret: e.valueFrom?.userInput?.sensitive ?? false,
        }));
      this.envVars.set(entries);
    }
    return true;
  }

  // Step 3: Env var detection
  async analyzeAndSuggestEnvVars(): Promise<void> {
    const repo = this.selectedRepo();
    const publicRepo = this.selectedPublicRepo();
    if (!repo && !publicRepo) return;

    const token = Symbol();
    this.currentAnalysisToken = token;
    this.envDetectionLoading.set(true);
    this.envDetectionError.set(null);
    this.envDetectionResult.set(null);
    this.detectedVarMeta.set(new Map());

    try {
      const analysis = repo
        ? await this.repoService.analyzeRepository(repo.id, this.selectedBranch())
        : await this.repoService.analyzePublicRepository(
            publicRepo!.clone_url,
            this.selectedBranch(),
          );
      if (this.currentAnalysisToken !== token) return; // cancelled

      // Note: we deliberately ignore `analysis.detection` here — the old
      // Railpack-era framework detection is unreliable (e.g. returns
      // "fastapi 50%" on a Flui template repo) and showing its confidence
      // in the UI was misleading. We only consume envVarSuggestions which
      // comes from parsing .env.example.
      const suggestions = analysis?.buildPlan?.envVarSuggestions as
        EnvVarDetectionResultDto | undefined;
      this.envDetectionResult.set(suggestions ?? null);

      if (suggestions?.candidates.length) {
        this.applyDetectedVars(0);
      }
    } catch {
      if (this.currentAnalysisToken === token) {
        this.envDetectionError.set('Could not analyze repository.');
      }
    } finally {
      if (this.currentAnalysisToken === token) {
        this.envDetectionLoading.set(false);
      }
    }
  }

  cancelEnvDetection(): void {
    this.currentAnalysisToken = null;
    this.envDetectionLoading.set(false);
  }

  /** Switch to Flow A (Docker image) — used by the "no dockerfile" analysis branch. */
  applyDetectedVars(candidateIndex: number, preserveKey?: string): void {
    const result = this.envDetectionResult();
    if (!result?.candidates.length) return;

    const candidate = result.candidates[candidateIndex];
    this.selectedCandidateIndex.set(candidateIndex);

    const preservedValue = preserveKey
      ? this.envVars().find((v) => v.key === preserveKey)?.value
      : undefined;

    const meta = new Map<string, DetectedEnvVarDto>();
    const vars: EnvironmentVariable[] = candidate.vars
      .filter((v) => !v.readOnly)
      .map((v) => {
        meta.set(v.name, v);
        const value =
          preservedValue !== undefined && v.name === preserveKey
            ? preservedValue
            : (v.defaultValue ?? '');
        return { key: v.name, value, isSecret: v.sensitive };
      });

    this.detectedVarMeta.set(meta);
    this.envVars.set(vars);
  }

  readonly hasUnreviewedDefaults = computed(() => {
    const meta = this.detectedVarMeta();
    if (meta.size === 0) return false;
    return this.envVars().some((v) => {
      const m = meta.get(v.key);
      return m?.defaultValue !== undefined && v.value === m.defaultValue;
    });
  });

  // Step 3: Environment Variables
  setEnvMode(mode: 'key-value' | 'json'): void {
    if (mode === 'json' && this.envMode() === 'key-value') {
      // Convert key-value to JSON
      const vars = this.envVars();
      const json: Record<string, string> = {};
      vars.forEach((v) => {
        if (v.key) json[v.key] = v.value;
      });
      this.rawEnvJson.set(JSON.stringify(json, null, 2));
    } else if (mode === 'key-value' && this.envMode() === 'json') {
      // Convert JSON to key-value
      try {
        const json = JSON.parse(this.rawEnvJson());
        const vars: EnvironmentVariable[] = Object.entries(json).map(([key, value]) => ({
          key,
          value: String(value),
          isSecret: false,
        }));
        this.envVars.set(vars);
        this.jsonError.set(null);
      } catch {
        this.jsonError.set('Invalid JSON format');
      }
    }

    this.envMode.set(mode);
  }

  addEnvVar(): void {
    this.envVars.update((vars) => [...vars, { key: '', value: '', isSecret: false }]);
  }

  removeEnvVar(index: number): void {
    this.envVars.update((vars) => vars.filter((_, i) => i !== index));
  }

  updateEnvKey(index: number, key: string): void {
    this.envVars.update((vars) => vars.map((v, i) => (i === index ? { ...v, key } : v)));
  }

  updateEnvValue(index: number, value: string): void {
    this.envVars.update((vars) => vars.map((v, i) => (i === index ? { ...v, value } : v)));
  }

  toggleEnvSecret(index: number): void {
    this.envVars.update((vars) =>
      vars.map((v, i) => (i === index ? { ...v, isSecret: !v.isSecret } : v)),
    );
  }

  updateRawEnvJson(json: string): void {
    this.rawEnvJson.set(json);

    try {
      JSON.parse(json);
      this.jsonError.set(null);
    } catch {
      this.jsonError.set('Invalid JSON format');
    }
  }

  // Step 4: Cluster
  async loadClusters(): Promise<void> {
    this.isLoadingClusters.set(true);

    try {
      await this.clusterService.loadClusters();
    } catch (error) {
      console.error('Failed to load clusters:', error);
    } finally {
      this.isLoadingClusters.set(false);
    }
  }

  selectCluster(cluster: ClusterInfo): void {
    this.selectedCluster.set(cluster);
    if (!cluster.id) return;
    // Load capabilities immediately so the exposure toggle reflects the
    // cluster's hasInternalHosting while the user is still on this step.
    this.state.clusterId.set(cluster.id);
    void this.state.fetchClusterCapabilities(cluster.id);
    // Marketplace uses the manifest-declared resources (not a profile), so it
    // has its own capacity check signal. For the other flows we run the
    // profile-based check.
    if (this.flowSubtype() === 'marketplace') {
      this.state.checkCatalogResourceAvailability(cluster.id);
      return;
    }
    this.resourceAvailability.set(null);
    this.checkResourceAvailabilityForCluster(cluster.id);
  }

  /**
   * Preflight runtime-side resource check. Reads the profile + replicas from
   * the right source depending on flow:
   *   - Flow A (image):          local signals (selectedProfile / appReplicas)
   *   - Flow B (template):       state.deployConfig()  (profile from template defaults)
   *   - Flow C (existing-repo):  state.deployConfig()  (profile picked in flui-config step)
   */
  private async checkResourceAvailabilityForCluster(clusterId: string): Promise<void> {
    const sub = this.flowSubtype();
    const profile =
      sub === 'image' ? this.selectedProfile() : this.state.deployConfig().resourceProfile;
    const replicas = sub === 'image' ? this.appReplicas() : this.state.deployConfig().minReplicas;

    this.checkingAvailability.set(true);
    try {
      const res = await firstValueFrom(
        this.clustersApi.clustersControllerCheckResourceAvailability(
          clusterId,
          profile,
          undefined,
          undefined,
          replicas,
        ),
      );
      this.resourceAvailability.set(res);
    } catch {
      this.resourceAvailability.set(null);
    } finally {
      this.checkingAvailability.set(false);
    }
  }

  private async loadProfiles(): Promise<void> {
    this.loadingProfiles.set(true);
    try {
      const res = await firstValueFrom(this.imagesApi.imagesControllerGetProfiles());
      this.availableProfiles.set(res.profiles);
      this.selectedProfile.set(res.defaultProfile);
    } catch {
      // silent — API default 'small' will apply
    } finally {
      this.loadingProfiles.set(false);
    }
  }

  getAvailabilityMessage(): string {
    const av = this.resourceAvailability();
    if (!av?.reason) return '';
    // Replicas are read from the same source used by the resource check:
    // local signal for docker_image, deployConfig for template / existing-repo.
    const replicas =
      this.flowSubtype() === 'image' ? this.appReplicas() : this.state.deployConfig().minReplicas;
    switch (av.reason) {
      case ResourceAvailabilityResponseDto.ReasonEnum.InsufficientResources:
        return `The cluster does not have enough resources for the selected profile with ${replicas} replica(s). Reduce replicas or choose a smaller profile.`;
      case ResourceAvailabilityResponseDto.ReasonEnum.AutoscalingPending:
        return 'Current resources are tight. Autoscaling will add a node automatically if needed.';
      default:
        return '';
    }
  }

  goToConfigStep(): void {
    const configIdx = this.steps().findIndex((s) => s.id === 'environment');
    if (configIdx >= 0) this.currentStepIndex.set(configIdx);
  }

  protected readonly stepIds = computed(() => this.steps().map((s) => s.id));

  protected editStep(stepId: string): void {
    const index = this.steps().findIndex((s) => s.id === stepId);
    if (index >= 0 && index < this.currentStepIndex()) this.currentStepIndex.set(index);
  }

  // Step 5: Review
  getEnvVarsCount(): number {
    if (this.envMode() === 'key-value') {
      return this.envVars().filter((v) => v.key && v.value).length;
    } else {
      try {
        const json = JSON.parse(this.rawEnvJson());
        return Object.keys(json).length;
      } catch {
        return 0;
      }
    }
  }

  getSecretVarsCount(): number {
    return this.envVars().filter((v) => v.isSecret && v.key && v.value).length;
  }

  getApplicationName(): string {
    if (this.flowSubtype() === 'marketplace') {
      return this.state.catalogDisplayName() || this.state.catalogDetail()?.name || 'app';
    }
    if (this.sourceType() === 'docker_image') {
      const ref = this.selectedImageRef();
      const imageName = ref.split(':')[0].split('/').pop() || 'app';
      return imageName;
    }
    const branch = this.selectedBranch();
    const repo = this.selectedRepo();
    if (repo) return `${repo.name}-${branch}`;
    const publicRepo = this.selectedPublicRepo();
    if (publicRepo) return `${publicRepo.name}-${branch}`;
    return 'app';
  }

  getCatalogInputsCount(): number {
    const inputs = this.state.userInputs();
    return Object.values(inputs).filter((v) => v && v.trim().length > 0).length;
  }

  getCatalogOverridesCount(): number {
    const detail = this.state.catalogDetail();
    if (!detail) return 0;
    const overrides = this.state.envOverrides();
    return detail.editableEnv.filter((env) => {
      const current = overrides[env.name];
      if (current === undefined) return false;
      return current !== (env.default ?? '');
    }).length;
  }

  getCatalogSecretsCount(): number {
    const detail = this.state.catalogDetail();
    if (!detail) return 0;
    const inputs = this.state.userInputs();
    return detail.userInputPrompts.filter((p) => p.sensitive && (inputs[p.name] ?? '').length > 0)
      .length;
  }

  readonly autoFqdnPreview = computed(() => {
    const caps = this.catalog.capabilities();
    const slug = this.state.catalogDetail()?.slug ?? 'your-app';
    const template = caps?.autoFqdnTemplate;
    if (template?.includes('{install-slug}')) {
      return template.replace('{install-slug}', `${slug}-xxxx`);
    }
    const zone = caps?.zoneName;
    return zone ? `${slug}-xxxx.${zone}` : `${slug}-xxxx`;
  });

  /** Preview of the internal URL the app will get once deployed.
   *  Uses internalHostTemplate from cluster capabilities; replaces {slug} with the
   *  slugified app name. Returns null when capabilities are not yet loaded. */
  readonly internalUrlPreview = computed<string | null>(() => {
    const template = this.catalog.capabilities()?.internalHostTemplate;
    if (!template) return null;
    const rawName = this.getApplicationName();
    const slug = stripHyphenEdges(rawName.toLowerCase().replaceAll(/[^a-z0-9-]/g, '-')) || 'app';
    return 'https://' + template.replace('{slug}', slug);
  });

  readonly catalogAuthModeLabel = computed<string | null>(() => {
    const mode = this.state.catalogAuthMode();
    return mode ? catalogAuthLabel(mode) : null;
  });

  readonly enabledFeatureLabels = computed<string[]>(() =>
    this.state
      .catalogFeatureOptions()
      .filter((o) =>
        catalogOptionEnabled(
          this.state.catalogFeatureOptions(),
          this.state.catalogFeatureToggles(),
          o.key,
        ),
      )
      .map((o) => o.label),
  );

  // Deploy — dispatches on flowSubtype
  async deployApplication(): Promise<void> {
    if (this.installPrompt.requireInstall()) return;
    if (!this.canComplete() || !this.canDeploy()) return;

    const cluster = this.selectedCluster();
    if (!cluster?.id) return;

    const sub = this.flowSubtype();

    if (sub === 'image') return this.deployImageFlow(cluster.id);
    if (sub === 'template') return this.deployTemplateFlow(cluster.id);
    if (sub === 'existing-repo') return this.deployExistingRepoFlow(cluster.id);
    if (sub === 'marketplace') return this.deployMarketplaceFlow(cluster.id);
  }

  // Flow A — Docker image
  private async deployImageFlow(clusterId: string): Promise<void> {
    this.isDeploying.set(true);
    this.deployError.set(null);
    try {
      const envVars = this.buildEnvVarsList();
      if (envVars === null) return;

      const response = await firstValueFrom(
        this.applicationsApi.applicationsControllerCreate(clusterId, {
          name: this.getApplicationName(),
          projectId: this.state.projectId() ?? undefined,
          category: CreateApplicationDto.CategoryEnum.User,
          kind: this.selectedKind() as CreateApplicationDto.KindEnum,
          sourceType: CreateApplicationDto.SourceTypeEnum.DockerImage,
          sourceConfig: {
            imageRef: this.selectedImageRef(),
            pullPolicy: 'IfNotPresent',
          },
          port: this.appPort() ?? undefined,
          replicas: this.appReplicas(),
          ...(this.appAutoscale() && this.appMaxReplicas() > this.appReplicas()
            ? {
                scaling: {
                  enabled: true,
                  minReplicas: this.appReplicas(),
                  maxReplicas: this.appMaxReplicas(),
                },
              }
            : {}),
          resourceProfile: this.selectedProfile() as CreateApplicationDto.ResourceProfileEnum,
          exposure: this.state.exposureMode(),
          env: envVars.map((v) => ({ name: v.key, value: v.value, secret: v.isSecret })),
          autoDeploy: true,
          healthProbe: this.buildHealthProbe(),
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
      this.deployError.set(msg ?? 'Failed to start deployment. Check logs for details.');
    } finally {
      this.isDeploying.set(false);
    }
  }

  // Flow B — Template
  private async deployTemplateFlow(clusterId: string): Promise<void> {
    this.isDeploying.set(true);
    this.deployError.set(null);
    try {
      // Sync cluster + env vars from local state into the service
      this.state.clusterId.set(clusterId);
      this.state.envVars.set(
        this.envVars().map((v) => ({ key: v.key, value: v.value, isSecret: v.isSecret })),
      );

      const appId = await this.state.orchestrateTemplateFlow();
      if (appId && !this.state.workflowPullRequestUrl()) {
        // Small delay so the user can see the done state, then navigate to the monitor
        setTimeout(() => {
          this.router.navigate(['/apps/deploy/gha-build', appId]);
        }, 1200);
      }
    } catch (error) {
      const msg = internalHostingErrorMessage(error);
      if (msg) this.deployError.set(msg);
    } finally {
      this.isDeploying.set(false);
    }
  }

  // Flow C — Existing repo
  private async deployExistingRepoFlow(clusterId: string): Promise<void> {
    this.isDeploying.set(true);
    this.deployError.set(null);
    try {
      this.state.clusterId.set(clusterId);
      this.state.envVars.set(
        this.envVars().map((v) => ({ key: v.key, value: v.value, isSecret: v.isSecret })),
      );

      const appId = await this.state.orchestrateExistingRepoFlow();
      if (appId) {
        setTimeout(() => {
          this.router.navigate(['/apps/deploy/gha-build', appId]);
        }, 1200);
      }
    } catch (error) {
      const msg = internalHostingErrorMessage(error);
      if (msg) this.deployError.set(msg);
    } finally {
      this.isDeploying.set(false);
    }
  }

  // Flow D — Marketplace
  private async deployMarketplaceFlow(clusterId: string): Promise<void> {
    this.isDeploying.set(true);
    try {
      this.state.clusterId.set(clusterId);
      await this.state.orchestrateMarketplaceFlow();
      // Success UI renders inline in the generate step when installPhase is 'running'
    } finally {
      this.isDeploying.set(false);
    }
  }

  async retryMarketplaceConnect(): Promise<void> {
    this.isDeploying.set(true);
    try {
      await this.state.retryMarketplaceConnect();
    } finally {
      this.isDeploying.set(false);
    }
  }

  async inspectImagePorts(): Promise<void> {
    const imageRef = this.selectedImageRef();
    if (!imageRef || imageRef === this.portDiscoveredFrom()) return;

    this.portDiscovering.set(true);
    try {
      const result = await firstValueFrom(this.imagesApi.imagesControllerInspect(imageRef));
      this.portDiscoveredFrom.set(imageRef);
      this.exposedPorts.set(result.exposedPorts ?? []);

      // Only set port if user hasn't typed one manually yet
      if (this.appPort() === null && result.suggestedPort) {
        this.appPort.set(result.suggestedPort);
        this.portAutoDetected.set(true);
      }
    } catch {
      // Silent — leave port field empty for manual input
    } finally {
      this.portDiscovering.set(false);
    }
  }

  private buildHealthProbe(): object | null {
    const type = this.probeType();
    if (type === 'none') return { type: 'none' };
    if (type === 'http')
      return {
        type: 'http',
        httpPath: this.probeHttpPath(),
        httpPort: this.appPort() ?? undefined,
        initialDelaySeconds: this.probeInitialDelay(),
        periodSeconds: this.probePeriod(),
        failureThreshold: this.probeFailureThreshold(),
      };
    if (type === 'tcp')
      return {
        type: 'tcp',
        tcpPort: this.appPort() ?? undefined,
        initialDelaySeconds: this.probeInitialDelay(),
      };
    return null;
  }

  private buildEnvVarsList(): EnvironmentVariable[] | null {
    if (this.envMode() === 'key-value') {
      return this.envVars().filter((v) => v.key && v.value);
    }
    try {
      const json = JSON.parse(this.rawEnvJson());
      return Object.entries(json).map(([key, value]) => ({
        key,
        value: String(value),
        isSecret: false,
      }));
    } catch {
      return null;
    }
  }
}
