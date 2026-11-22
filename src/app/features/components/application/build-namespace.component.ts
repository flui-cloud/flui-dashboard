import { Component, OnDestroy, OnInit, computed, effect, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { lucideRefreshCw, lucideServer, lucideTrash2 } from '@ng-icons/lucide';
import { BuildNamespaceService } from '../../../core/api/api/buildNamespace.service';
import { BuildCachePanelComponent } from './build-cache-panel.component';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { BuildNamespaceResourcesResponseDto } from '../../../core/api/model/buildNamespaceResourcesResponseDto';
import { BuildNamespaceCleanupResultDto } from '../../../core/api/model/buildNamespaceCleanupResultDto';
import { ClusterResponseDto } from '../../../core/api/model/clusterResponseDto';
import { isSandboxRefusal } from '../../../core/services/sandbox.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { builderStatus } from './build-namespace-format';
import { BuildNamespaceCleanup } from './build-namespace-cleanup';
import { BuildNamespaceTables } from './build-namespace-tables';
import {
  BuildNamespaceSurfaceInput,
  BuildNamespaceSurfaceRevision,
  buildBuildNamespaceSurface,
  presentedContent as buildNamespacePresentedContent,
} from './build-namespace-surface';

@Component({
  selector: 'app-build-namespace',
  imports: [
    FormsModule,
    BuildCachePanelComponent,
    BuildNamespaceCleanup,
    BuildNamespaceTables,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlCopyId,
    FlKeyValue,
    FlKvItem,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlStatus,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideServer, lucideTrash2 })],
  templateUrl: './build-namespace.component.html',
})
export class BuildNamespaceComponent implements OnInit, OnDestroy {
  private readonly buildNamespaceApi = inject(BuildNamespaceService);
  private readonly clustersApi = inject(InfrastructureClustersService);

  clusters = signal<ClusterResponseDto[]>([]);
  selectedClusterId = signal<string | null>(null);
  resources = signal<BuildNamespaceResourcesResponseDto | null>(null);
  isLoadingClusters = signal(false);
  isLoadingResources = signal(false);
  error = signal<string | null>(null);
  refusal = signal<string | null>(null);
  cleanupPreview = signal<BuildNamespaceCleanupResultDto | null>(null);
  isRunningCleanup = signal(false);
  showCleanupPanel = signal(false);
  olderThanMinutes = signal(0);

  protected readonly selectedCluster = computed(() =>
    this.clusters().find((c) => c.id === this.selectedClusterId()),
  );

  protected readonly breadcrumb = computed<Crumb[]>(() => {
    const cluster = this.selectedCluster();
    return [
      { label: 'Clusters', link: '/cluster' },
      ...(cluster ? [{ label: cluster.name, link: ['/cluster', cluster.id] }] : []),
      { label: 'Build queue' },
    ];
  });

  protected readonly builder = computed(() =>
    builderStatus(this.resources(), {
      refused: Boolean(this.refusal()),
      error: Boolean(this.error()),
      cluster: Boolean(this.selectedClusterId()),
    }),
  );

  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new BuildNamespaceSurfaceRevision();

  private readonly surfaceInput = computed<BuildNamespaceSurfaceInput>(() => {
    const res = this.resources();
    const preview = this.cleanupPreview();
    const clusterId = this.selectedClusterId();
    return {
      clusterCount: this.clusters().length,
      selectedClusterId: clusterId,
      selectedClusterName: this.clusters().find((c) => c.id === clusterId)?.name,
      isLoadingClusters: this.isLoadingClusters(),
      isLoadingResources: this.isLoadingResources(),
      hasError: Boolean(this.error()),
      refused: Boolean(this.refusal()),
      resources: res
        ? {
            queued: res.queuedBuilds.map((q) => ({
              buildId: q.buildId,
              applicationId: q.applicationId,
              appSlug: q.appSlug,
              branch: q.branch,
              commitShortSha: q.commitSha ? q.commitSha.substring(0, 7) : null,
              ageMinutes: q.ageMinutes,
              status: q.status,
            })),
            tasks: res.jobs.map((j) => ({
              buildId: j.buildId,
              appSlug: j.appSlug,
              purpose: j.purpose,
              status: j.status,
              ageMinutes: j.ageMinutes,
              cpuRequest: j.cpuRequest,
              memoryRequest: j.memoryRequest,
            })),
            workers: res.pods.map((p) => ({
              buildId: p.buildId,
              appSlug: p.appSlug,
              phase: p.phase,
              ageMinutes: p.ageMinutes,
              containerCount: p.containers.length,
            })),
            totalCpuRequestMillicores: res.totalCpuRequestMillicores,
            totalMemoryRequestMiB: res.totalMemoryRequestMiB,
          }
        : null,
      cleanup: {
        open: this.showCleanupPanel(),
        olderThanMinutes: this.olderThanMinutes(),
        running: this.isRunningCleanup(),
        previewTaskCount: preview ? preview.deletedJobs.length : null,
        previewWorkerCount: preview ? preview.deletedPods.length : null,
      },
    };
  });

