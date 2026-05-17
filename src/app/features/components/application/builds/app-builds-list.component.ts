import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideHammer, lucideLoader, lucideRefreshCw, lucideTriangleAlert,
} from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { AppBuildsService } from '../../../../core/api/api/appBuilds.service';
import { AppBuildResponseDto } from '../../../../core/api/model/appBuildResponseDto';
import { ApplicationService } from '../../../service/application.service';
import { AppDeployStateService } from '../../../service/app-deploy-state.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { AppBuildRowComponent } from './app-build-row.component';

@Component({
  selector: 'app-builds-list',
  standalone: true,
  imports: [CommonModule, NgIcon, AppBuildRowComponent],
  providers: [provideIcons({ lucideHammer, lucideLoader, lucideRefreshCw, lucideTriangleAlert })],
  template: `
    <div class="p-6 space-y-6">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <ng-icon name="lucideHammer" class="h-5 w-5" />
            Builds
          </h2>
          <p class="text-sm text-muted-foreground mt-0.5">Build history for this application</p>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="loadBuilds()" [disabled]="isLoading()"
            class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ng-icon name="lucideRefreshCw" [class]="isLoading() ? 'animate-spin' : ''" class="h-4 w-4 mr-1.5" />
            Refresh
          </button>
          @if (canForceGhaBuild()) {
            <button (click)="forceGhaBuild()" [disabled]="isForcingBuild()"
              class="inline-flex items-center text-sm text-primary hover:text-primary/80 disabled:opacity-50 transition-colors">
              @if (isForcingBuild()) {
                <ng-icon name="lucideLoader" class="h-4 w-4 mr-1.5 animate-spin" />
              } @else {
                <ng-icon name="lucideHammer" class="h-4 w-4 mr-1.5" />
              }
              Force new build
            </button>
          }
        </div>
      </div>

      <!-- Error -->
      @if (error()) {
        <div class="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          <ng-icon name="lucideTriangleAlert" class="h-4 w-4 flex-shrink-0" />
          {{ error() }}
        </div>
      }

      <!-- Loading -->
      @if (isLoading() && builds().length === 0) {
        <div class="flex items-center justify-center py-16 text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin mr-2" />
          <span class="text-sm">Loading builds...</span>
        </div>
      }

      <!-- Empty -->
      @if (!isLoading() && builds().length === 0 && !error()) {
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <div class="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <ng-icon name="lucideHammer" class="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 class="font-medium mb-1">No builds yet</h3>
          <p class="text-sm text-muted-foreground max-w-md">
            Build history starts from the next build. Older runs aren't tracked here.
          </p>
        </div>
      }

      <!-- Table -->
      @if (builds().length > 0) {
        <div class="bg-card border border-border rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-muted/40">
                <th class="text-left px-4 py-3 font-medium text-muted-foreground">Provider</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground">Branch</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground">Commit</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground">Image</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground">Duration</th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground">Started</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              @for (build of builds(); track build.id) {
                <app-build-row
                  [build]="build"
                  [deploying]="deployingBuildId() === build.id"
                  [currentAppImageRef]="currentAppImageRef()"
                  (view)="onView($event)"
                  (deploy)="onDeploy($event)" />
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AppBuildsListComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly appBuildsApi = inject(AppBuildsService);
  private readonly appService = inject(ApplicationService);
  private readonly deployState = inject(AppDeployStateService);
  private readonly toast = inject(ToastService);

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
    'COMPLETED', 'FAILED', 'CANCELLED',
  ];

  ngOnInit(): void {
    this.appId = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    if (!this.appId) return;
    this.loadBuilds();
    this.pollingIntervalId = setInterval(() => this.loadBuilds(), 30_000);
    // Forces backend to re-poll GitHub for non-terminal rows so the UI doesn't
    // wait the full 30s (or the backend watcher tick) to see a status flip.
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
          // Best-effort: next tick will retry.
        }
      }),
    );
  }

  async loadBuilds(): Promise<void> {
    if (!this.appId) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const builds = await firstValueFrom(this.appBuildsApi.appBuildsControllerListBuilds(this.appId));
      this.builds.set(builds);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to load builds');
    } finally {
      this.isLoading.set(false);
    }
  }

  onView(build: AppBuildResponseDto): void {
    // GHA rows use an <a target="_blank"> directly, never reach here.
    // IN_CLUSTER_AGENT (and future RAILPACK/DOCKERFILE) navigate to the progress detail.
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
    const app = this.appService.selectedApplication() as any;
    this.isForcingBuild.set(true);
    this.error.set(null);
    try {
      await this.appService.generateWorkflow(this.appId, {
        branch: app?.sourceConfig?.branch ?? 'main',
        framework: app?.sourceConfig?.framework ?? '',
      });
      this.toast.showSuccess({
        message: 'Build triggered. The new run will appear in the list shortly.',
      });
      // Refresh now and again after a short delay: covers the race where the
      // backend hasn't yet created the app_builds row when the first call lands.
      await this.loadBuilds();
      setTimeout(() => this.loadBuilds(), 4_000);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to trigger build');
    } finally {
      this.isForcingBuild.set(false);
    }
  }
}
