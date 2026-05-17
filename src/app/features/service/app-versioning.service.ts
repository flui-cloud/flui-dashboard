import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicationsService } from '../../core/api/api/applications.service';
import { AvailableVersionDto } from '../../core/api/model/availableVersionDto';
import { AvailableVersionsResponseDto } from '../../core/api/model/availableVersionsResponseDto';

interface VersionsState {
  sourceType: AvailableVersionsResponseDto.SourceTypeEnum | null;
  currentImageRef: string | null;
  versions: AvailableVersionDto[];
  nextPage: number | null;
}

const EMPTY_STATE: VersionsState = {
  sourceType: null,
  currentImageRef: null,
  versions: [],
  nextPage: null,
};

@Injectable({ providedIn: 'root' })
export class AppVersioningService {
  private readonly applicationsApi = inject(ApplicationsService);

  private readonly DEFAULT_PAGE_SIZE = 25;

  private readonly stateSig = signal<VersionsState>(EMPTY_STATE);
  private readonly loadingSig = signal<boolean>(false);
  private readonly loadingMoreSig = signal<boolean>(false);
  private readonly errorSig = signal<string | null>(null);

  readonly state = this.stateSig.asReadonly();
  readonly loading = this.loadingSig.asReadonly();
  readonly loadingMore = this.loadingMoreSig.asReadonly();
  readonly error = this.errorSig.asReadonly();

  readonly versions = computed(() => this.stateSig().versions);
  readonly currentImageRef = computed(() => this.stateSig().currentImageRef);
  readonly sourceType = computed(() => this.stateSig().sourceType);
  readonly nextPage = computed(() => this.stateSig().nextPage);
  readonly hasMore = computed(() => this.stateSig().nextPage != null);

  readonly hasUpdate = computed(() => {
    const s = this.stateSig();
    if (!s.versions.length) return false;
    const currentIdx = s.versions.findIndex((v) => v.isCurrentlyDeployed);
    if (currentIdx < 0) return false;
    const currentCreatedAt = s.versions[currentIdx].createdAt;
    if (!currentCreatedAt) return false;
    const currentTs = +new Date(currentCreatedAt);
    if (Number.isNaN(currentTs)) return false;
    return s.versions.some((v, i) => {
      if (i === currentIdx || !v.createdAt) return false;
      const ts = +new Date(v.createdAt);
      return !Number.isNaN(ts) && ts > currentTs;
    });
  });

  async loadAvailableVersions(appId: string, limit: number = this.DEFAULT_PAGE_SIZE): Promise<void> {
    this.loadingSig.set(true);
    this.errorSig.set(null);
    try {
      const response = await firstValueFrom(
        this.applicationsApi.applicationsControllerGetAvailableVersions(appId, 1, limit),
      );
      this.stateSig.set({
        sourceType: response.sourceType,
        currentImageRef: response.currentImageRef ?? null,
        versions: response.versions ?? [],
        nextPage: response.nextPage ?? null,
      });
    } catch (err: any) {
      this.errorSig.set(this.extractError(err, 'Failed to load available versions'));
      throw err;
    } finally {
      this.loadingSig.set(false);
    }
  }

  async loadMore(appId: string, limit: number = this.DEFAULT_PAGE_SIZE): Promise<void> {
    const next = this.stateSig().nextPage;
    if (next == null) return;
    this.loadingMoreSig.set(true);
    this.errorSig.set(null);
    try {
      const response = await firstValueFrom(
        this.applicationsApi.applicationsControllerGetAvailableVersions(appId, next, limit),
      );
      this.stateSig.update((prev) => ({
        sourceType: response.sourceType ?? prev.sourceType,
        currentImageRef: response.currentImageRef ?? prev.currentImageRef,
        versions: [...prev.versions, ...(response.versions ?? [])],
        nextPage: response.nextPage ?? null,
      }));
    } catch (err: any) {
      this.errorSig.set(this.extractError(err, 'Failed to load more versions'));
      throw err;
    } finally {
      this.loadingMoreSig.set(false);
    }
  }

  reset(): void {
    this.stateSig.set(EMPTY_STATE);
    this.errorSig.set(null);
    this.loadingSig.set(false);
    this.loadingMoreSig.set(false);
  }

  clearError(): void {
    this.errorSig.set(null);
  }

  private extractError(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
