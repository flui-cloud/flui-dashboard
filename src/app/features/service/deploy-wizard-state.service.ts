import { Injectable, signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RepositoryAnalysisDto } from '../../core/api/model/repositoryAnalysisDto';
import { DockerfileAnalysisDto } from '../../core/api/model/dockerfileAnalysisDto';
import { ExtractedEnvVarDto } from '../../core/api/model/extractedEnvVarDto';
import { TemplateResponseDto } from '../../core/api/model/templateResponseDto';
import { CreateApplicationDto } from '../../core/api/model/createApplicationDto';
import { ApplicationsService } from '../../core/api/api/applications.service';
import { ApplicationService, GenerateWorkflowParams } from './application.service';
import { RepositoryService, RepositoryFluiManifest } from './repository.service';
import { TemplateService } from './template.service';
import { CatalogService } from './catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { InfrastructureClustersService } from '../../core/api/api/infrastructureClusters.service';
import {
  parseBackendFieldErrors,
  validatePrompt,
} from '../model/prompt-validation';
import {
  isValidCpuString,
  isValidMemoryString,
  parseCpuToMillicores,
  parseMemoryToMi,
} from '../model/k8s-quantities';
import { internalHostingErrorMessage } from '../model/app-exposure';
import {
  CatalogAuthSpecDto,
  CatalogDetailResponseDto,
  CatalogInstallResponseDto,
  CatalogOptionDto,
  CatalogReusableInstanceDto,
  DependencyChoiceDto,
  InstallCatalogAppDto,
  ResourceAvailabilityResponseDto,
  ResourceOverridesDto,
} from '../../core/api/model/models';

export interface DependencyChoiceState {
  mode: DependencyChoiceDto.ModeEnum;
  existingApplicationId?: string;
}

export interface CatalogResourceOverridesForm {
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  replicas: string; // kept as string so empty-input renders cleanly; parsed at build time
}

const EMPTY_OVERRIDES: CatalogResourceOverridesForm = {
  cpuRequest: '',
  cpuLimit: '',
  memoryRequest: '',
  memoryLimit: '',
  replicas: '',
};

export interface GhaEnvVarEntry {
  key: string;
  value: string;
  isSecret: boolean;
  source?: string;
}

export interface GhaDeployConfig {
  port: number;
  healthcheckPath: string;
  resourceProfile: 'nano' | 'micro' | 'small' | 'medium' | 'large' | 'xlarge';
  minReplicas: number;
  maxReplicas: number;
}

export interface GhaRuntimeConfig {
  nodeVersion?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  javaVersion?: string;
  buildTool?: 'maven' | 'gradle';
  dotnetVersion?: string;
}

export type FlowSubtype = 'image' | 'template' | 'existing-repo' | 'marketplace' | null;

export type DefaultsSource = 'template' | 'manifest' | 'dockerfile-analysis' | 'manual';

export type TemplateOrchestrationPhase =
  | 'idle'
  | 'creating-repo'
  | 'registering-repo'
  | 'creating-app'
  | 'generating-workflow'
  | 'done'
  | 'error';

export type MarketplaceInstallPhase =
  | 'idle'
  | 'submitting'
  | 'polling'
  | 'running'
  | 'failed';

const NODE_FRAMEWORKS = new Set(['nextjs', 'nuxt', 'svelte-kit', 'sveltekit', 'nestjs', 'angular', 'express']);
const JVM_FRAMEWORKS = new Set(['spring-boot', 'springboot']);
const DOTNET_FRAMEWORKS = new Set(['aspnet-core', 'aspnetcore']);

/**
 * Unified state + orchestration for the deploy wizard.
 *
 * Drives all three flows:
 *   - Flow A: docker_image (image ref -> create app + auto-deploy)
 *   - Flow B: git_build + template (templates/use -> repositories/import -> applications -> generate-workflow)
 *   - Flow C: git_build + existing repo (applications -> generate-workflow, manual config when no Flui Dockerfile)
 *
 * Source of truth for default port/healthcheck/resources, in order:
 *   1. selectedTemplate (Flow B) - template.port, template.healthcheckPath, buildTool
 *   2. analysisResult.dockerfileAnalysis (Flow C Flui-ready) - dockerfileAnalysis.port
 *   3. Manual user input (Flow C custom Dockerfile)
 *
 */
@Injectable()
export class DeployWizardStateService {
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly appService = inject(ApplicationService);
  private readonly repositoryService = inject(RepositoryService);
  private readonly templateService = inject(TemplateService);
  private readonly catalogService = inject(CatalogService);
  private readonly notifications = inject(NotificationService);
  private readonly clustersApi = inject(InfrastructureClustersService);

  // ========== Flow routing ==========
  readonly sourceType = signal<'docker_image' | 'git_build' | null>(null);
  readonly flowSubtype = signal<FlowSubtype>(null);

  // ========== Flow B (template) state ==========
  readonly selectedTemplate = signal<TemplateResponseDto | null>(null);
  readonly newRepoName = signal<string>('');
  readonly newRepoOwner = signal<string>('');
  readonly newRepoPrivate = signal<boolean>(true);
  readonly createdRepoFullName = signal<string | null>(null);
  readonly importedRepositoryId = signal<string | null>(null);

  // ========== Flow C (existing repo) state ==========
  readonly repositoryId = signal<string>('');
  readonly repoFullName = signal<string>('');
  readonly branch = signal<string>('');
  readonly manifestResult = signal<RepositoryFluiManifest | null>(null);
  readonly analysisResult = signal<RepositoryAnalysisDto | null>(null);
  readonly dockerfileAnalysis = signal<DockerfileAnalysisDto | null>(null);
  readonly confirmedFramework = signal<string>('');

  // ========== Common state ==========
  readonly clusterId = signal<string>('');
  readonly applicationId = signal<string | null>(null);
  readonly envVars = signal<GhaEnvVarEntry[]>([]);
  /** Exposure mode for non-catalog flows (image, git_build). Catalog installs read
   *  this from the manifest via `CatalogDetailResponseDto.exposure` instead. */
  readonly exposureMode = signal<CreateApplicationDto.ExposureEnum>(
    CreateApplicationDto.ExposureEnum.Public,
  );
  readonly deployConfig = signal<GhaDeployConfig>({
    port: 3000,
    healthcheckPath: '/health',
    resourceProfile: 'small',
    minReplicas: 1,
    maxReplicas: 1,
  });
  readonly runtimeConfig = signal<GhaRuntimeConfig>({
    nodeVersion: '20',
    packageManager: 'npm',
  });

  // ========== Template orchestration state ==========
  readonly orchestrationPhase = signal<TemplateOrchestrationPhase>('idle');
  readonly orchestrationError = signal<string | null>(null);

