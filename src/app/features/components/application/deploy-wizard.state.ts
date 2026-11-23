import { Injectable, computed, inject, signal } from '@angular/core';
import { WizardStepperStep } from '../../../shared/components/wizard-stepper/wizard-stepper.component';
import {
  RepositoryService,
  ConnectedRepository,
  RepositoryFluiManifest,
  RepositoryManifestEntry,
} from '../../service/repository.service';
import { ClusterService } from '../../service/cluster.service';
import { TemplateService } from '../../service/template.service';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';
import { CreateApplicationDto } from '../../../core/api/model/createApplicationDto';
import { ManifestCheckDto } from '../../../core/api/model/manifestCheckDto';
import { ResourceProfileDto } from '../../../core/api/model/resourceProfileDto';
import { ResourceAvailabilityResponseDto } from '../../../core/api/model/resourceAvailabilityResponseDto';
import { PublicRepoSearchResultDto } from '../../../core/api/model/publicRepoSearchResultDto';
import { EnvVarDetectionResultDto } from '../../../core/api/model/envVarDetectionResultDto';
import { DetectedEnvVarDto } from '../../../core/api/model/detectedEnvVarDto';
import {
  EnvironmentVariable,
  ApplicationKind,
  ApplicationKindEnum,
} from '../../model/application.models';
import { ClusterInfo } from '../../model/cluster.models';
import { GithubCredentialProblem } from '../../../core/state/github-credential';
import { WizardStep } from '../../../ui/patterns/wizard-steps';
import {
  DeployMarketplaceStepsInput,
  allStepsValidExceptLast,
  buildDeploySteps,
  templateRepoNameError,
} from './deploy-wizard-steps';

export type AnalysisBranch =
  'loading' | 'flui-ready' | 'manifest-invalid' | 'no-manifest' | 'check-failed';

@Injectable()
export class DeployWizardForm {
  private readonly state = inject(DeployWizardStateService);
  private readonly repoService = inject(RepositoryService);
  private readonly clusterService = inject(ClusterService);
  private readonly templateService = inject(TemplateService);

  readonly flowSubtype = this.state.flowSubtype;

  readonly templates = this.templateService.templates;
  readonly isLoadingTemplates = signal<boolean>(false);

  readonly currentStepIndex = signal<number>(0);
  readonly isDeploying = signal<boolean>(false);
  readonly deployError = signal<string | null>(null);

  readonly sourceType = signal<'docker_image' | 'git_build' | null>(null);

  readonly selectedImageRef = signal<string>('');
  readonly selectedKind = signal<ApplicationKind>(ApplicationKindEnum.Application);
  readonly kindOptions: { value: ApplicationKind; label: string }[] = [
    { value: ApplicationKindEnum.Database, label: 'Database' },
    { value: ApplicationKindEnum.Application, label: 'Application' },
    { value: ApplicationKindEnum.Tool, label: 'Tool' },
    { value: ApplicationKindEnum.System, label: 'System' },
  ];

  readonly isLoadingRepos = signal<boolean>(false);
  readonly selectedRepo = signal<ConnectedRepository | null>(null);
  readonly selectedPublicRepo = signal<PublicRepoSearchResultDto | null>(null);
  readonly repoTab = signal<'mine' | 'public'>('mine');
  readonly connectedRepos = this.repoService.connectedRepositories;

  readonly isLoadingBranches = signal<boolean>(false);
  readonly availableBranches = signal<string[]>([]);
  readonly selectedBranch = signal<string>('');
  readonly branchesFailed = signal<boolean>(false);
  readonly branchesProblem = signal<GithubCredentialProblem | null>(null);

  readonly envMode = signal<'key-value' | 'json'>('key-value');
  readonly envVars = signal<EnvironmentVariable[]>([]);
  readonly rawEnvJson = signal<string>('{}');
  readonly jsonError = signal<string | null>(null);

  readonly envDetectionLoading = signal(false);
  readonly envDetectionResult = signal<EnvVarDetectionResultDto | null>(null);
  readonly envDetectionError = signal<string | null>(null);
  readonly selectedCandidateIndex = signal(0);
  readonly detectedVarMeta = signal<Map<string, DetectedEnvVarDto>>(new Map());

  readonly appPort = signal<number | null>(null);
  readonly appReplicas = signal<number>(1);
  readonly appAutoscale = signal(false);
  readonly appMaxReplicas = signal<number>(3);

  readonly portDiscovering = signal<boolean>(false);
  readonly portDiscoveredFrom = signal<string>('');
  readonly exposedPorts = signal<number[]>([]);
  readonly portAutoDetected = signal<boolean>(false);

  readonly probeType = signal<'http' | 'tcp' | 'none'>('none');
  readonly probeExpanded = signal<boolean>(false);
  readonly probeHttpPath = signal<string>('/');
  readonly probeInitialDelay = signal<number>(30);
  readonly probePeriod = signal<number>(30);
  readonly probeFailureThreshold = signal<number>(3);
  readonly selectedProfile = signal<string>('small');
  readonly availableProfiles = signal<ResourceProfileDto[]>([]);
  readonly loadingProfiles = signal<boolean>(false);

