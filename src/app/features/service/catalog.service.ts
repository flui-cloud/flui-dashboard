import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CatalogService as CatalogApiService } from '../../core/api/api/catalog.service';
import { InfrastructureOperationsService } from '../../core/api/api/infrastructureOperations.service';
import {
  CatalogClusterCapabilitiesDto,
  CatalogDetailResponseDto,
  CatalogInstallResponseDto,
  CatalogResponseDto,
  CatalogReusableInstanceDto,
  CatalogYamlResponseDto,
  InstallCatalogAppDto,
} from '../../core/api/model/models';
import { ApplicationService } from './application.service';
import { Application } from '../model/application.models';
import { internalHostingErrorMessage } from '../model/app-exposure';

export interface CatalogFilters {
  category?: string;
  search?: string;
  tags?: string[];
  appKind?: 'DATABASE' | 'APPLICATION' | 'TOOL' | 'SYSTEM';
}

export interface CatalogInstallStepProgress {
  stepId: string;
  stepLabel: string;
  stepIndex: number;
  totalSteps: number;
  overallProgress: number;
}

interface OperationStatusSnapshot {
  status?: string;
  progress?: number;
  currentStep?: string;
  currentStepIndex?: number;
  totalSteps?: number;
  currentStepProgress?: number;
  metadata?: { stepDescription?: string };
}

const CATALOG_INSTALL_STEPS = [
  'catalog_install_init',
  'catalog_install_resolve_deps',
  'catalog_install_generate_secrets',
  'catalog_install_resolve_templates',
  'catalog_install_create_applications',
  'catalog_install_deploy_components',
  'catalog_install_create_endpoints',
  'catalog_install_finalize',
] as const;

const CATALOG_UNINSTALL_STEPS = [
  'catalog_uninstall_init',
  'catalog_uninstall_delete_apps',
  'catalog_uninstall_finalize',
] as const;

const STEP_LABELS: Record<string, string> = {
  catalog_install_init: 'Initialization',
  catalog_install_resolve_deps: 'Resolving dependencies',
  catalog_install_generate_secrets: 'Generating secrets',
  catalog_install_resolve_templates: 'Resolving templates',
  catalog_install_create_applications: 'Creating application',
  catalog_install_deploy_components: 'Deploying on cluster',
  catalog_install_create_endpoints: 'Provisioning domain & TLS',
  catalog_install_finalize: 'Finalization',
  catalog_uninstall_init: 'Initialization',
  catalog_uninstall_delete_apps: 'Removing applications',
  catalog_uninstall_finalize: 'Finalization',
};