  // ========== Marketplace (catalog) state ==========
  readonly catalogSlug = signal<string | null>(null);
  readonly catalogDetail = signal<CatalogDetailResponseDto | null>(null);
  readonly catalogDisplayName = signal<string>('');
  readonly userInputs = signal<Record<string, string>>({});
  /** Second-field values for prompts that declare `confirm: true`. */
  readonly userInputConfirms = signal<Record<string, string>>({});
  /** Per-field backend errors extracted from a 400 response. Cleared on each submit and on user edit of the matching field. */
  readonly backendFieldErrors = signal<Record<string, string>>({});
  readonly envOverrides = signal<Record<string, string>>({});
  readonly catalogAuthMode = signal<CatalogAuthSpecDto.ModesEnum | null>(null);
  readonly catalogFeatureToggles = signal<Record<string, boolean>>({});
  /** 'auto' → backend assigns {install-slug}.{zoneName}; 'custom' → user-provided FQDN; 'skip' → no endpoint. */
  readonly domainMode = signal<'auto' | 'custom' | 'skip'>('auto');
  readonly requestedDomain = signal<string>('');
  /** Provision a per-app TLS certificate for the endpoint; off → DNS-only HTTP (overrides manifest domain.tls). Only relevant when an endpoint is created. */
  readonly enableTls = signal<boolean>(true);
  /** Building-block install id to auto-Connect to immediately after a successful install. Passed to POST /catalog/installs/:id/connect (not in the install DTO anymore). */
  readonly pendingLinkedInstallId = signal<string | null>(null);
  /** Pre-set when the install came from the BB detail page — the picker is skipped in that case. */
  readonly linkedInstallIdPreset = signal<boolean>(false);
  readonly reusableInstances = signal<CatalogReusableInstanceDto[]>([]);
  readonly reusableInstancesLoading = signal<boolean>(false);
  readonly reusableInstancesError = signal<string | null>(null);

  /** Per-alias choice for manifest-declared dependencies (e.g. ferretdb → { postgres: {...} }). */
  readonly dependencyChoices = signal<Record<string, DependencyChoiceState>>({});
  /** Reusable BB instances available for each dependency ref (key = ref slug, e.g. "postgresql"). */
  readonly dependencyInstances = signal<Record<string, CatalogReusableInstanceDto[]>>({});
  readonly dependencyInstancesLoading = signal<boolean>(false);
  readonly dependencyInstancesError = signal<string | null>(null);
  /** Catalog detail for each dependency ref — used to fold their resource footprint
   *  into the cluster capacity check when the user picks DEDICATED. */
  readonly dependencyDetails = signal<Record<string, CatalogDetailResponseDto>>({});
  readonly currentInstall = signal<CatalogInstallResponseDto | null>(null);
  readonly installPhase = signal<MarketplaceInstallPhase>('idle');
  readonly installError = signal<string | null>(null);

  // ========== Catalog resource overrides + capacity check ==========
  readonly catalogResourceOverrides = signal<CatalogResourceOverridesForm>({ ...EMPTY_OVERRIDES });
  readonly catalogAvailability = signal<ResourceAvailabilityResponseDto | null>(null);
  readonly catalogAvailabilityLoading = signal<boolean>(false);
  readonly catalogAvailabilityError = signal<string | null>(null);
  /** User opted in to install despite a red capacity check. Reset on each re-check. */
  readonly forceInstallDespiteCapacity = signal<boolean>(false);
  /**
   * For dedicated-storage apps on a worker-less cluster: user opted to place the
   * components on the control-plane node instead of requiring a worker. Only
   * surfaced (and only relevant) when {@link allowMasterPlacementRelevant} holds.
   */
  readonly allowMasterPlacement = signal<boolean>(false);
  /**
   * True when the master-placement toggle should be shown: the catalog app uses
   * dedicated storage AND the chosen cluster has no worker node. Computed by
   * {@link refreshMasterPlacementRelevance} when the wizard enters Review.
   */
  readonly allowMasterPlacementRelevant = signal<boolean>(false);

  /** True when every non-empty override string matches the backend regex. Empty = use manifest default. */
  readonly catalogOverridesValid = computed(() => {
    const o = this.catalogResourceOverrides();
    if (o.cpuRequest && !isValidCpuString(o.cpuRequest)) return false;
    if (o.cpuLimit && !isValidCpuString(o.cpuLimit)) return false;
    if (o.memoryRequest && !isValidMemoryString(o.memoryRequest)) return false;
    if (o.memoryLimit && !isValidMemoryString(o.memoryLimit)) return false;
    if (o.replicas) {
      const n = Number.parseInt(o.replicas, 10);
      if (!Number.isFinite(n) || n < 1 || n > 20) return false;
    }
    return true;
  });

  /** Effective cpu (request) / memory (peak = limit, else request) / replicas used for the
   *  capacity check — mirrors the server-side gate so the wizard and backend agree.
   *  CPU is compressible (gate on requests); memory is incompressible (gate on the peak).
   *  When a manifest dependency is set to DEDICATED, its own resource footprint
   *  is folded in so the cluster sees the combined cost of installing both apps. */
  readonly effectiveCatalogResources = computed(() => {
    const detail = this.catalogDetail();
    const o = this.catalogResourceOverrides();
    const cpuStr = o.cpuRequest || detail?.resources?.requests?.cpu || '';
    const memLimit = o.memoryLimit || detail?.resources?.limits?.memory || '';
    const memRequest = o.memoryRequest || detail?.resources?.requests?.memory || '';
    const memStr = memLimit || memRequest;
    const replicasNum = o.replicas
      ? Number.parseInt(o.replicas, 10)
      : detail?.replicas ?? 1;
    const baseReplicas = Number.isFinite(replicasNum) && replicasNum > 0 ? replicasNum : 1;

    let cpuMc = parseCpuToMillicores(cpuStr) * baseReplicas;
    let memMi = parseMemoryToMi(memStr) * baseReplicas;

    const choices = this.dependencyChoices();
    const depDetails = this.dependencyDetails();
    for (const dep of this.catalogDependencies()) {
      const choice = choices[dep.as];
      if (choice?.mode !== DependencyChoiceDto.ModeEnum.Dedicated) continue;
      const depDetail = depDetails[dep.ref];
      if (!depDetail) continue;
      const depReplicas = depDetail.replicas && depDetail.replicas > 0 ? depDetail.replicas : 1;
      const depMem =
        depDetail.resources?.limits?.memory ?? depDetail.resources?.requests?.memory ?? '';
      cpuMc += parseCpuToMillicores(depDetail.resources?.requests?.cpu ?? '') * depReplicas;
      memMi += parseMemoryToMi(depMem) * depReplicas;
    }

    return {
      cpuStr,
      memStr,
      cpuMc,
      memMi,
      replicas: baseReplicas,
    };
  });