  readonly resourceAvailability = signal<ResourceAvailabilityResponseDto | null>(null);
  readonly checkingAvailability = signal<boolean>(false);

  readonly isCheckingManifest = signal<boolean>(false);
  readonly manifestsForSelector = signal<RepositoryManifestEntry[] | null>(null);
  readonly selectedManifestPath = signal<string | null>(null);
  readonly manifestFetchError = signal<string | null>(null);
  readonly manifestProblem = signal<GithubCredentialProblem | null>(null);

  readonly manifestChecks = signal<ManifestCheckDto[] | null>(null);
  readonly manifestChecksLoading = signal<boolean>(false);
  readonly manifestChecksError = signal<string | null>(null);

  readonly isLoadingClusters = signal<boolean>(false);
  readonly selectedCluster = signal<ClusterInfo | null>(null);
  readonly allClusters = this.clusterService.clusters;
  readonly activeClusters = computed(() => this.allClusters().filter((c) => c.status === 'active'));

  readonly selectedProfileInfo = computed(
    () => this.availableProfiles().find((p) => p.name === this.selectedProfile()) ?? null,
  );

  readonly validManifests = computed<RepositoryManifestEntry[]>(() =>
    (this.manifestsForSelector() ?? []).filter((e) => e.valid),
  );

  readonly invalidManifests = computed<RepositoryManifestEntry[]>(() =>
    (this.manifestsForSelector() ?? []).filter((e) => !e.valid),
  );

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

  readonly analysisBranch = computed<AnalysisBranch>(() => {
    if (this.isCheckingManifest()) return 'loading';
    if (this.manifestFetchError()) return 'check-failed';
    const entries = this.manifestsForSelector();
    if (!entries) return 'loading';
    if (entries.length === 0) return 'no-manifest';
    return this.validManifests().length > 0 ? 'flui-ready' : 'manifest-invalid';
  });

  readonly templateNameError = computed(() => templateRepoNameError(this.state.newRepoName()));

  readonly steps = computed<WizardStepperStep[]>(() => {
    const flow = this.flowSubtype();
    return buildDeploySteps({
      currentIndex: this.currentStepIndex(),
      flow,
      clusterSelected: !!this.selectedCluster(),
      masterPlacementBlocked:
        this.state.allowMasterPlacementRelevant() && !this.state.allowMasterPlacement(),
      imageSelected: flow === 'image' && !!this.selectedImageRef(),
      templateSelected: flow === 'template' && !!this.state.selectedTemplate(),
      templateSettingsValid:
        flow === 'template' && !!this.state.newRepoName() && !this.templateNameError(),
      repoSelected:
        flow === 'existing-repo' && !!(this.selectedRepo() || this.selectedPublicRepo()),
      analysisReady: flow === 'existing-repo' && this.analysisBranch() === 'flui-ready',
      marketplace: flow === 'marketplace' ? this.marketplaceStepsInput() : null,
    });
  });

  private marketplaceStepsInput(): DeployMarketplaceStepsInput {
    const detail = this.state.catalogDetail();
    const s = this.state;
    return {
      hasDetail: !!detail,
      displayNameValid: !!detail && s.catalogDisplayNameValid(),
      hasPrompts: (detail?.userInputPrompts?.length ?? 0) > 0,
      hasDefaultCredentials: !!detail?.defaultCredentials,
      hasEditableEnv: (detail?.editableEnv?.length ?? 0) > 0,
      inputsValid: s.catalogInputsValid(),
      needsFeatures: s.needsCatalogFeaturesStep(),
      needsDependencyPicker: s.needsDependencyPicker(),
      dependenciesValid: s.catalogDependenciesValid(),
      needsLinkedBbPicker: s.needsLinkedBbPicker(),
      exposesPublicEndpoint: detail?.exposesPublicEndpoint !== false,
      internalExposure: s.exposureMode() === CreateApplicationDto.ExposureEnum.Internal,
      domainValid: s.catalogDomainValid(),
    };
  }

  readonly currentStep = computed(() => this.steps()[this.currentStepIndex()]);
  readonly currentStepId = computed(() => this.steps()[this.currentStepIndex()]?.id ?? '');
  readonly stepIds = computed(() => this.steps().map((s) => s.id));
  readonly wizardSteps = computed<WizardStep[]>(() =>
    this.steps().map((s) => ({ name: s.title.trim() })),
  );

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

  readonly canDeploy = computed(() => {
    if (this.flowSubtype() === 'marketplace') {
      if (this.state.catalogDetail()?.installable === false) return false;
      return this.state.canSubmitMarketplaceResources();
    }
    const av = this.resourceAvailability();
    if (!av) return true;
    return av.canDeploy;
  });

  readonly deployReplicas = computed(() =>
    this.flowSubtype() === 'image' ? this.appReplicas() : this.state.deployConfig().minReplicas,
  );

  canProceed(): boolean {
    return this.currentStep().isValid;
  }

  canComplete(): boolean {
    return allStepsValidExceptLast(this.steps());
  }
}
