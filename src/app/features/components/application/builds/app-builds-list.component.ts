import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';

import { Router, ActivatedRoute } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideHammer, lucideRefreshCw } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { AppBuildsService } from '../../../../core/api/api/appBuilds.service';
import { AppBuildResponseDto } from '../../../../core/api/model/appBuildResponseDto';
import { ApplicationService } from '../../../service/application.service';
import { AppDeployStateService } from '../../../service/app-deploy-state.service';
import { BuildBranchService } from '../../../service/build-branch.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlTable } from '../../../../ui/patterns/table';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlSpinner } from '../../../../ui/primitives/spinner';
import { AppBuildRowComponent } from './app-build-row.component';

@Component({
  selector: 'app-builds-list',
  standalone: true,
  imports: [
    AppBuildRowComponent,
    FlPanel,
    FlTable,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucideHammer, lucideRefreshCw })],
  host: { class: 'fl-stack' },
  template: `
    @if (error()) {
      <fl-alert tone="error" title="Request failed">{{ error() }}</fl-alert>
    }

    <fl-panel title="Builds" [count]="builds().length || null" [flush]="true">
      <ng-container panelActions>
        <button flButton size="sm" type="button" (click)="loadBuilds()" [disabled]="isLoading()">
          @if (isLoading()) {
            <fl-spinner label="Refreshing" />
          } @else {
            <fl-icon name="lucideRefreshCw" />
          }
          Refresh
        </button>
        @if (canForceGhaBuild()) {
          <button
            flButton
            size="sm"
            type="button"
            (click)="forceGhaBuild()"
            [disabled]="isForcingBuild()"
          >
            @if (isForcingBuild()) {
              <fl-spinner label="Starting build" />
            } @else {
              <fl-icon name="lucideHammer" />
            }
            Force new build
          </button>
        }
      </ng-container>

      @if (builds().length > 0) {
        <div class="fl-table-wrap relative">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Commit</th>
                <th scope="col">Status</th>
                <th scope="col">Branch</th>
                <th scope="col">Provider</th>
                <th scope="col">Image</th>
                <th scope="col" class="is-num">Duration</th>
                <th scope="col" class="is-num">Started</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (build of builds(); track build.id) {
                <tr
                  app-build-row
                  [build]="build"
                  [deploying]="deployingBuildId() === build.id"
                  [currentAppImageRef]="currentAppImageRef()"
                  (view)="onView($event)"
                  (deploy)="onDeploy($event)"
                ></tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (isLoading()) {
        <fl-loading-state [rows]="4" />
      } @else if (!error()) {
        <fl-empty-state
          title="No builds yet"
          body="History starts with the next build. Earlier runs are not tracked."
          icon="lucideHammer"
        />
      }
    </fl-panel>
  `,
})
export class AppBuildsListComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly appBuildsApi = inject(AppBuildsService);
  private readonly appService = inject(ApplicationService);
  private readonly deployState = inject(AppDeployStateService);
  private readonly toast = inject(ToastService);
  private readonly buildBranch = inject(BuildBranchService);

  builds = signal<AppBuildResponseDto[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  deployingBuildId = signal<string | null>(null);
  isForcingBuild = signal(false);

  readonly canForceGhaBuild = computed(() => {
    const app = this.appService.selectedApplication() as any;
    if (app?.sourceType !== 'git_build') return false;
    return app.buildPath === 'github-actions' || app.buildPath == null;
  });

  readonly currentAppImageRef = computed(() => {
    const app = this.appService.selectedApplication() as any;
    return app?.imageRef ?? null;
  });

  private appId = '';
  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  private fastPollIntervalId: ReturnType<typeof setInterval> | null = null;

  private static readonly TERMINAL_STATES: ReadonlyArray<AppBuildResponseDto['status']> = [
    'COMPLETED',
    'FAILED',
    'CANCELLED',
  ];

  ngOnInit(): void {
    this.appId = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    if (!this.appId) return;
    this.loadBuilds();
    this.pollingIntervalId = setInterval(() => this.loadBuilds(), 30_000);
    this.fastPollIntervalId = setInterval(() => this.refreshNonTerminalBuilds(), 12_000);
  }

  ngOnDestroy(): void {
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
    if (this.fastPollIntervalId) clearInterval(this.fastPollIntervalId);
  }

  private async refreshNonTerminalBuilds(): Promise<void> {
    const nonTerminal = this.builds().filter(
      (b) => !AppBuildsListComponent.TERMINAL_STATES.includes(b.status),
    );
    if (nonTerminal.length === 0) return;
    await Promise.all(
      nonTerminal.map(async (b) => {
        try {
          const updated = await firstValueFrom(
            this.appBuildsApi.appBuildsControllerRefreshBuild(b.id),
          );
          this.builds.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
        } catch {
          return;
        }
      }),
    );
  }

  async loadBuilds(): Promise<void> {
    if (!this.appId) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const builds = await firstValueFrom(
        this.appBuildsApi.appBuildsControllerListBuilds(this.appId),
      );
      this.builds.set(builds);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to load builds');
    } finally {
      this.isLoading.set(false);
    }
  }

  onView(build: AppBuildResponseDto): void {
    this.router.navigate(['/apps/deploy/build', this.appId, build.id]);
  }

  async onDeploy(build: AppBuildResponseDto): Promise<void> {
    if (this.deployingBuildId() !== null) return;
    if (!build.imageRef) return;
    this.deployingBuildId.set(build.id);
    this.error.set(null);
    try {
      const opId = await this.appService.deploy(this.appId, { buildId: build.id });
      if (opId && build.imageRef) {
        this.deployState.startDeploy({
          appId: this.appId,
          operationId: opId,
          targetImageRef: build.imageRef,
          targetDigest: null,
        });
      }
      this.router.navigate(['/apps/applications', this.appId, 'images']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? e?.message ?? 'Failed to release build');
    } finally {
      this.deployingBuildId.set(null);
    }
  }

  async forceGhaBuild(): Promise<void> {
    if (!this.appId) return;
    this.isForcingBuild.set(true);
    this.error.set(null);
    try {
      const branch = await this.buildBranch.branchFor(this.appService.selectedApplication());
      await this.appService.generateWorkflowV3(this.appId, { branch, force: true });
      this.toast.showSuccess({
        message: `Build triggered with a workflow commit on ${branch}. The new run will appear in the list shortly.`,
      });
      await this.loadBuilds();
      setTimeout(() => this.loadBuilds(), 4_000);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to trigger build');
    } finally {
      this.isForcingBuild.set(false);
    }
  }
}
