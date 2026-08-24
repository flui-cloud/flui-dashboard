import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ImageRegistryService } from '../../core/api/api/imageRegistry.service';
import { ImageResponseDto } from '../../core/api/model/imageResponseDto';
import { GhcrTagDto } from '../../core/api/model/ghcrTagDto';
import {
  isSandboxRefusal,
  sandboxFailureMessage,
} from '../../core/services/sandbox.service';

@Injectable({
  providedIn: 'root',
})
export class ImageRegistryFeatureService {
  private readonly api = inject(ImageRegistryService);

  // Local DB image metadata signals
  private readonly imagesList = signal<ImageResponseDto[]>([]);
  private readonly isLoading = signal<boolean>(false);
  private readonly error = signal<string | null>(null);
  /**
   * The refusal, kept apart from the failures.
   *
   * A guest of the demo cannot reach the registry at all, and the fence says so
   * in a sentence written for a person. Painting that sentence red — with the
   * same border a broken cluster gets — teaches the guest that Flui is broken
   * rather than that this is not part of the trial.
   */
  private readonly refusedSignal = signal(false);
  private readonly refusalMessageSignal = signal<string | null>(null);

  readonly images = this.imagesList.asReadonly();
  readonly loading = this.isLoading.asReadonly();
  readonly errorMessage = this.error.asReadonly();
  readonly refused = this.refusedSignal.asReadonly();
  readonly refusalMessage = this.refusalMessageSignal.asReadonly();

  // GHCR registry enrichment signals
  private readonly ghcrTagsList = signal<GhcrTagDto[]>([]);
  private readonly ghcrIsLoading = signal<boolean>(false);
  private readonly ghcrError = signal<string | null>(null);

  readonly ghcrTags = this.ghcrTagsList.asReadonly();
  readonly ghcrLoading = this.ghcrIsLoading.asReadonly();
  readonly ghcrErrorMessage = this.ghcrError.asReadonly();

  async loadImages(appId?: string, tag?: string): Promise<void> {
    this.isLoading.set(true);
    this.clearError();
    try {
      const images = await firstValueFrom(
        this.api.imageRegistryControllerListImages(appId, tag, 1, 100)
      );
      this.imagesList.set(images);
    } catch (error: any) {
      this.noteFailure(error, 'Failed to load images');
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadImagesByApp(appId: string): Promise<void> {
    this.isLoading.set(true);
    this.clearError();
    try {
      const images = await firstValueFrom(
        this.api.imageRegistryControllerListImagesByApp(appId)
      );
      this.imagesList.set(images);
    } catch (error: any) {
      this.noteFailure(error, 'Failed to load images');
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async addTag(imageId: string, tag: string): Promise<ImageResponseDto> {
    const updated = await firstValueFrom(
      this.api.imageRegistryControllerAddFluiTag(imageId, { tag })
    );
    this.imagesList.update(imgs => imgs.map(i => i.id === imageId ? updated : i));
    return updated;
  }

  async removeTag(imageId: string, tag: string): Promise<ImageResponseDto> {
    const updated = await firstValueFrom(
      this.api.imageRegistryControllerRemoveFluiTag(imageId, tag)
    );
    this.imagesList.update(imgs => imgs.map(i => i.id === imageId ? updated : i));
    return updated;
  }

  async deployImage(imageId: string): Promise<void> {
    await firstValueFrom(
      this.api.imageRegistryControllerDeployImage(imageId)
    );
  }

  async deleteImage(imageId: string): Promise<void> {
    await firstValueFrom(
      this.api.imageRegistryControllerDeleteImage(imageId)
    );
    this.imagesList.update(imgs => imgs.filter(i => i.id !== imageId));
  }

  clearError(): void {
    this.error.set(null);
    this.refusedSignal.set(false);
    this.refusalMessageSignal.set(null);
  }

  /**
   * One place decides whether what just happened was a no or a fault.
   * `sandboxFailureMessage` returns null on a refusal, which is what keeps the
   * red banner empty without a second branch at the call site.
   */
  private noteFailure(error: unknown, fallback: string): void {
    const refused = isSandboxRefusal(error);
    this.refusedSignal.set(refused);
    this.refusalMessageSignal.set(
      refused
        ? ((error as { error?: { message?: string } })?.error?.message ?? null)
        : null,
    );
    this.error.set(
      sandboxFailureMessage(
        error,
        (error as { error?: { message?: string }; message?: string })?.error
          ?.message ||
          (error as { message?: string })?.message ||
          fallback,
      ),
    );
  }

  // --- GHCR Registry Methods ---

  async loadGhcrVersions(appId: string): Promise<void> {
    this.ghcrIsLoading.set(true);
    this.ghcrError.set(null);
    try {
      const tags = await firstValueFrom(
        this.api.imageRegistryControllerListGhcrVersions(appId)
      );
      this.ghcrTagsList.set(tags);
    } catch (error: any) {
      const status = error?.status;
      if (status === 404) {
        this.ghcrTagsList.set([]);
        this.ghcrError.set(null);
        return;
      }
      if (status === 403) {
        this.ghcrError.set('Insufficient GitHub permissions. Re-install the Flui GitHub App.');
      } else {
        this.ghcrError.set(error?.error?.message || error?.message || 'Failed to load GHCR images');
      }
      throw error;
    } finally {
      this.ghcrIsLoading.set(false);
    }
  }

  async deleteGhcrVersion(appId: string, versionId: number, force = false): Promise<void> {
    await firstValueFrom(
      this.api.imageRegistryControllerDeleteGhcrVersion(appId, versionId, force ? 'true' : 'false')
    );
    this.ghcrTagsList.update(tags => tags.filter(t => t.versionId !== versionId));
  }

  async redeployGhcrTag(appId: string, tag: string): Promise<{ operationId: string; status: string }> {
    return await firstValueFrom(
      this.api.imageRegistryControllerRedeployGhcrTag(appId, tag)
    );
  }
}
