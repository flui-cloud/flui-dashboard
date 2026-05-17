import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InfrastructurePlatformComponentsService } from '../../core/api/api/infrastructurePlatformComponents.service';
import { PlatformComponentResponseDto } from '../../core/api/model/platformComponentResponseDto';
import { RedeployPlatformComponentResponseDto } from '../../core/api/model/redeployPlatformComponentResponseDto';
import { PlatformComponentLogsResponseDto } from '../../core/api/model/platformComponentLogsResponseDto';

export interface ClusterComponentsEntry {
  clusterId: string;
  clusterName: string;
  components: PlatformComponentResponseDto[];
  loading: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class PlatformComponentsService {
  private readonly api = inject(InfrastructurePlatformComponentsService);

  private readonly entriesData = signal<ClusterComponentsEntry[]>([]);
  private readonly globalLoadingData = signal<boolean>(false);
  private readonly redeployingData = signal<Set<string>>(new Set());

  readonly entries = this.entriesData.asReadonly();
  readonly globalLoading = this.globalLoadingData.asReadonly();
  readonly redeploying = this.redeployingData.asReadonly();

  readonly allComponents = computed(() =>
    this.entriesData().flatMap(e =>
      e.components.map(c => ({ ...c, clusterId: e.clusterId, clusterName: e.clusterName }))
    )
  );

  readonly healthyCount = computed(() =>
    this.allComponents().filter(c => c.status === PlatformComponentResponseDto.StatusEnum.Healthy).length
  );
  readonly degradedCount = computed(() =>
    this.allComponents().filter(c => c.status === PlatformComponentResponseDto.StatusEnum.Degraded).length
  );
  readonly missingCount = computed(() =>
    this.allComponents().filter(c => c.status === PlatformComponentResponseDto.StatusEnum.Missing).length
  );

  isRedeploying(clusterId: string, componentKey: string): boolean {
    return this.redeployingData().has(`${clusterId}:${componentKey}`);
  }

  async loadForClusters(clusters: { id: string; name: string }[]): Promise<void> {
    this.globalLoadingData.set(true);
    const initial: ClusterComponentsEntry[] = clusters.map(c => ({
      clusterId: c.id,
      clusterName: c.name,
      components: [],
      loading: true,
      error: null,
    }));
    this.entriesData.set(initial);

    await Promise.allSettled(
      clusters.map(c => this._loadForCluster(c.id, c.name))
    );
    this.globalLoadingData.set(false);
  }

  async loadForCluster(clusterId: string, clusterName: string): Promise<void> {
    const existing = this.entriesData().find(e => e.clusterId === clusterId);
    if (existing) {
      this._patchEntry(clusterId, { loading: true, error: null });
    } else {
      this.entriesData.update(entries => [
        ...entries,
        { clusterId, clusterName, components: [], loading: true, error: null },
      ]);
    }
    await this._loadForCluster(clusterId, clusterName);
  }

  async redeployComponent(
    clusterId: string,
    componentKey: string
  ): Promise<RedeployPlatformComponentResponseDto | null> {
    const key = `${clusterId}:${componentKey}`;
    this.redeployingData.update(s => new Set([...s, key]));
    try {
      return await firstValueFrom(
        this.api.platformComponentsControllerRedeployComponent(clusterId, componentKey)
      );
    } catch {
      return null;
    } finally {
      this.redeployingData.update(s => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  async getPodLogs(
    clusterId: string,
    componentKey: string,
    podName: string,
    container?: string,
    tailLines?: number
  ): Promise<PlatformComponentLogsResponseDto | null> {
    try {
      return await firstValueFrom(
        this.api.platformComponentsControllerGetPodLogs(clusterId, componentKey, podName, container, tailLines)
      );
    } catch {
      return null;
    }
  }

  private async _loadForCluster(clusterId: string, clusterName: string): Promise<void> {
    try {
      const components = await firstValueFrom(
        this.api.platformComponentsControllerListComponents(clusterId)
      );
      this._patchEntry(clusterId, { components, loading: false, error: null });
    } catch (err: any) {
      this._patchEntry(clusterId, {
        loading: false,
        error: err?.message ?? 'Failed to load platform components',
      });
    }
  }

  private _patchEntry(clusterId: string, patch: Partial<ClusterComponentsEntry>): void {
    this.entriesData.update(entries =>
      entries.map(e => (e.clusterId === clusterId ? { ...e, ...patch } : e))
    );
  }
}