function deriveStepPosition(stepId: string | undefined | null): { index: number; total: number } | null {
  if (!stepId) return null;
  const installIdx = (CATALOG_INSTALL_STEPS as readonly string[]).indexOf(stepId);
  if (installIdx >= 0) return { index: installIdx, total: CATALOG_INSTALL_STEPS.length };
  const uninstallIdx = (CATALOG_UNINSTALL_STEPS as readonly string[]).indexOf(stepId);
  if (uninstallIdx >= 0) return { index: uninstallIdx, total: CATALOG_UNINSTALL_STEPS.length };
  return null;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(CatalogApiService);
  private readonly operationsApi = inject(InfrastructureOperationsService);
  private readonly applicationService = inject(ApplicationService);

  readonly installedByCatalogSlug = computed<Map<string, Application[]>>(() => {
    const map = new Map<string, Application[]>();
    for (const app of this.applicationService.applications()) {
      if (!app.catalogSlug) continue;
      const arr = map.get(app.catalogSlug);
      if (arr) arr.push(app);
      else map.set(app.catalogSlug, [app]);
    }
    return map;
  });

  /**
   * Ensures the applications list is loaded so `installedByCatalogSlug` is
   * populated. Triggers a fetch only the first time the catalog page is opened.
   */
  async ensureApplicationsLoaded(): Promise<void> {
    if (this.applicationService.applications().length === 0) {
      await this.applicationService.loadApplications();
    }
  }

  getInstalledFor(slug: string | undefined | null): Application[] {
    if (!slug) return [];
    return this.installedByCatalogSlug().get(slug) ?? [];
  }

  /**
   * True when at least one installed instance has a `catalogVersion` lower
   * than the current catalog entry version (naive string compare — good enough
   * for semver-like tags, backend remains authoritative for real upgrade state).
   */
  hasUpdateAvailable(slug: string, catalogVersion: string | undefined | null): boolean {
    if (!slug || !catalogVersion) return false;
    const installed = this.getInstalledFor(slug);
    return installed.some(
      (app) => app.catalogVersion && app.catalogVersion !== catalogVersion,
    );
  }

  private readonly _catalog = signal<CatalogResponseDto[]>([]);
  private readonly _detail = signal<CatalogDetailResponseDto | null>(null);
  private readonly _currentInstall = signal<CatalogInstallResponseDto | null>(null);
  private readonly _installProgress = signal<CatalogInstallStepProgress | null>(null);
  private readonly _capabilities = signal<CatalogClusterCapabilitiesDto | null>(null);
  private readonly _yaml = signal<CatalogYamlResponseDto | null>(null);
  private readonly _yamlLoading = signal(false);
  private readonly _yamlError = signal<string | null>(null);

  private readonly _listLoading = signal(false);
  private readonly _listError = signal<string | null>(null);
  private readonly _detailLoading = signal(false);
  private readonly _detailError = signal<string | null>(null);
  private readonly _installLoading = signal(false);
  private readonly _installError = signal<string | null>(null);
  private readonly _capabilitiesLoading = signal(false);
  private readonly _capabilitiesError = signal<string | null>(null);

  readonly catalog = this._catalog.asReadonly();
  readonly detail = this._detail.asReadonly();
  readonly currentInstall = this._currentInstall.asReadonly();
  readonly installProgress = this._installProgress.asReadonly();
  readonly capabilities = this._capabilities.asReadonly();

  readonly listLoading = this._listLoading.asReadonly();
  readonly listError = this._listError.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly detailError = this._detailError.asReadonly();
  readonly installLoading = this._installLoading.asReadonly();
  readonly installError = this._installError.asReadonly();
  readonly capabilitiesLoading = this._capabilitiesLoading.asReadonly();
  readonly capabilitiesError = this._capabilitiesError.asReadonly();
  readonly yaml = this._yaml.asReadonly();
  readonly yamlLoading = this._yamlLoading.asReadonly();
  readonly yamlError = this._yamlError.asReadonly();

  readonly categories = computed(() => {
    const set = new Set<string>();
    for (const app of this._catalog()) set.add(app.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  readonly tags = computed(() => {
    const set = new Set<string>();
    for (const app of this._catalog()) {
      for (const tag of app.tags ?? []) set.add(tag);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  async loadCatalog(filters?: CatalogFilters): Promise<void> {
    this._listLoading.set(true);
    this._listError.set(null);
    try {
      const response = await firstValueFrom(
        this.api.catalogControllerList(
          filters?.category,
          filters?.search,
          filters?.tags as Array<any> | undefined,
          filters?.appKind,
        ),
      );
      this._catalog.set(response ?? []);
    } catch (err) {
      this._listError.set(this.extractError(err, 'Failed to load the catalog.'));
      this._catalog.set([]);
    } finally {
      this._listLoading.set(false);
    }
  }

  async loadDetail(slug: string, clusterId?: string): Promise<CatalogDetailResponseDto | null> {
    this._detailLoading.set(true);
    this._detailError.set(null);
    try {
      const response = await firstValueFrom(this.api.catalogControllerGetDetail(slug, clusterId));
      this._detail.set(response);
      return response;
    } catch (err) {
      this._detailError.set(this.extractError(err, 'Failed to load the app details.'));
      this._detail.set(null);
      return null;
    } finally {
      this._detailLoading.set(false);
    }
  }

  async install(slug: string, dto: InstallCatalogAppDto): Promise<CatalogInstallResponseDto> {
    this._installLoading.set(true);
    this._installError.set(null);
    try {
      const response = await firstValueFrom(this.api.catalogControllerInstall(slug, dto));
      this._currentInstall.set(response);
      return response;
    } catch (err) {
      const msg = this.extractError(err, 'Failed to start the install.');
      this._installError.set(msg);
      throw err;
    } finally {
      this._installLoading.set(false);
    }
  }

  async getInstall(id: string): Promise<CatalogInstallResponseDto | null> {
    try {
      const response = await firstValueFrom(this.api.catalogControllerGetInstall(id));
      this._currentInstall.set(response);
      return response;
    } catch (err) {
      this._installError.set(this.extractError(err, 'Failed to load install status.'));
      return null;
    }
  }

  async uninstall(id: string): Promise<CatalogInstallResponseDto | null> {
    try {
      const response = await firstValueFrom(this.api.catalogControllerUninstall(id));
      this._currentInstall.set(response);
      return response;
    } catch (err) {
      this._installError.set(this.extractError(err, 'Failed to uninstall.'));
      throw err;
    }
  }

  async pollInstall(
    installId: string,
    operationId: string | undefined,
    onUpdate?: (install: CatalogInstallResponseDto, progress: CatalogInstallStepProgress | null) => void,
  ): Promise<CatalogInstallResponseDto> {
    const POLL_INTERVAL = 3000;
    const MAX_POLLS = 600;
    let pollCount = 0;

    while (pollCount < MAX_POLLS) {
      pollCount++;

      let progress: CatalogInstallStepProgress | null = null;
      if (operationId) {
        try {
          const op = (await firstValueFrom(
            this.operationsApi.infrastructureOperationsControllerGetOperationStatus(operationId),
          )) as OperationStatusSnapshot;
          progress = this.toStepProgress(op);
          this._installProgress.set(progress);
        } catch {
          // granular progress is best-effort
        }
      }

      let install = this._currentInstall();
      if (!install || pollCount % 4 === 0 || !operationId) {
        install = await this.getInstall(installId);
      }

      if (install) onUpdate?.(install, progress);

      if (install) {
        const status = install.status;
        if (
          status === CatalogInstallResponseDto.StatusEnum.Running ||
          status === CatalogInstallResponseDto.StatusEnum.Failed ||
          status === CatalogInstallResponseDto.StatusEnum.Uninstalled
        ) {
          return install;
        }
      }

      await this.delay(POLL_INTERVAL);
    }

    throw new Error('Install polling timed out. Please check status manually.');
  }

  async loadCapabilities(clusterId: string): Promise<CatalogClusterCapabilitiesDto | null> {
    if (!clusterId) {
      this._capabilities.set(null);
      return null;
    }
    this._capabilitiesLoading.set(true);
    this._capabilitiesError.set(null);
    try {
      const response = await firstValueFrom(
        this.api.catalogControllerGetClusterCapabilities(clusterId),
      );
      this._capabilities.set(response);
      return response;
    } catch (err) {
      this._capabilitiesError.set(
        this.extractError(err, 'Failed to load cluster capabilities.'),
      );
      this._capabilities.set(null);
      return null;
    } finally {
      this._capabilitiesLoading.set(false);
    }
  }

  resetDetail(): void {
    this._detail.set(null);
    this._detailError.set(null);
  }

  resetInstall(): void {
    this._currentInstall.set(null);
    this._installProgress.set(null);
    this._installError.set(null);
  }

  resetCapabilities(): void {
    this._capabilities.set(null);
    this._capabilitiesError.set(null);
  }

  async loadYaml(slug: string): Promise<CatalogYamlResponseDto | null> {
    const cached = this._yaml();
    if (cached?.slug === slug) return cached;
    this._yamlLoading.set(true);
    this._yamlError.set(null);
    try {
      const response = await firstValueFrom(this.api.catalogControllerGetYaml(slug));
      this._yaml.set(response);
      return response;
    } catch (err) {
      this._yamlError.set(this.extractError(err, 'Failed to load the manifest.'));
      this._yaml.set(null);
      return null;
    } finally {
      this._yamlLoading.set(false);
    }
  }

  resetYaml(): void {
    this._yaml.set(null);
    this._yamlError.set(null);
  }

  /**
   * Returns the entrypointPath for a catalog app by its slug, loading the
   * catalog list if needed. Returns undefined when the slug is unknown so the
   * caller can decide between showing nothing and falling back to '/'.
   */
  async getEntrypointPathBySlug(slug: string | undefined | null): Promise<string | undefined> {
    if (!slug) return undefined;
    if (this._catalog().length === 0) await this.loadCatalog();
    return this._catalog().find((c) => c.slug === slug)?.entrypointPath;
  }

  /**
   * Returns the entrypointPath for a catalog app by its CatalogAppDefinition
   * UUID. Used from the install-detail page where only the definition id is
   * in hand — the cached list provides the slug → entrypointPath mapping.
   */
  async getEntrypointPathByDefinitionId(
    id: string | undefined | null,
  ): Promise<string | undefined> {
    if (!id) return undefined;
    if (this._catalog().length === 0) await this.loadCatalog();
    return this._catalog().find((c) => c.id === id)?.entrypointPath;
  }

  /**
   * Connect (or switch) a catalog client install to a running building-block
   * install. Idempotent server-side: first Connect triggers env wiring,
   * subsequent Connects with a new targetInstallId rolling-restart the pod
   * with updated env. See docs §7.5. The returned `connectedInstallId` is
   * derived from the pod env at read-time — read-only for the FE.
   */
  async connect(
    installId: string,
    targetInstallId: string,
  ): Promise<CatalogInstallResponseDto | null> {
    this._installError.set(null);
    try {
      const response = await firstValueFrom(
        this.api.catalogControllerConnect(installId, { targetInstallId }),
      );
      this._currentInstall.set(response);
      return response;
    } catch (err) {
      this._installError.set(this.extractError(err, 'Failed to connect the client.'));
      throw err;
    }
  }

  /**
   * Disconnect a catalog client install from its current building block.
   * Idempotent: calling on an already-unlinked install returns the current
   * state without changes. Rolling-restarts the pod so it boots unlinked
   * (e.g. pgweb renders its native empty state). To stop the pod entirely,
   * Uninstall instead.
   */
  async disconnect(installId: string): Promise<CatalogInstallResponseDto | null> {
    this._installError.set(null);
    try {
      const response = await firstValueFrom(
        this.api.catalogControllerDisconnect(installId),
      );
      this._currentInstall.set(response);
      return response;
    } catch (err) {
      this._installError.set(this.extractError(err, 'Failed to disconnect the client.'));
      throw err;
    }
  }

  async fetchDetail(
    slug: string,
    clusterId?: string,
  ): Promise<CatalogDetailResponseDto | null> {
    try {
      const response = await firstValueFrom(
        this.api.catalogControllerGetDetail(slug, clusterId),
      );
      return response ?? null;
    } catch {
      return null;
    }
  }

  async getReusableInstances(
    bbSlug: string,
    clusterId: string,
  ): Promise<CatalogReusableInstanceDto[]> {
    if (!bbSlug || !clusterId) return [];
    try {
      const response = await firstValueFrom(
        this.api.catalogControllerListReusableInstances(bbSlug, clusterId),
      );
      return response ?? [];
    } catch {
      return [];
    }
  }

  stepLabel(stepId: string | undefined | null): string {
    if (!stepId) return '';
    return STEP_LABELS[stepId] ?? stepId;
  }

  private toStepProgress(op: OperationStatusSnapshot): CatalogInstallStepProgress | null {
    if (!op?.currentStep) return null;
    // Prefer the position derived from the catalog step enum: the backend
    // operation counter often stays at 0 while `currentStep` changes, so the
    // index we show would freeze on "Step 1 of 8". Fall back to the backend
    // counters only for non-catalog steps.
    const derived = deriveStepPosition(op.currentStep);
    return {
      stepId: op.currentStep,
      stepLabel: this.stepLabel(op.currentStep),
      stepIndex: derived?.index ?? op.currentStepIndex ?? 0,
      totalSteps: derived?.total ?? op.totalSteps ?? 0,
      overallProgress: op.progress ?? 0,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractError(err: unknown, fallback: string): string {
    const structured = internalHostingErrorMessage(err);
    if (structured) return structured;
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message || e?.message || fallback;
  }
}