  /** True when a user-set override differs from the manifest default (→ include in submit payload). */
  readonly catalogResourcesCustomized = computed(() => {
    const o = this.catalogResourceOverrides();
    const d = this.catalogDetail();
    if (!d) return false;
    const differs = (value: string, manifestValue: string | undefined) =>
      !!value && value !== (manifestValue ?? '');
    return (
      differs(o.cpuRequest, d.resources?.requests?.cpu) ||
      differs(o.cpuLimit, d.resources?.limits?.cpu) ||
      differs(o.memoryRequest, d.resources?.requests?.memory) ||
      differs(o.memoryLimit, d.resources?.limits?.memory) ||
      (!!o.replicas && Number.parseInt(o.replicas, 10) !== d.replicas)
    );
  });

  /** Submit-gate for the marketplace flow: valid override strings AND (capacity OK OR user forced). */
  readonly canSubmitMarketplaceResources = computed(() => {
    if (!this.catalogOverridesValid()) return false;
    const av = this.catalogAvailability();
    if (!av) return true; // not yet checked — don't block
    if (av.canDeploy) return true;
    return this.forceInstallDespiteCapacity();
  });

  /**
   * Live per-prompt error map. A prompt is valid when its entry is null.
   * Applied rules (manifest-declared): minLength → maxLength → regex → confirm.
   */
  readonly catalogInputErrors = computed<Record<string, string | null>>(() => {
    const detail = this.catalogDetail();
    if (!detail) return {};
    const inputs = this.userInputs();
    const confirms = this.userInputConfirms();
    const out: Record<string, string | null> = {};
    for (const prompt of detail.userInputPrompts) {
      out[prompt.name] = validatePrompt(
        prompt,
        inputs[prompt.name] ?? '',
        prompt.confirm ? confirms[prompt.name] ?? '' : undefined,
      );
    }
    return out;
  });

  readonly catalogInputsValid = computed(() => {
    const errors = this.catalogInputErrors();
    return Object.values(errors).every((e) => e === null);
  });