  readonly surface = computed(() => {
    const input = this.surfaceInput();
    return buildBuildNamespaceSurface(input, {
      revision: this.surfaceRevision.next(buildNamespacePresentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  ngOnInit(): void {
    void (async () => {
      this.isLoadingClusters.set(true);
      try {
        const list = await firstValueFrom(this.clustersApi.clustersControllerListClusters());
        this.clusters.set(list);
        if (list.length === 1) {
          this.selectedClusterId.set(list[0].id);
          await this.loadResources();
        }
      } catch (e: unknown) {
        this.note(e, 'Failed to load clusters');
      } finally {
        this.isLoadingClusters.set(false);
      }
    })();
  }

  async onClusterChange(clusterId: string): Promise<void> {
    this.selectedClusterId.set(clusterId);
    this.resources.set(null);
    this.cleanupPreview.set(null);
    this.showCleanupPanel.set(false);
    await this.loadResources();
  }

  async loadResources(): Promise<void> {
    const id = this.selectedClusterId();
    if (!id) return;
    this.isLoadingResources.set(true);
    this.error.set(null);
    try {
      const data = await firstValueFrom(
        this.buildNamespaceApi.buildNamespaceControllerGetNamespaceResources(id),
      );
      this.resources.set(data);
    } catch (e: unknown) {
      this.note(e, 'Failed to load build resources');
    } finally {
      this.isLoadingResources.set(false);
    }
  }

  async previewCleanup(): Promise<void> {
    const id = this.selectedClusterId();
    if (!id) return;
    this.isRunningCleanup.set(true);
    this.cleanupPreview.set(null);
    try {
      const result = await firstValueFrom(
        this.buildNamespaceApi.buildNamespaceControllerCleanupNamespace(id, {
          olderThanMinutes: this.olderThanMinutes(),
          dryRun: true,
        }),
      );
      this.cleanupPreview.set(result);
    } catch (e: unknown) {
      this.note(e, 'Failed to run preview');
    } finally {
      this.isRunningCleanup.set(false);
    }
  }

  async confirmCleanup(): Promise<void> {
    const id = this.selectedClusterId();
    if (!id) return;
    this.isRunningCleanup.set(true);
    try {
      await firstValueFrom(
        this.buildNamespaceApi.buildNamespaceControllerCleanupNamespace(id, {
          olderThanMinutes: this.olderThanMinutes(),
          dryRun: false,
        }),
      );
      this.cleanupPreview.set(null);
      this.showCleanupPanel.set(false);
      await this.loadResources();
    } catch (e: unknown) {
      this.note(e, 'Failed to clean up stale builds');
    } finally {
      this.isRunningCleanup.set(false);
    }
  }

  private note(e: unknown, fallback: string): void {
    const server = (e as { error?: { message?: string } })?.error?.message;
    if (isSandboxRefusal(e)) {
      this.refusal.set(server ?? 'This is not part of the trial.');
      this.error.set(null);
      return;
    }
    this.refusal.set(null);
    this.error.set(server ?? fallback);
  }

  cancelCleanup(): void {
    this.showCleanupPanel.set(false);
    this.cleanupPreview.set(null);
  }
}
