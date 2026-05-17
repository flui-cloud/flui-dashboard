import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCw, lucideLoader, lucideRocket, lucideCircleCheck,
  lucideImage, lucideTriangleAlert, lucideTag, lucideX, lucideArrowDown,
  lucideCalendar, lucideCpu, lucideInfo, lucideGithub, lucideArrowRight,
  lucideRotateCcw, lucideHistory, lucideTrash2,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
import { HlmLabelDirective } from '@spartan-ng/ui-label-helm';
import { ApplicationService } from '../../service/application.service';
import { AppVersioningService } from '../../service/app-versioning.service';
import { AppReleaseService } from '../../service/app-release.service';
import { AppDeployStateService } from '../../service/app-deploy-state.service';
import { ImageRegistryFeatureService } from '../../service/image-registry.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AvailableVersionDto } from '../../../core/api/model/availableVersionDto';
import { AvailableVersionsResponseDto } from '../../../core/api/model/availableVersionsResponseDto';
import { ApplicationReleaseDto } from '../../../core/api/model/applicationReleaseDto';

@Component({
  selector: 'app-images-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, RouterLink, HlmButtonDirective, HlmInputDirective, HlmLabelDirective],
  providers: [provideIcons({
    lucideRefreshCw, lucideLoader, lucideRocket, lucideCircleCheck,
    lucideImage, lucideTriangleAlert, lucideTag, lucideX, lucideArrowDown,
    lucideCalendar, lucideCpu, lucideInfo, lucideGithub, lucideArrowRight,
    lucideRotateCcw, lucideHistory, lucideTrash2,
  })],
  template: `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="text-base font-semibold">Releases</h3>
            @if (sourceTypeLabel()) {
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                {{ sourceTypeLabel() }}
              </span>
            }
            @if (versioning.hasUpdate()) {
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                Update available
              </span>
            }
          </div>
          <p class="text-xs text-muted-foreground">
            Each version. Track which is currently deployed and the outcome of past releases.
          </p>
        </div>
        <button hlmBtn variant="outline" size="sm" (click)="refresh()" [disabled]="versioning.loading()">
          <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5 mr-1.5" [class.animate-spin]="versioning.loading()" />
          Refresh
        </button>
      </div>

      @if (githubAppMissing()) {
        <div class="p-4 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/40">
          <div class="flex items-start gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200/70 dark:bg-amber-900/60 shrink-0">
              <ng-icon name="lucideGithub" class="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div class="flex-1 min-w-0 space-y-2">
              <div>
                <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">GitHub integration required</p>
                <p class="text-sm text-amber-800/90 dark:text-amber-200/80 mt-0.5">
                  Connect your GitHub account from the Repositories page to list available versions for <span class="font-mono">ghcr.io</span> images.
                </p>
              </div>
              <button hlmBtn size="sm" routerLink="/apps/repositories"
                class="bg-amber-600 hover:bg-amber-700 text-white border-amber-600">
                Go to Repositories
                <ng-icon name="lucideArrowRight" class="h-3.5 w-3.5 ml-1.5" />
              </button>
            </div>
          </div>
        </div>
      } @else if (versioning.error()) {
        <div class="p-3 rounded-md border border-destructive/40 bg-destructive/10 text-sm text-destructive-foreground dark:text-destructive">
          {{ versioning.error() }}
        </div>
      }

      @if (versioning.loading() && versioning.versions().length === 0) {
        <div class="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" /> Loading versions...
        </div>
      } @else if (versioning.versions().length === 0 && !versioning.error()) {
        <div class="text-center py-8">
          <ng-icon name="lucideImage" class="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p class="text-sm text-muted-foreground">No versions available yet.</p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (v of versioning.versions(); track v.imageRef) {
            <div [class]="rowClass(v)">
              <div class="flex-1 min-w-0 space-y-1.5">
                <!-- Tags row -->
                <div class="flex items-center gap-2 flex-wrap">
                  @let st = stateFor(v);
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium" [class]="st.class">
                    <ng-icon [name]="st.icon" class="h-3 w-3" [class.animate-spin]="st.kind === 'releasing'" />
                    {{ st.label }}
                  </span>
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono bg-primary/10 text-primary">
                    <ng-icon name="lucideTag" class="h-2.5 w-2.5" /> {{ v.tag }}
                  </span>
                  @for (alias of otherTags(v); track alias) {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono bg-muted text-muted-foreground">
                      {{ alias }}
                    </span>
                  }
                  @if (v.deployHint && !isCurrentRow(v)) {
                    <span [class]="'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ' + deployHintClass(v.deployHint)">
                      <ng-icon name="lucideInfo" class="h-3 w-3" /> {{ v.deployHint }}
                    </span>
                  }
                </div>

                <!-- Image ref -->
                <p class="text-xs text-muted-foreground font-mono break-all" [title]="v.imageRef">
                  {{ v.imageRef }}
                </p>

                <!-- Failure reason for the latest release on this image -->
                @if (lastReleaseFor(v); as lr) {
                  @if (lr.status === 'FAILED' && lr.failureReason) {
                    <p class="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
                      {{ lr.failureReason }}
                    </p>
                  }
                }

                <!-- Meta row -->
                <div class="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  @if (v.createdAt) {
                    <span class="inline-flex items-center gap-1">
                      <ng-icon name="lucideCalendar" class="h-3 w-3" /> {{ formatDate(v.createdAt) }}
                    </span>
                  }
                  @if (v.digest) {
                    <span class="font-mono" [title]="v.digest">{{ shortDigest(v.digest) }}</span>
                  }
                  @if (v.platforms?.length) {
                    <span class="inline-flex items-center gap-1">
                      <ng-icon name="lucideCpu" class="h-3 w-3" /> {{ v.platforms!.join(', ') }}
                    </span>
                  }
                  @if (lastReleaseFor(v); as lr) {
                    <span class="inline-flex items-center gap-1" [title]="'Last release: ' + formatDate(lr.startedAt)">
                      <ng-icon name="lucideRocket" class="h-3 w-3" />
                      Last released {{ formatDate(lr.startedAt) }}
                    </span>
                    @if (releaseCount(v) > 1) {
                      <span class="inline-flex items-center gap-1">
                        <ng-icon name="lucideHistory" class="h-3 w-3" />
                        {{ releaseCount(v) }} releases
                      </span>
                    }
                  }
                </div>
              </div>

              <div class="shrink-0 flex items-center gap-2">
                @if (isCurrentRow(v)) {
                  <!-- No action: this version is already deployed. -->
                } @else if (isReleasing(v)) {
                  <span class="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                    <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                    Releasing@if (deployState.progress(); as p) { · {{ p }}%}
                  </span>
                } @else {
                  <button hlmBtn variant="outline" size="sm" (click)="openDeploy(v)"
                    [disabled]="busy() || !!deployState.deployInFlight() || deletingVersionId() !== null">
                    <ng-icon name="lucideRocket" class="h-3 w-3 mr-1" /> Deploy
                  </button>
                  @if (v.versionId != null) {
                    <button hlmBtn variant="ghost" size="sm" (click)="openDelete(v)"
                      [disabled]="busy() || !!deployState.deployInFlight() || deletingVersionId() !== null"
                      class="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Delete image version from GHCR">
                      <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
                    </button>
                  }
                }
              </div>
            </div>
          }
        </div>

        <!-- Load more (DockerHub pagination) -->
        @if (versioning.hasMore()) {
          <div class="flex justify-center pt-2">
            <button hlmBtn variant="outline" size="sm" (click)="loadMore()" [disabled]="versioning.loadingMore()">
              @if (versioning.loadingMore()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 mr-1.5 animate-spin" /> Loading...
              } @else {
                <ng-icon name="lucideArrowDown" class="h-3.5 w-3.5 mr-1.5" /> Load more
              }
            </button>
          </div>
        }
      }

      @if (statusMessage()) {
        <p class="text-xs" [class]="statusMessage()!.type === 'error' ? 'text-destructive' : 'text-green-600'">
          {{ statusMessage()!.text }}
        </p>
      }

      <!-- Deploy modal with optional reason -->
      @if (deleteTarget(); as dt) {
        <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" (click)="cancelDelete()">
          <div class="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] p-4">
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
              (click)="$event.stopPropagation()">
              <div class="flex items-start justify-between p-6 pb-4 gap-4">
                <div class="flex items-start gap-4 flex-1 min-w-0">
                  <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 shrink-0">
                    <ng-icon name="lucideTrash2" class="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div class="flex-1 min-w-0 space-y-3">
                    <div>
                      <h3 class="text-lg font-semibold">Delete image version</h3>
                      <p class="text-sm text-muted-foreground mt-1">
                        This will permanently remove the image from GitHub Container Registry. This action cannot be undone.
                      </p>
                    </div>
                    <div class="space-y-1 text-xs">
                      <p class="font-mono break-all">{{ dt.imageRef }}</p>
                      <div class="flex items-center gap-3 text-muted-foreground flex-wrap">
                        <span class="inline-flex items-center gap-1">
                          <ng-icon name="lucideTag" class="h-3 w-3" /> {{ dt.tag }}
                        </span>
                        @if (dt.digest) {
                          <span class="font-mono" [title]="dt.digest">{{ shortDigest(dt.digest) }}</span>
                        }
                        @if (releaseCount(dt) > 0) {
                          <span class="inline-flex items-center gap-1">
                            <ng-icon name="lucideHistory" class="h-3 w-3" />
                            {{ releaseCount(dt) }} releases
                          </span>
                        }
                        @if (lastReleaseFor(dt); as lr) {
                          <span>Last: {{ lr.status }}</span>
                        }
                      </div>
                    </div>
                    @if (dt.isLatestRelease) {
                      <div class="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/40 p-3 space-y-2">
                        <div class="flex items-start gap-2">
                          <ng-icon name="lucideTriangleAlert" class="h-4 w-4 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
                          <p class="text-xs text-amber-900 dark:text-amber-100">
                            This is the latest release of the app (even if no longer deployed). Deleting it makes a fast rollback to this version impossible.
                          </p>
                        </div>
                        <label class="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-100 cursor-pointer">
                          <input type="checkbox" [checked]="forceOverride()"
                            (change)="forceOverride.set($any($event.target).checked)"
                            [disabled]="deletingVersionId() !== null" />
                          Yes, I want to delete it anyway.
                        </label>
                      </div>
                    }
                  </div>
                </div>
                <button hlmBtn variant="ghost" size="sm" (click)="cancelDelete()"
                  [disabled]="deletingVersionId() !== null" class="h-8 w-8 p-0 shrink-0">
                  <ng-icon name="lucideX" class="h-4 w-4" />
                </button>
              </div>
              <div class="flex items-center justify-end gap-3 px-6 pb-6">
                <button hlmBtn variant="outline" (click)="cancelDelete()" [disabled]="deletingVersionId() !== null">Cancel</button>
                <button hlmBtn (click)="confirmDelete()"
                  [disabled]="deletingVersionId() !== null || (dt.isLatestRelease && !forceOverride())"
                  class="bg-red-600 hover:bg-red-700 text-white">
                  @if (deletingVersionId() !== null) {
                    <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" /> Deleting...
                  } @else {
                    Delete
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      @if (deployTarget()) {
        <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" (click)="cancelDeploy()">
          <div class="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] p-4">
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
              (click)="$event.stopPropagation()">
              <div class="flex items-start justify-between p-6 pb-4 gap-4">
                <div class="flex items-start gap-4 flex-1 min-w-0">
                  <div class="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20 shrink-0">
                    <ng-icon name="lucideRocket" class="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div class="flex-1 min-w-0 space-y-3">
                    <div>
                      <h3 class="text-lg font-semibold">Deploy version</h3>
                      <p class="text-sm text-muted-foreground mt-1">
                        This will replace the currently running version with:
                      </p>
                      <p class="text-xs font-mono mt-1 break-all">{{ deployTarget()!.imageRef }}</p>
                    </div>
                    <div class="space-y-1.5">
                      <label hlmLabel for="deploy-reason" class="text-xs">Reason (optional)</label>
                      <input hlmInput id="deploy-reason" type="text"
                        [(ngModel)]="deployReason" maxlength="200"
                        placeholder="e.g. Bumping to v1.2.3 for hotfix"
                        [disabled]="busy()" />
                    </div>
                  </div>
                </div>
                <button hlmBtn variant="ghost" size="sm" (click)="cancelDeploy()"
                  [disabled]="busy()" class="h-8 w-8 p-0 shrink-0">
                  <ng-icon name="lucideX" class="h-4 w-4" />
                </button>
              </div>
              <div class="flex items-center justify-end gap-3 px-6 pb-6">
                <button hlmBtn variant="outline" (click)="cancelDeploy()" [disabled]="busy()">Cancel</button>
                <button hlmBtn (click)="confirmDeploy()" [disabled]="busy()"
                  class="bg-blue-600 hover:bg-blue-700 text-white">
                  @if (busy()) {
                    <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" /> Deploying...
                  } @else {
                    Deploy
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AppImagesTabComponent implements OnInit {
  protected versioning = inject(AppVersioningService);
  protected deployState = inject(AppDeployStateService);
  private readonly appService = inject(ApplicationService);
  private readonly releaseService = inject(AppReleaseService);
  private readonly imageRegistry = inject(ImageRegistryFeatureService);
  private readonly toast = inject(ToastService);

  busy = signal(false);
  statusMessage = signal<{ text: string; type: 'success' | 'error' } | null>(null);
  deployTarget = signal<AvailableVersionDto | null>(null);
  deployReason = '';

  deleteTarget = signal<AvailableVersionDto | null>(null);
  forceOverride = signal<boolean>(false);
  deletingVersionId = signal<number | null>(null);

  lastReleaseFor(v: AvailableVersionDto): ApplicationReleaseDto | null {
    return v.lastRelease ?? null;
  }

  releaseCount(v: AvailableVersionDto): number {
    return v.releaseCount ?? 0;
  }

  stateFor(v: AvailableVersionDto): { kind: string; label: string; icon: string; class: string } {
    const lr = v.lastRelease ?? null;
    if (v.isCurrentlyDeployed) {
      return {
        kind: 'current',
        label: 'Currently deployed',
        icon: 'lucideCircleCheck',
        class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      };
    }
    if (lr?.status === 'IN_PROGRESS') {
      return {
        kind: 'releasing',
        label: 'Releasing',
        icon: 'lucideLoader',
        class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      };
    }
    if (lr?.status === 'FAILED') {
      return {
        kind: 'failed',
        label: v.isLatestRelease ? 'Last release failed' : 'Release failed',
        icon: 'lucideTriangleAlert',
        class: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      };
    }
    if (lr?.status === 'ROLLED_BACK') {
      return {
        kind: 'rolled-back',
        label: 'Rolled back',
        icon: 'lucideRotateCcw',
        class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
      };
    }
    if (lr?.status === 'SUCCEEDED') {
      return {
        kind: 'previous',
        label: 'Previously released',
        icon: 'lucideHistory',
        class: 'bg-muted text-muted-foreground',
      };
    }
    return {
      kind: 'never',
      label: 'Never released',
      icon: 'lucideTag',
      class: 'bg-muted text-muted-foreground',
    };
  }

  rowClass(v: AvailableVersionDto): string {
    const base = 'flex items-start gap-3 p-3 rounded-lg border transition-colors';
    if (this.deployState.isReleasing(v)) {
      return `${base} border-blue-300 dark:border-blue-700`;
    }
    if (v.lastRelease?.status === 'FAILED' && v.isLatestRelease) {
      return `${base} border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-900/5`;
    }
    if (v.isCurrentlyDeployed) {
      return `${base} border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-900/5`;
    }
    return `${base} border-border`;
  }

  isReleasing(v: AvailableVersionDto): boolean {
    return this.deployState.isReleasing(v);
  }

  isCurrentRow(v: AvailableVersionDto): boolean {
    return this.deployState.isCurrentRow(v);
  }

  readonly githubAppMissing = computed(() => {
    const e = this.versioning.error();
    return !!e && /github app is not installed/i.test(e);
  });

  readonly sourceTypeLabel = computed(() => {
    const t = this.versioning.sourceType();
    if (!t) return null;
    const labels: Record<string, string> = {
      [AvailableVersionsResponseDto.SourceTypeEnum.GitBuild]: 'Git build',
      [AvailableVersionsResponseDto.SourceTypeEnum.DockerImage]: 'Docker image',
      [AvailableVersionsResponseDto.SourceTypeEnum.HelmChart]: 'Helm chart',
      [AvailableVersionsResponseDto.SourceTypeEnum.RawManifest]: 'Raw manifest',
    };
    return labels[t] ?? t;
  });

  private get appId(): string {
    return this.appService.selectedApplication()?.id ?? '';
  }

  ngOnInit(): void {
    void (async () => {
      if (this.appId) {
        this.versioning.reset();
        this.releaseService.subscribe(this.appId);
        const app = this.appService.selectedApplication();
        this.deployState.resumeFromLastOperation(this.appId, app?.lastOperation);
        await this.refresh();
      }
    })();
  }

  async refresh(): Promise<void> {
    if (!this.appId) return;
    try {
      await this.versioning.loadAvailableVersions(this.appId);
    } catch { /* surfaced via service.error */ }
  }

  async loadMore(): Promise<void> {
    if (!this.appId) return;
    try {
      await this.versioning.loadMore(this.appId);
    } catch { /* surfaced via service.error */ }
  }

  otherTags(v: AvailableVersionDto): string[] {
    return (v.allTags ?? []).filter((t) => t !== v.tag);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  shortDigest(digest: string): string {
    const idx = digest.indexOf(':');
    const body = idx >= 0 ? digest.slice(idx + 1) : digest;
    return (idx >= 0 ? digest.slice(0, idx + 1) : '') + body.slice(0, 12);
  }

  deployHintClass(hint: string): string {
    switch (hint) {
      case 'deployable':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'needs-sidecar':
      case 'cli-tool':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'build-image':
      case 'base-os':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }

  openDeploy(v: AvailableVersionDto): void {
    if (this.isCurrentRow(v)) return;
    this.deployReason = '';
    this.statusMessage.set(null);
    this.deployTarget.set(v);
  }

  cancelDeploy(): void {
    if (this.busy()) return;
    this.deployTarget.set(null);
    this.deployReason = '';
  }

  openDelete(v: AvailableVersionDto): void {
    if (v.isCurrentlyDeployed || v.versionId == null) return;
    this.forceOverride.set(false);
    this.deleteTarget.set(v);
  }

  cancelDelete(): void {
    if (this.deletingVersionId() !== null) return;
    this.deleteTarget.set(null);
    this.forceOverride.set(false);
  }

  async confirmDelete(): Promise<void> {
    const v = this.deleteTarget();
    if (v?.versionId == null || !this.appId) return;
    const force = !!v.isLatestRelease && this.forceOverride();
    this.deletingVersionId.set(v.versionId);
    try {
      await this.imageRegistry.deleteGhcrVersion(this.appId, v.versionId, force);
      this.toast.showSuccess(`Image ${v.tag} deleted from GHCR.`);
      this.deleteTarget.set(null);
      this.forceOverride.set(false);
      await this.versioning.loadAvailableVersions(this.appId);
    } catch (e: any) {
      const status = e?.status;
      const msg: string = e?.error?.message ?? e?.message ?? '';
      if (status === 400 && /currently deployed/i.test(msg)) {
        this.toast.showError("Can't delete the image currently deployed. Deploy another version first.");
        this.deleteTarget.set(null);
        await this.versioning.loadAvailableVersions(this.appId);
      } else if (status === 400 && /latest release/i.test(msg)) {
        this.forceOverride.set(false);
        this.toast.showWarning('This is the latest release. Confirm the override to proceed.');
      } else if (status === 404) {
        this.toast.showInfo('Version no longer present on GHCR.');
        this.deleteTarget.set(null);
        await this.versioning.loadAvailableVersions(this.appId);
      } else {
        this.toast.showError(msg || 'Failed to delete image version.');
      }
    } finally {
      this.deletingVersionId.set(null);
    }
  }

  async confirmDeploy(): Promise<void> {
    const target = this.deployTarget();
    if (!target || !this.appId) return;
    this.busy.set(true);
    this.statusMessage.set(null);
    try {
      const reason = this.deployReason.trim() || undefined;
      const opId = await this.appService.deploy(this.appId, {
        imageRef: target.imageRef,
        reason,
      });
      this.deployTarget.set(null);
      this.deployReason = '';
      if (opId) {
        this.deployState.startDeploy({
          appId: this.appId,
          operationId: opId,
          targetImageRef: target.imageRef,
          targetDigest: target.digest ?? null,
        });
      }
      this.statusMessage.set({ text: 'Release in progress. The image will become current once the rollout finishes.', type: 'success' });
    } catch (e: any) {
      this.statusMessage.set({
        text: e?.error?.message ?? e?.message ?? 'Release failed',
        type: 'error',
      });
    } finally {
      this.busy.set(false);
    }
  }
}
