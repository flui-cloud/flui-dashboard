import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InfrastructureClustersService } from '../../core/api/api/infrastructureClusters.service';
import { ClusterStorageStatusDto } from '../../core/api/model/clusterStorageStatusDto';

/**
 * Cache window for the storage endpoint. The backend re-queries the
 * provider and the live PVC list on each call, so the FE caches briefly
 * to avoid hammering it when the user toggles tabs.
 */
const CACHE_TTL_MS = 8_000;

@Injectable({ providedIn: 'root' })
export class ClusterStorageService {
  private readonly clustersApi = inject(InfrastructureClustersService);

  private readonly storageData = signal<ClusterStorageStatusDto | null>(null);
  private readonly loadingData = signal<boolean>(false);
  private readonly errorData = signal<string | null>(null);

  private lastClusterId: string | null = null;
  private lastFetchAt = 0;

  readonly storage = this.storageData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();

  readonly status = computed(() => this.storageData()?.status ?? null);
  readonly isReady = computed(
    () => this.status() === ClusterStorageStatusDto.StatusEnum.Ready,
  );
  readonly isDegraded = computed(
    () => this.status() === ClusterStorageStatusDto.StatusEnum.Degraded,
  );
  readonly isProvisioning = computed(
    () => this.status() === ClusterStorageStatusDto.StatusEnum.Provisioning,
  );
  readonly isDisabled = computed(() => this.storageData()?.enabled === false);

  readonly requestedPercent = computed(() => {
    const data = this.storageData();
    const requested = data?.pvcs?.requestedGb ?? 0;
    const size = data?.volume?.sizeGb ?? 0;
    if (!size) return 0;
    return Math.min(100, (requested / size) * 100);
  });

  readonly namespaceBreakdown = computed(() => {
    const map = this.storageData()?.pvcs?.byNamespace ?? {};
    return Object.entries(map)
      .map(([namespace, count]) => ({ namespace, count }))
      .sort((a, b) => b.count - a.count);
  });

  async load(clusterId: string, force = false): Promise<void> {
    const now = Date.now();
    const fresh =
      !force &&
      this.lastClusterId === clusterId &&
      now - this.lastFetchAt < CACHE_TTL_MS &&
      this.storageData() !== null;

    if (fresh) return;

    this.loadingData.set(true);
    this.errorData.set(null);

    try {
      const data = await firstValueFrom(
        this.clustersApi.clustersControllerGetClusterStorage(clusterId),
      );
      this.storageData.set(data);
      this.lastClusterId = clusterId;
      this.lastFetchAt = Date.now();
    } catch (error: any) {
      console.error('Error loading cluster storage:', error);
      this.errorData.set(error?.message || 'Failed to load cluster storage');
    } finally {
      this.loadingData.set(false);
    }
  }

  reset(): void {
    this.storageData.set(null);
    this.errorData.set(null);
    this.lastClusterId = null;
    this.lastFetchAt = 0;
  }
}