  readonly catalogDomainValid = computed(() => {
    const mode = this.domainMode();
    if (mode === 'skip') return true;
    if (mode === 'auto') return true;
    const domain = this.requestedDomain().trim();
    return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
      domain,
    );
  });

  readonly catalogDisplayNameValid = computed(
    () => this.catalogDisplayName().trim().length > 0,
  );

  readonly catalogAuthModes = computed<CatalogAuthSpecDto.ModesEnum[]>(
    () => this.catalogDetail()?.auth?.modes ?? [],
  );

  readonly catalogAuthDefault = computed<CatalogAuthSpecDto.DefaultEnum | null>(
    () => this.catalogDetail()?.auth?.default ?? null,
  );

  readonly catalogHasAuthChoice = computed(() => this.catalogAuthModes().length > 1);

  readonly catalogFeatureOptions = computed<CatalogOptionDto[]>(
    () => this.catalogDetail()?.options ?? [],
  );

  readonly needsCatalogFeaturesStep = computed(
    () => this.catalogHasAuthChoice() || this.catalogFeatureOptions().length > 0,
  );

  /** True when the selected cluster supports internal apps. Drives the visibility
   *  of the "Internal" exposure option in the non-catalog wizard. */
  readonly canUseInternalExposure = computed(
    () => this.catalogService.capabilities()?.hasInternalHosting === true,
  );

  /** Granular list of missing prerequisites when the cluster has no internal hosting. */
  readonly internalHostingMissing = computed(
    () => this.catalogService.capabilities()?.internalHostingMissing ?? [],
  );

  /** All building-block slugs this catalog app can link to (e.g. dbgate → mariadb/postgresql/valkey). */
  readonly linkedBbRefs = computed<string[]>(() => {
    const links = this.catalogDetail()?.linkedBuildingBlocks as
      | Array<{ ref?: string }>
      | undefined;
    if (!links?.length) return [];
    return links.map((l) => l?.ref).filter((r): r is string => !!r);
  });

  /** Primary BB slug — first entry of linkedBbRefs, kept for single-target labels. */
  readonly linkedBbRef = computed<string | null>(() => this.linkedBbRefs()[0] ?? null);

  readonly needsLinkedBbPicker = computed(
    () => !!this.linkedBbRef() && !this.linkedInstallIdPreset(),
  );

  readonly catalogLinkedBbValid = computed(
    () => !this.needsLinkedBbPicker() || !!this.pendingLinkedInstallId(),
  );

  /** Manifest-declared dependencies — empty array when none. */
  readonly catalogDependencies = computed(() =>
    this.catalogDetail()?.dependencies ?? [],
  );

  readonly needsDependencyPicker = computed(
    () => this.catalogDependencies().length > 0,
  );

  /** Every required dependency has a valid choice: DEDICATED, or REUSE_EXISTING with an id. */
  readonly catalogDependenciesValid = computed(() => {
    const deps = this.catalogDependencies();
    if (deps.length === 0) return true;
    const choices = this.dependencyChoices();
    for (const dep of deps) {
      const choice = choices[dep.as];
      if (!choice) {
        if (dep.required) return false;
        continue;
      }
      if (
        choice.mode === DependencyChoiceDto.ModeEnum.ReuseExisting &&
        !choice.existingApplicationId
      ) {
        return false;
      }
    }
    return true;
  });

  readonly selectedReusableInstance = computed<CatalogReusableInstanceDto | null>(() => {
    const id = this.pendingLinkedInstallId();
    if (!id) return null;
    return this.reusableInstances().find((i) => i.catalogInstallId === id) ?? null;
  });

  // ========== Derived ==========
  readonly isFluiManaged = computed(() => {
    if (this.flowSubtype() === 'template') return true;
    return this.dockerfileAnalysis()?.isFluiManaged ?? false;
  });

  readonly defaultsSource = computed<DefaultsSource>(() => {
    if (this.flowSubtype() === 'template' && this.selectedTemplate()) return 'template';
    if (this.manifestResult()?.valid) return 'manifest';
    if (this.dockerfileAnalysis()?.port) return 'dockerfile-analysis';
    return 'manual';
  });

  readonly needsNodeConfig = computed(() => NODE_FRAMEWORKS.has(this.confirmedFramework()));
  readonly needsJvmConfig = computed(() => JVM_FRAMEWORKS.has(this.confirmedFramework()));
  readonly needsDotnetConfig = computed(() => DOTNET_FRAMEWORKS.has(this.confirmedFramework()));
  readonly needsRuntimeConfig = computed(
    () => this.needsNodeConfig() || this.needsJvmConfig() || this.needsDotnetConfig()
  );

  // ========== Initialisers ==========

  /**
   * Initialize from an analyzed existing repository (Flow C).
   *
   * Default port/healthcheck resolution (in priority order):
   *   1. dockerfileAnalysis.port (when present — Flui-managed Dockerfile with EXPOSE)
   *   2. matching template from the catalog, looked up by detected framework
   *      → template.port and template.healthcheckPath (e.g. Next.js → /api/health,
   *        Spring Boot → /actuator/health). This is critical: a wrong healthcheck
   *        path crashes the pod at the readiness probe, so we can't fall back to
   *        a blind /health default when the framework is known to Flui.
   *   3. zero / '/health' — only when we can't recognise the framework at all;
   *      the Flui Config step will force the user to fill it in.
   */
  initialize(repositoryId: string, branch: string, analysis: RepositoryAnalysisDto, clusterId: string): void {
    this.flowSubtype.set('existing-repo');
    this.sourceType.set('git_build');
    this.repositoryId.set(repositoryId);
    this.branch.set(branch);
    this.analysisResult.set(analysis);
    this.clusterId.set(clusterId);

    if (analysis.dockerfileAnalysis) {
      this.dockerfileAnalysis.set(analysis.dockerfileAnalysis);
    }

    const framework = analysis.detection?.framework ?? '';
    this.confirmedFramework.set(framework);

    // Look up the matching template to borrow its healthcheck path (and port
    // as fallback). templates() may be empty if the catalog hasn't loaded yet,
    // in which case matchingTemplate will be undefined and we fall back to the
    // bare defaults — the Flui Config step still gives the user a chance to fix.
    const matchingTemplate = framework
      ? this.templateService.templates().find(t => t.framework === framework)
      : undefined;

    const dockerfilePort = analysis.dockerfileAnalysis?.port;
    this.deployConfig.set({
      port: dockerfilePort ?? matchingTemplate?.port ?? 0,
      healthcheckPath: matchingTemplate?.healthcheckPath ?? '/health',
      resourceProfile: 'small',
      minReplicas: 1,
      maxReplicas: 1,
    });

    if (JVM_FRAMEWORKS.has(framework)) {
      this.runtimeConfig.set({
        javaVersion: '21',
        buildTool: matchingTemplate?.buildTool?.includes('gradle') ? 'gradle' : 'maven',
      });
    } else if (DOTNET_FRAMEWORKS.has(framework)) {
      this.runtimeConfig.set({ dotnetVersion: '8.0' });
    } else {
      this.runtimeConfig.set({ nodeVersion: '20', packageManager: 'npm' });
    }
  }

  /**
   * Initialize from a repository flui.yaml manifest (Flow C, manifest-first).
   * The manifest IS the source of truth for port/healthcheck/resources/scaling —
   * mirror of the CLI `flui deploy` flow. No framework detection, no Dockerfile
   * analysis: the Dockerfile is just the build recipe referenced by the manifest.
   */
  initializeFromManifest(
    repositoryId: string,
    repoFullName: string,
    branch: string,
    manifest: RepositoryFluiManifest,
    clusterId: string,
  ): void {
    this.flowSubtype.set('existing-repo');
    this.sourceType.set('git_build');
    this.repositoryId.set(repositoryId);
    this.repoFullName.set(repoFullName);
    this.branch.set(branch);
    this.manifestResult.set(manifest);
    this.clusterId.set(clusterId);

    const spec = manifest.manifest;
    if (!spec) return;

    this.deployConfig.set({
      port: spec.deploy.port,
      healthcheckPath: spec.deploy.healthcheck?.path ?? '/health',
      resourceProfile: spec.deploy.resources?.profile ?? 'small',
      minReplicas: spec.deploy.scaling?.min ?? 1,
      maxReplicas: spec.deploy.scaling?.max ?? 1,
    });

    if (spec.deploy.exposure) {
      this.exposureMode.set(
        spec.deploy.exposure === 'internal'
          ? CreateApplicationDto.ExposureEnum.Internal
          : CreateApplicationDto.ExposureEnum.Public,
      );
    }
  }

  /**
   * Initialize from a Flui template (Flow B). The template IS the source of truth
   * for port/healthcheck/resources/runtime. Template repos always ship with a
   * Flui-managed Dockerfile so isFluiManaged is always true for this flow.
   */
  initializeFromTemplate(template: TemplateResponseDto, clusterId: string): void {
    this.flowSubtype.set('template');
    this.sourceType.set('git_build');
    this.selectedTemplate.set(template);
    this.confirmedFramework.set(template.framework);
    this.clusterId.set(clusterId);

    this.deployConfig.set({
      port: template.port,
      healthcheckPath: template.healthcheckPath ?? '/health',
      resourceProfile: 'small',
      minReplicas: 1,
      maxReplicas: 1,
    });

    if (JVM_FRAMEWORKS.has(template.framework)) {
      this.runtimeConfig.set({ javaVersion: '21', buildTool: template.buildTool?.includes('gradle') ? 'gradle' : 'maven' });
    } else if (DOTNET_FRAMEWORKS.has(template.framework)) {
      this.runtimeConfig.set({ dotnetVersion: '8.0' });
    } else {
      this.runtimeConfig.set({ nodeVersion: '20', packageManager: 'npm' });
    }

    if (!this.newRepoName()) {
      this.newRepoName.set(`${template.framework}-app`.replaceAll(/[^a-zA-Z0-9._-]/g, '-'));
    }
  }

  /** Reset state specific to Flow B or Flow C when the user switches subflows mid-wizard. */
  resetFlowState(): void {
    this.selectedTemplate.set(null);
    this.newRepoName.set('');
    this.newRepoOwner.set('');
    this.newRepoPrivate.set(true);
    this.createdRepoFullName.set(null);
    this.importedRepositoryId.set(null);

    this.repositoryId.set('');
    this.repoFullName.set('');
    this.branch.set('');
    this.manifestResult.set(null);
    this.analysisResult.set(null);
    this.dockerfileAnalysis.set(null);
    this.confirmedFramework.set('');

    this.applicationId.set(null);
    this.envVars.set([]);
    this.orchestrationPhase.set('idle');
    this.orchestrationError.set(null);

    this.catalogSlug.set(null);
    this.catalogDetail.set(null);
    this.catalogDisplayName.set('');
    this.userInputs.set({});
    this.userInputConfirms.set({});
    this.backendFieldErrors.set({});
    this.envOverrides.set({});
    this.catalogAuthMode.set(null);
    this.catalogFeatureToggles.set({});
    this.domainMode.set('auto');
    this.requestedDomain.set('');
    this.enableTls.set(true);
    this.currentInstall.set(null);
    this.installPhase.set('idle');
    this.installError.set(null);
    this.catalogResourceOverrides.set({ ...EMPTY_OVERRIDES });
    this.catalogAvailability.set(null);
    this.catalogAvailabilityLoading.set(false);
    this.catalogAvailabilityError.set(null);
    this.forceInstallDespiteCapacity.set(false);
    this.allowMasterPlacement.set(false);
    this.allowMasterPlacementRelevant.set(false);
    this.dependencyChoices.set({});
    this.dependencyInstances.set({});
    this.dependencyDetails.set({});
    this.dependencyInstancesError.set(null);
    this.catalogService.resetCapabilities();
  }

  /**
   * Run the cluster capacity check against the catalog's *effective* resources
   * (manifest, optionally overridden by the user). Resets `forceInstallDespiteCapacity`
   * on every invocation so the user re-confirms after any change.
   */
  async checkCatalogResourceAvailability(clusterId: string): Promise<void> {
    const slug = this.catalogSlug();
    if (!clusterId || !slug) {
      this.catalogAvailability.set(null);
      return;
    }
    this.catalogAvailabilityLoading.set(true);
    this.catalogAvailabilityError.set(null);
    this.forceInstallDespiteCapacity.set(false);
    try {
      const featureToggles = this.catalogFeatureToggles();
      const overrides = this.buildResourceOverridesPayload();
      const response = await this.catalogService.previewCapacity(slug, {
        clusterId,
        ...(Object.keys(featureToggles).length > 0
          ? { options: { ...featureToggles } }
          : {}),
        ...(overrides ? { resourceOverrides: overrides } : {}),
      });
      this.catalogAvailability.set(response);
    } catch (e: any) {
      this.catalogAvailabilityError.set(
        e?.error?.message || e?.message || 'Failed to check cluster capacity.',
      );
      this.catalogAvailability.set(null);
    } finally {
      this.catalogAvailabilityLoading.set(false);
    }
  }

  /**
   * Decide whether to offer the "run on the control-plane node" toggle: only when
   * the catalog app uses dedicated (node-local) storage AND the chosen cluster has
   * no worker node — exactly the case that would otherwise fail the deploy with
   * NO_WORKER_FOR_DEDICATED_APP. If we can't determine node composition we hide the
   * toggle (the backend still guards the deploy).
   */
  async refreshMasterPlacementRelevance(clusterId: string): Promise<void> {
    const detail = this.catalogDetail();
    if (!clusterId || detail?.persistenceScope !== 'dedicated') {
      this.allowMasterPlacementRelevant.set(false);
      this.allowMasterPlacement.set(false);
      return;
    }
    try {
      const nodes = await firstValueFrom(
        this.clustersApi.clustersControllerGetClusterNodes(clusterId),
      );
      const workerCount = Array.isArray(nodes)
        ? nodes.filter(
            (n: { nodeType?: string }) => n?.nodeType === 'worker',
          ).length
        : 0;
      const relevant = workerCount === 0;
      this.allowMasterPlacementRelevant.set(relevant);
      // Pre-select the safe default: a dedicated app on a worker-less cluster can
      // only run on the control-plane node. The user may untick it, but the wizard
      // then blocks the install (it would otherwise fail with NO_WORKER_FOR_DEDICATED_APP).
      this.allowMasterPlacement.set(relevant);
    } catch {
      this.allowMasterPlacementRelevant.set(false);
      this.allowMasterPlacement.set(false);
    }
  }

  /**
   * Build the `resourceOverrides` field for the install DTO from the current
   * form state. Returns undefined when the user hasn't customized anything —
   * that way the backend uses the manifest defaults untouched.
   */
  buildResourceOverridesPayload(): ResourceOverridesDto | undefined {
    const o = this.catalogResourceOverrides();
    const d = this.catalogDetail();
    if (!d) return undefined;
    const dto: ResourceOverridesDto = {};
    const cpu: { request?: string; limit?: string } = {};
    if (o.cpuRequest && o.cpuRequest !== d.resources?.requests?.cpu) cpu.request = o.cpuRequest;
    if (o.cpuLimit && o.cpuLimit !== d.resources?.limits?.cpu) cpu.limit = o.cpuLimit;
    if (cpu.request || cpu.limit) dto.cpu = cpu;

    const memory: { request?: string; limit?: string } = {};
    if (o.memoryRequest && o.memoryRequest !== d.resources?.requests?.memory)
      memory.request = o.memoryRequest;
    if (o.memoryLimit && o.memoryLimit !== d.resources?.limits?.memory)
      memory.limit = o.memoryLimit;
    if (memory.request || memory.limit) dto.memory = memory;

    if (o.replicas) {
      const n = Number.parseInt(o.replicas, 10);
      if (Number.isFinite(n) && n > 0 && n !== d.replicas) dto.replicas = n;
    }

    return Object.keys(dto).length > 0 ? dto : undefined;
  }

  buildDependencyChoicesPayload(): DependencyChoiceDto[] | undefined {
    const deps = this.catalogDependencies();
    if (deps.length === 0) return undefined;
    const choices = this.dependencyChoices();
    const payload: DependencyChoiceDto[] = [];
    for (const dep of deps) {
      const choice = choices[dep.as] ?? { mode: DependencyChoiceDto.ModeEnum.Dedicated };
      const entry: DependencyChoiceDto = { alias: dep.as, mode: choice.mode };
      if (
        choice.mode === DependencyChoiceDto.ModeEnum.ReuseExisting &&
        choice.existingApplicationId
      ) {
        entry.existingApplicationId = choice.existingApplicationId;
      }
      payload.push(entry);
    }
    return payload;
  }

  /**
   * Fetch capabilities for the selected cluster and default domainMode based on
   * what the cluster can actually deliver. If the cluster cannot auto-assign a
   * domain + TLS, fall back to 'skip' so the user opts in explicitly to a
   * custom FQDN if they want one.
   */
  async fetchClusterCapabilities(clusterId: string): Promise<void> {
    const caps = await this.catalogService.loadCapabilities(clusterId);
    if (!caps) return;
    if (this.domainMode() === 'auto' && !caps.canAutoAssignDomain) {
      this.domainMode.set('skip');
    }
    // If the user had picked Internal on a prior cluster and the new one has
    // no internal hosting, fall back to Public so the submit isn't silently
    // blocked by the backend 400.
    if (
      this.exposureMode() === CreateApplicationDto.ExposureEnum.Internal &&
      !caps.hasInternalHosting
    ) {
      this.exposureMode.set(CreateApplicationDto.ExposureEnum.Public);
    }
  }

  /**
   * Initialize from a Catalog detail (Marketplace flow). Prefills display name,
   * userInputs from prompt defaults, and envOverrides from editableEnv defaults —
   * the user only needs to confirm or tweak what the manifest already provides.
   */
  initializeFromCatalog(detail: CatalogDetailResponseDto): void {
    this.flowSubtype.set('marketplace');
    this.sourceType.set(null);
    this.catalogSlug.set(detail.slug);
    this.catalogDetail.set(detail);

    if (!this.catalogDisplayName()) {
      this.catalogDisplayName.set(detail.name);
    }

    const inputs: Record<string, string> = {};
    const confirms: Record<string, string> = {};
    for (const prompt of detail.userInputPrompts ?? []) {
      if (prompt.default !== undefined) {
        inputs[prompt.name] = prompt.default;
        if (prompt.confirm) confirms[prompt.name] = prompt.default;
      }
    }
    this.userInputs.set(inputs);
    this.userInputConfirms.set(confirms);
    this.backendFieldErrors.set({});

    // Reset any override left over from a previous install attempt so the user
    // starts from a clean "use manifest defaults" state.
    this.catalogResourceOverrides.set({ ...EMPTY_OVERRIDES });
    this.catalogAvailability.set(null);
    this.catalogAvailabilityError.set(null);
    this.forceInstallDespiteCapacity.set(false);

    const envs: Record<string, string> = {};
    for (const env of detail.editableEnv ?? []) {
      if (env.default !== undefined) envs[env.name] = env.default;
    }
    this.envOverrides.set(envs);

    this.catalogAuthMode.set(detail.auth?.default ?? null);
    const toggles: Record<string, boolean> = {};
    for (const opt of detail.options ?? []) {
      toggles[opt.key] = opt.default;
    }
    this.catalogFeatureToggles.set(toggles);

    // Manifest-declared `spec.domain.auto=false` means the catalog app must skip
    // endpoint creation entirely (e.g. internal-only apps). `userCustomizable=false`
    // is enforced by the wizard component (locks the FQDN field).
    if (detail.exposesPublicEndpoint === false || detail.domain?.auto === false) {
      this.domainMode.set('skip');
      this.requestedDomain.set('');
    } else {
      this.domainMode.set('auto');
    }
    // Reset exposure to match the manifest default so a previous
    // non-catalog selection doesn't bleed into this catalog install.
    this.exposureMode.set(
      detail.exposure === 'internal'
        ? CreateApplicationDto.ExposureEnum.Internal
        : CreateApplicationDto.ExposureEnum.Public,
    );

    this.pendingLinkedInstallId.set(null);
    this.linkedInstallIdPreset.set(false);
    this.reusableInstances.set([]);
    this.reusableInstancesError.set(null);

    const initialChoices: Record<string, DependencyChoiceState> = {};
    for (const dep of detail.dependencies ?? []) {
      initialChoices[dep.as] = { mode: DependencyChoiceDto.ModeEnum.Dedicated };
    }
    this.dependencyChoices.set(initialChoices);
    this.dependencyInstances.set({});
    this.dependencyInstancesError.set(null);
  }

  setDependencyChoice(alias: string, choice: DependencyChoiceState): void {
    this.dependencyChoices.update((current) => ({ ...current, [alias]: choice }));
    const cluster = this.clusterId();
    if (cluster) {
      this.checkCatalogResourceAvailability(cluster);
    }
  }

  async loadDependencyInstances(clusterId: string): Promise<void> {
    const deps = this.catalogDependencies();
    if (deps.length === 0 || !clusterId) {
      this.dependencyInstances.set({});
      this.dependencyDetails.set({});
      return;
    }
    this.dependencyInstancesLoading.set(true);
    this.dependencyInstancesError.set(null);
    try {
      const refs = Array.from(new Set(deps.map((d) => d.ref)));
      const [instanceLists, detailList] = await Promise.all([
        Promise.all(
          refs.map((ref) =>
            this.catalogService
              .getReusableInstances(ref, clusterId)
              .then((items) => ({ ref, items })),
          ),
        ),
        Promise.all(
          refs.map((ref) =>
            this.catalogService
              .fetchDetail(ref, clusterId)
              .then((detail) => ({ ref, detail })),
          ),
        ),
      ]);

      const instances: Record<string, CatalogReusableInstanceDto[]> = {};
      for (const { ref, items } of instanceLists) instances[ref] = items;
      this.dependencyInstances.set(instances);

      const details: Record<string, CatalogDetailResponseDto> = {};
      for (const { ref, detail } of detailList) {
        if (detail) details[ref] = detail;
      }
      this.dependencyDetails.set(details);

      await this.checkCatalogResourceAvailability(clusterId);
    } catch (err) {
      const e = err as { error?: { message?: string }; message?: string };
      this.dependencyInstancesError.set(
        e?.error?.message || e?.message || 'Failed to load compatible building-block instances.',
      );
      this.dependencyInstances.set({});
      this.dependencyDetails.set({});
    } finally {
      this.dependencyInstancesLoading.set(false);
    }
  }

  /**
   * Retry Connect for an install that succeeded but whose Connect failed. Does
   * NOT re-POST /install — the app row already exists. Called from the wizard
   * "Connect failed" state so the user doesn't end up with duplicate installs.
   */
  async retryMarketplaceConnect(): Promise<CatalogInstallResponseDto | null> {
    const install = this.currentInstall();
    const pending = this.pendingLinkedInstallId();
    if (!install || !pending) {
      this.installError.set('No pending connect to retry.');
      return null;
    }
    this.installError.set(null);
    this.installPhase.set('polling');
    try {
      const connected = await this.catalogService.connect(install.id, pending);
      if (!connected) {
        this.installPhase.set('failed');
        return null;
      }
      this.currentInstall.set(connected);
      const final = await this.catalogService.pollInstall(
        connected.id,
        connected.operationId ?? install.operationId,
        (latest) => this.currentInstall.set(latest),
      );
      this.currentInstall.set(final);
      if (final.status === CatalogInstallResponseDto.StatusEnum.Running) {
        this.installPhase.set('running');
        return final;
      }
      this.installError.set(final.errorMessage ?? 'Connect failed.');
      this.installPhase.set('failed');
      return null;
    } catch (err) {
      const e = err as { error?: { message?: string }; message?: string };
      this.installError.set(e?.error?.message || e?.message || 'Connect failed.');
      this.installPhase.set('failed');
      return null;
    }
  }

  async loadReusableInstances(clusterId: string): Promise<void> {
    const refs = this.linkedBbRefs();
    if (refs.length === 0 || !clusterId) {
      this.reusableInstances.set([]);
      return;
    }
    this.reusableInstancesLoading.set(true);
    this.reusableInstancesError.set(null);
    try {
      const lists = await Promise.all(
        refs.map((ref) => this.catalogService.getReusableInstances(ref, clusterId)),
      );
      const seen = new Set<string>();
      const merged = lists.flat().filter((i) => {
        const id = i.catalogInstallId;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      this.reusableInstances.set(merged);
      const currentId = this.pendingLinkedInstallId();
      if (currentId && !merged.some((i) => i.catalogInstallId === currentId)) {
        this.pendingLinkedInstallId.set(null);
      }
    } catch (err) {
      const e = err as { error?: { message?: string }; message?: string };
      this.reusableInstancesError.set(
        e?.error?.message || e?.message || 'Failed to load compatible instances.',
      );
      this.reusableInstances.set([]);
    } finally {
      this.reusableInstancesLoading.set(false);
    }
  }

  setEnvVarsFromExtracted(extracted: ExtractedEnvVarDto[]): void {
    this.envVars.set(
      extracted.map(e => ({
        key: e.key,
        value: e.defaultValue ?? '',
        isSecret: e.suggestedSecret,
        source: e.source,
      }))
    );
  }

  buildWorkflowParams(): GenerateWorkflowParams {
    const framework = this.confirmedFramework();
    const runtime = this.runtimeConfig();
    const config = this.deployConfig();

    return {
      branch: this.branch(),
      framework,
      port: config.port,
      ...(runtime.nodeVersion && { nodeVersion: runtime.nodeVersion }),
      ...(runtime.packageManager && { packageManager: runtime.packageManager }),
      ...(runtime.javaVersion && { javaVersion: runtime.javaVersion }),
      ...(runtime.buildTool && { buildTool: runtime.buildTool }),
      ...(runtime.dotnetVersion && { dotnetVersion: runtime.dotnetVersion }),
    };
  }

  // ========== Orchestration - Flow B (template) ==========

  /**
   * End-to-end template flow: create GitHub repo -> import to Flui -> create app ->
   * generate workflow. Drives orchestrationPhase as it progresses so the UI can
   * render a phase stepper. Returns the created application ID on success, null
   * on failure; the caller reads orchestrationError for the message.
   */
  async orchestrateTemplateFlow(): Promise<string | null> {
    const template = this.selectedTemplate();
    if (!template) {
      this.orchestrationError.set('No template selected');
      this.orchestrationPhase.set('error');
      return null;
    }

    this.orchestrationError.set(null);

    try {
      this.orchestrationPhase.set('creating-repo');
      const repo = await this.templateService.useTemplate(template.framework, {
        name: this.newRepoName(),
        owner: this.newRepoOwner().trim() || undefined,
        'private': this.newRepoPrivate(),
        description: template.description,
      });
      this.createdRepoFullName.set(repo.fullName);

      this.orchestrationPhase.set('registering-repo');
      const importResult = await this.repositoryService.importRepositories([repo.fullName], false);
      if (importResult.failed > 0 || !importResult.repositories?.length) {
        const errs = importResult.errors?.join(' ') ?? 'Unknown error';
        throw new Error(`Could not register repository with Flui: ${errs}`);
      }
      const fluiRepoId = importResult.repositories[0].id;
      this.importedRepositoryId.set(fluiRepoId);

      this.orchestrationPhase.set('creating-app');
      const appName = this.newRepoName().toLowerCase().replaceAll(/[^a-z0-9-]/g, '-').replaceAll(/^-+|-+$/g, '');
      const config = this.deployConfig();
      const envVars = this.envVars();
      const appResponse = await firstValueFrom(
        this.applicationsApi.applicationsControllerCreate(this.clusterId(), {
          name: appName,
          category: CreateApplicationDto.CategoryEnum.User,
          sourceType: CreateApplicationDto.SourceTypeEnum.GitBuild,
          sourceConfig: {
            type: 'git_build',
            repositoryId: fluiRepoId,
            branch: repo.defaultBranch,
            framework: template.framework,
          },
          port: config.port,
          replicas: config.minReplicas,
          resourceProfile: config.resourceProfile as CreateApplicationDto.ResourceProfileEnum,
          exposure: this.exposureMode(),
          env: envVars
            .filter(v => v.key && v.value)
            .map(v => ({ name: v.key, value: v.value, secret: v.isSecret })),
          healthProbe: {
            type: 'http',
            httpPath: config.healthcheckPath,
            httpPort: config.port,
          },
          autoDeploy: false,
        } as any)
      );
      const appId = appResponse.application?.id;
      if (!appId) throw new Error('Application created but no ID was returned.');
      this.applicationId.set(appId);

      this.orchestrationPhase.set('generating-workflow');
      await this.appService.generateWorkflowV3(appId, {
        branch: repo.defaultBranch,
        isFluiManaged: true,
      });

      this.orchestrationPhase.set('done');
      return appId;
    } catch (e: any) {
      this.orchestrationPhase.set('error');
      const msg = internalHostingErrorMessage(e) || e?.error?.message || e?.message || 'Failed to deploy from template';
      this.orchestrationError.set(msg);
      return null;
    }
  }

  // ========== Orchestration - Flow C (existing repo) ==========

  /**
   * Deploy an existing repository from its flui.yaml manifest (manifest-first,
   * same pipeline as `flui deploy`): the raw manifest is submitted to
   * applications/deploy-from-yaml, which creates/updates the app, commits the
   * V3 workflow and triggers the build. Env vars edited in the wizard are sent
   * as envOverrides on top of the manifest's deploy.env.
   */
  async orchestrateExistingRepoFlow(): Promise<string | null> {
    const manifest = this.manifestResult();
    if (!this.repositoryId() || !this.clusterId() || !this.repoFullName() || !manifest?.content || !manifest.valid) {
      this.orchestrationError.set('Missing repository, cluster or flui.yaml manifest');
      this.orchestrationPhase.set('error');
      return null;
    }

    this.orchestrationError.set(null);
    this.orchestrationPhase.set('creating-app');

    try {
      const envOverrides: Record<string, string> = {};
      for (const v of this.envVars()) {
        if (v.key && v.value !== '') envOverrides[v.key] = v.value;
      }

      const response = await firstValueFrom(
        this.applicationsApi.applicationsControllerDeployFromYaml({
          yaml: manifest.content,
          clusterId: this.clusterId(),
          repoFullName: this.repoFullName(),
          branch: this.branch() || undefined,
          envOverrides: Object.keys(envOverrides).length > 0 ? envOverrides : undefined,
        })
      );

      this.applicationId.set(response.applicationId);
      this.orchestrationPhase.set('done');
      return response.applicationId;
    } catch (e: any) {
      this.orchestrationPhase.set('error');
      const msg = internalHostingErrorMessage(e) || e?.error?.message || e?.message || 'Failed to deploy';
      this.orchestrationError.set(msg);
      return null;
    }
  }

  // ========== Orchestration - Flow D (marketplace) ==========

  /**
   * Submit a catalog install and poll until RUNNING or FAILED. Returns the
   * final install response on success, null on failure; callers read
   * installError for the message.
   */
  async orchestrateMarketplaceFlow(): Promise<CatalogInstallResponseDto | null> {
    const slug = this.catalogSlug();
    const detail = this.catalogDetail();
    const clusterId = this.clusterId();
    if (!slug || !detail || !clusterId) {
      this.installError.set('Missing catalog selection or cluster.');
      this.installPhase.set('failed');
      return null;
    }

    const dto: InstallCatalogAppDto = {
      clusterId,
      displayName: this.catalogDisplayName().trim() || detail.name,
      userInputs: this.sanitizeMap(this.userInputs()),
      envOverrides: this.sanitizeMap(this.envOverrides()),
    };
    // Pass exposure override only when the app is privatizable and the user
    // selected Internal. For manifest-internal apps the backend reads from the
    // manifest; for building blocks exposure is irrelevant.
    const isPrivatizable =
      detail.exposure === 'public' &&
      detail.appType !== 'building-block' &&
      detail.privatizable !== false;
    if (isPrivatizable && this.exposureMode() === CreateApplicationDto.ExposureEnum.Internal) {
      dto.exposure = InstallCatalogAppDto.ExposureEnum.Internal;
    }
    const isInternalApp = detail.exposure === 'internal' && detail.appType !== 'building-block';
    const mode = this.domainMode();
    if (mode === 'custom') {
      const domain = this.requestedDomain().trim();
      if (domain) dto.domain = domain;
    } else if (mode === 'skip' && !isInternalApp) {
      // Building blocks are truly cluster-internal (no Ingress at all).
      // Internal apps get an internal Ingress — skipEndpoint must stay false.
      dto.skipEndpoint = true;
    }

    // mode === 'auto' → no domain, no skipEndpoint → backend auto-assigns {install-slug}.{zoneName}

    // Only send tls:false; omit when on so the manifest default (tls:true) wins.
    if (mode !== 'skip' && !this.enableTls()) dto.tls = false;

    const overrides = this.buildResourceOverridesPayload();
    if (overrides) dto.resourceOverrides = overrides;

    const depPayload = this.buildDependencyChoicesPayload();
    if (depPayload) dto.dependencyChoices = depPayload;

    // Dedicated-storage apps need a worker; when the user opted to run on the
    // control-plane node (worker-less cluster), pass it through so the deploy
    // doesn't fail with NO_WORKER_FOR_DEDICATED_APP.
    if (this.allowMasterPlacement()) dto.allowMasterPlacement = true;

    const authMode = this.catalogAuthMode();
    if (authMode && authMode !== detail.auth?.default) {
      dto.authMode = authMode;
    }

    const featureToggles = this.catalogFeatureToggles();
    if (Object.keys(featureToggles).length > 0) {
      dto.options = { ...featureToggles };
    }

    if (this.forceInstallDespiteCapacity()) dto.force = true;

    this.installError.set(null);
    this.backendFieldErrors.set({});
    this.installPhase.set('submitting');

    try {
      const install = await this.catalogService.install(slug, dto);

      this.currentInstall.set(install);
      this.installPhase.set('polling');
      this.notifications.add({
        title: `Installing ${install.displayName}`,
        body: `Catalog install started on your cluster.`,
        type: 'info',
        source: 'system',
        category: 'app-deploy',
      });

      // Wait for the install to finish (parked or regular). Connect must come
      // AFTER the backend has created the ApplicationEntity — firing it on the
      // PENDING response would fail with "has no application yet".
      let final = await this.catalogService.pollInstall(
        install.id,
        install.operationId,
        (latest) => this.currentInstall.set(latest),
      );

      // Auto-connect if the user picked a target BB (wizard picker or deep-link).
      // Runs only after the first poll returned RUNNING — the app row is guaranteed
      // to exist at that point. Failure here keeps the install parked: the user
      // retries Connect from the app page, NOT by reinstalling.
      const pending = this.pendingLinkedInstallId();
      if (pending && final.status === CatalogInstallResponseDto.StatusEnum.Running) {
        try {
          const connected = await this.catalogService.connect(final.id, pending);
          if (connected) {
            this.currentInstall.set(connected);
            final = await this.catalogService.pollInstall(
              connected.id,
              connected.operationId ?? final.operationId,
              (latest) => this.currentInstall.set(latest),
            );
            this.currentInstall.set(final);
          }
        } catch (connectErr) {
          const e = connectErr as { error?: { message?: string }; message?: string };
          this.installError.set(
            e?.error?.message || e?.message || 'Install succeeded but Connect failed. Retry from the app page.',
          );
          this.installPhase.set('failed');
          return null;
        }
      }

      if (final.status === CatalogInstallResponseDto.StatusEnum.Running) {
        this.installPhase.set('running');
        const isInternal =
          detail.exposure === 'internal' ||
          this.exposureMode() === CreateApplicationDto.ExposureEnum.Internal;
        let body: string | undefined;
        if (final.resolvedFqdn) body = `Available at ${final.resolvedFqdn}`;
        else if (isInternal) body = 'Internal app is running — accessible via your cluster\'s internal domain.';
        else if (final.skipEndpoint) body = 'Install complete — configure a domain when you are ready.';
        else body = undefined;
        this.notifications.add({
          title: `${final.displayName} is running`,
          body,
          link: { label: 'View install', route: `/apps/catalog/installs/${final.id}` },
          type: 'success',
          source: 'system',
          category: 'app-deploy',
        });
        return final;
      }
      this.installError.set(final.errorMessage ?? 'Install failed.');
      this.installPhase.set('failed');
      this.notifications.add({
        title: `${final.displayName} install failed`,
        body: final.errorMessage,
        link: { label: 'View install', route: `/apps/catalog/installs/${final.id}` },
        type: 'error',
        source: 'system',
        category: 'app-deploy',
      });
      return null;
    } catch (e: any) {
      const body = e?.error;
      const rawErrors: string[] | undefined = Array.isArray(body?.errors) ? body.errors : undefined;
      const { perField, unparsed } = parseBackendFieldErrors(rawErrors);
      if (Object.keys(perField).length > 0) this.backendFieldErrors.set(perField);

      // Prefer the backend `message`; fall back to unparsed errors when only those are available.
      const headline = body?.message
        ?? (unparsed.length > 0 ? unparsed.join(' · ') : null)
        ?? e?.message
        ?? 'Failed to install from catalog';
      this.installError.set(headline);
      this.installPhase.set('failed');
      this.notifications.add({
        title: 'Catalog install failed',
        body: headline,
        type: 'error',
        source: 'system',
        category: 'app-deploy',
      });
      return null;
    }
  }

  /**
   * Called by the inputs step whenever the user edits a prompt — clears the
   * stale backend error for that field so the live validator takes over until
   * the next submit.
   */
  clearBackendFieldError(name: string): void {
    const current = this.backendFieldErrors();
    if (current[name] === undefined) return;
    const next = { ...current };
    delete next[name];
    this.backendFieldErrors.set(next);
  }

  private sanitizeMap(map: Record<string, string>): Record<string, string> | undefined {
    const entries = Object.entries(map).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries);
  }
}
