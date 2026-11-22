import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { accessOf } from '../../model/app-access';

import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowRight } from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { AppVersioningService } from '../../service/app-versioning.service';
import { AppReleaseService } from '../../service/app-release.service';
import { AppDeployStateService } from '../../service/app-deploy-state.service';
import { ImageRegistryFeatureService } from '../../service/image-registry.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AvailableVersionDto } from '../../../core/api/model/availableVersionDto';
import { AvailableVersionsResponseDto } from '../../../core/api/model/availableVersionsResponseDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { AppCurrentRelease } from './app-current-release';
import { AppReleaseRow } from './app-release-row';
import { AppReleaseDeployDialog } from './app-release-deploy-dialog';
import { AppReleaseDeleteDialog } from './app-release-delete-dialog';

@Component({
  selector: 'app-images-tab',
  standalone: true,
  imports: [
    RouterLink,
    FlPanel,
    FlTable,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
    AppCurrentRelease,
    AppReleaseRow,
    AppReleaseDeployDialog,
    AppReleaseDeleteDialog,
  ],
  providers: [provideIcons({ lucideArrowRight })],
  host: { class: 'fl-stack', '[class.look-only]': 'readOnly()' },
  template: `
    @if (autoDeployOnPush()) {
      <fl-alert title="Auto-deploy on push">
        This application follows
        @if (deployBranch(); as b) {
          <span class="fl-mono">{{ b }}</span>
        } @else {
          its branch
        }
        and rolls out every successful build within seconds. Releasing an older version here would
        be undone, so release is off.
        @if (showPinHelp()) {
          <span class="mt-2 flex flex-col gap-1.5">
            <span>Push to the branch: the build that succeeds is what runs.</span>
            <span>
              To pin an older version, turn auto-deploy off first. Today that is only possible
              through the API:
            </span>
            <span class="fl-mono break-all">
              PATCH /api/v1/applications/{{ appIdForHelp() }} &#123;"deployOnPush": false&#125;
            </span>
          </span>
        }
        <button
          alertActions
          flButton="ghost"
          size="sm"
          type="button"
          [attr.aria-expanded]="showPinHelp()"
          (click)="showPinHelp.set(!showPinHelp())"
        >
          {{ showPinHelp() ? 'Hide' : 'How do I change what runs?' }}
        </button>
      </fl-alert>
    }

    @if (githubAppMissing()) {
      <fl-alert tone="warning" title="GitHub integration required">
        Connect GitHub from Repositories to list the versions of
        <span class="fl-mono">ghcr.io</span> images.
        <a alertActions flButton size="sm" routerLink="/apps/repositories">
          Go to Repositories
          <fl-icon name="lucideArrowRight" />
        </a>
      </fl-alert>
    } @else if (versioning.error()) {
      <fl-alert tone="error" title="Could not load versions">{{ versioning.error() }}</fl-alert>
    }

    @if (statusMessage(); as m) {
      <fl-alert
        [tone]="m.type === 'error' ? 'error' : 'info'"
        [title]="m.type === 'error' ? 'Release failed' : 'Release started'"
      >
        {{ m.text }}
      </fl-alert>
    }

    <app-current-release
      [version]="deployState.currentlyDeployed()"
      [sourceType]="sourceTypeLabel()"
      [autoDeploy]="autoDeployOnPush()"
      [branch]="deployBranch()"
      [hasUpdate]="versioning.hasUpdate()"
      [loading]="versioning.loading()"
      (refresh)="refresh()"
    />

    @if (versioning.versions().length > 0 || !versioning.error()) {
      <fl-panel title="Versions" [count]="shownVersions().length || null" [flush]="true">
        @if (hiddenCount() > 0) {
          <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
            <div class="fl-toolbar__group">
              <button
                type="button"
                class="fl-chip"
                [attr.aria-pressed]="showAll()"
                (click)="showAll.set(!showAll())"
              >
                Include versions it cannot run
                <span class="fl-chip__count">{{ hiddenCount() }}</span>
              </button>
            </div>
          </div>
        }

        @if (versioning.loading() && versioning.versions().length === 0) {
          <fl-loading-state [rows]="4" />
        } @else if (versioning.versions().length === 0 && !versioning.error()) {
          <fl-empty-state title="No versions yet" />
        } @else if (shownVersions().length > 0) {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Tag</th>
                  <th scope="col">Status</th>
                  <th scope="col">Digest</th>
                  <th scope="col">Platforms</th>
                  <th scope="col" class="is-num">Created</th>
                  <th scope="col" class="is-num">Last released</th>
                  <th scope="col" class="is-num">Releases</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (v of shownVersions(); track v.imageRef) {
                  <tr
                    app-release-row
                    [version]="v"
                    [releasing]="isReleasing(v)"
                    [progress]="deployState.progress()"
                    [autoDeploy]="autoDeployOnPush()"
                    [locked]="actionsLocked()"
                    [readOnly]="readOnly()"
                    (deploy)="openDeploy($event)"
                    (remove)="openDelete($event)"
                  ></tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (versioning.versions().length > 0) {
          <fl-empty-state
            title="No version this application can run"
            body="Include the others with the filter above."
            [compact]="true"
          />
        }

        @if (versioning.hasMore()) {
          <div class="flex justify-center border-t border-fl-border-subtle p-3">
            <button
              flButton
              size="sm"
              type="button"
              (click)="loadMore()"
              [disabled]="versioning.loadingMore()"
            >
              @if (versioning.loadingMore()) {
                <fl-spinner label="Loading" />
                Loading…
              } @else {
                Load more
              }
            </button>
          </div>
        }
      </fl-panel>
    }

    @if (deleteTarget(); as dt) {
      <app-release-delete-dialog
        [version]="dt"
        [deleting]="deletingVersionId() !== null"
        [(force)]="forceOverride"
        (cancelled)="cancelDelete()"
        (confirm)="confirmDelete()"
      />
    }

    @if (deployTarget(); as target) {
      <app-release-deploy-dialog
        [version]="target"
        [busy]="busy()"
        (cancelled)="cancelDeploy()"
        (confirm)="confirmDeploy($event)"
      />
    }
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

  showPinHelp = signal(false);
  showAll = signal(false);

  /**
   * Older installations do not send the field. Absent means "not judged", which
   * has to read as releasable — otherwise upgrading the dashboard ahead of the
   * API empties every list.
   */
  isReleasable(v: AvailableVersionDto): boolean {
    return v.releasable !== false;
  }

  /**
   * The list is what this application can actually be asked to run. A row that
   * cannot be pressed teaches people not to trust the rows that can, so the
   * rest waits behind a count.
   */
  readonly shownVersions = computed(() =>
    this.showAll()
      ? this.versioning.versions()
      : this.versioning.versions().filter((v) => this.isReleasable(v)),
  );

  readonly hiddenCount = computed(
    () => this.versioning.versions().filter((v) => !this.isReleasable(v)).length,
  );

  protected readonly readOnly = computed(
    () => accessOf(this.appService.selectedApplication())?.readOnly === true,
  );

  /**
   * The application redeploys itself from its branch, so a release chosen here
   * loses to the next reconcile rather than failing — which is why the buttons
   * go off rather than staying live and being undone.
   */
  readonly autoDeployOnPush = computed(
    () => this.appService.selectedApplication()?.deployOnPush === true,
  );

  readonly deployBranch = computed(() => {
    const cfg = this.appService.selectedApplication()?.sourceConfig as
      { branch?: string } | undefined;
    return cfg?.branch ?? null;
  });

  readonly appIdForHelp = computed(() => this.appService.selectedApplication()?.id ?? '<app-id>');

  deleteTarget = signal<AvailableVersionDto | null>(null);
  forceOverride = signal<boolean>(false);
  deletingVersionId = signal<number | null>(null);

  isReleasing(v: AvailableVersionDto): boolean {
    return this.deployState.isReleasing(v);
  }

  isCurrentRow(v: AvailableVersionDto): boolean {
    return this.deployState.isCurrentRow(v);
  }

  readonly actionsLocked = computed(
    () => this.busy() || !!this.deployState.deployInFlight() || this.deletingVersionId() !== null,
  );

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
    } catch {
      return;
    }
  }

  async loadMore(): Promise<void> {
    if (!this.appId) return;
    try {
      await this.versioning.loadMore(this.appId);
    } catch {
      return;
    }
  }

  openDeploy(v: AvailableVersionDto): void {
    if (this.isCurrentRow(v)) return;
    this.statusMessage.set(null);
    this.deployTarget.set(v);
  }

  cancelDeploy(): void {
    if (this.busy()) return;
    this.deployTarget.set(null);
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
        this.toast.showError(
          "Can't delete the image currently deployed. Deploy another version first.",
        );
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

  async confirmDeploy(reason: string): Promise<void> {
    const target = this.deployTarget();
    if (!target || !this.appId) return;
    this.busy.set(true);
    this.statusMessage.set(null);
    try {
      const opId = await this.appService.deploy(this.appId, {
        imageRef: target.imageRef,
        reason: reason.trim() || undefined,
      });
      this.deployTarget.set(null);
      if (opId) {
        this.deployState.startDeploy({
          appId: this.appId,
          operationId: opId,
          targetImageRef: target.imageRef,
          targetDigest: target.digest ?? null,
        });
      }
      this.statusMessage.set({
        text: 'Release in progress. The image will become current once the rollout finishes.',
        type: 'success',
      });
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
