import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideGithub,
  lucideLoader,
  lucideCheck,
  lucideX,
  lucideExternalLink,
  lucideRefreshCw,
  lucideRocket,
  lucideCircleCheck,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { ApplicationService } from '../../service/application.service';
import { AppRuntimeWebSocketService, BuildCompletedEvent, BuildFailedEvent, OperationProgressEvent, OperationFailedEvent } from '../../service/app-runtime-websocket.service';
import { AppBuildsService } from '../../../core/api/api/appBuilds.service';
import { AppBuildResponseDto } from '../../../core/api/model/appBuildResponseDto';
import {
  Application,
  ApplicationStatus,
  ApplicationStatusEnum,
  LastBuildStatusEnum,
  LastBuildConclusionEnum,
} from '../../model/application.models';

type MonitorPhase = 'queued' | 'building' | 'build_done' | 'deploying' | 'live' | 'build_failed' | 'deploy_failed';

interface TimelineStep {
  label: string;
  phase: MonitorPhase;
  activePhases: MonitorPhase[];
  donePhases: MonitorPhase[];
}

const TIMELINE_STEPS: TimelineStep[] = [
  {
    label: 'Waiting in GitHub Actions queue',
    phase: 'queued',
    activePhases: ['queued'],
    donePhases: ['building', 'build_done', 'deploying', 'live'],
  },
  {
    label: 'Build in progress',
    phase: 'building',
    activePhases: ['building'],
    donePhases: ['build_done', 'deploying', 'live'],
  },
  {
    label: 'Image ready — starting deploy',
    phase: 'build_done',
    activePhases: ['build_done', 'deploying'],
    donePhases: ['live'],
  },
  {
    label: 'Deploying to cluster',
    phase: 'deploying',
    activePhases: ['deploying'],
    donePhases: ['live'],
  },
  {
    label: 'App live',
    phase: 'live',
    activePhases: [],
    donePhases: ['live'],
  },
];

// Build timeout (backend hard cap). Shows a warning above this threshold.
const BUILD_WARNING_MS = 25 * 60 * 1000;

@Component({
  selector: 'app-github-actions-monitor',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({ lucideGithub, lucideLoader, lucideCheck, lucideX, lucideExternalLink, lucideRefreshCw, lucideRocket, lucideCircleCheck, lucideTriangleAlert }),
  ],
  template: `
    <div class="min-h-screen bg-background">
      <div class="max-w-2xl mx-auto px-6 py-12 space-y-8">

        <!-- Header -->
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">
            @switch (phase()) {
              @case ('build_failed') { Build Failed }
              @case ('deploy_failed') { Deploy Failed }
              @case ('live') { App is Live }
              @default { Build in Progress }
            }
          </h1>
          <p class="text-sm text-muted-foreground">GitHub Actions · {{ applicationId() }}</p>
        </div>

        <!-- Build failed state -->
        @if (phase() === 'build_failed') {
          <div class="rounded-lg border border-destructive/30 bg-destructive/5 p-5 space-y-4">
            <div class="flex items-start gap-2 text-destructive">
              <ng-icon name="lucideX" class="h-5 w-5 shrink-0 mt-0.5" />
              <div class="space-y-1">
                <p class="text-sm font-medium">The GitHub Actions workflow failed.</p>
                @if (buildError()) {
                  <p class="text-xs text-muted-foreground">{{ buildError() }}</p>
                }
              </div>
            </div>
            <div class="flex items-center gap-3">
              @if (githubRunUrl()) {
                <a
                  [href]="githubRunUrl()"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
                  View logs on GitHub
                </a>
              }
              <button
                type="button"
                (click)="retry()"
                class="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-accent transition-colors"
              >
                <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          </div>
        }

        <!-- Live state -->
        @if (phase() === 'live') {
          <div class="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 p-5">
            <div class="flex items-center gap-2 text-green-700 dark:text-green-400">
              <ng-icon name="lucideCircleCheck" class="h-5 w-5" />
              <span class="font-medium">Application deployed successfully</span>
            </div>
            <div class="mt-3 flex gap-3">
              <button
                type="button"
                (click)="goToApp()"
                class="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <ng-icon name="lucideRocket" class="h-3.5 w-3.5" />
                View application
              </button>
            </div>
          </div>
        }

        <!-- Timeline -->
        @if (!['build_failed', 'deploy_failed'].includes(phase())) {
          <div class="space-y-3">
            @for (step of timelineSteps; track step.phase) {
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  @if (isStepDone(step)) {
                    <ng-icon name="lucideCheck" class="h-4 w-4 text-green-500" />
                  } @else if (isStepActive(step)) {
                    <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin text-primary" />
                  } @else {
                    <span class="w-2 h-2 rounded-full bg-border block"></span>
                  }
                </div>
                <span [class]="getStepLabelClass(step)">{{ step.label }}</span>
              </div>
            }
          </div>
        }

        <!-- Build elapsed time + timeout warning -->
        @if ((phase() === 'queued' || phase() === 'building') && buildElapsedLabel(); as elapsed) {
          <div class="flex items-center gap-2 text-xs"
               [class.text-muted-foreground]="!isBuildNearTimeout()"
               [class.text-orange-600]="isBuildNearTimeout()"
               [class.dark:text-orange-400]="isBuildNearTimeout()">
            @if (isBuildNearTimeout()) {
              <ng-icon name="lucideTriangleAlert" class="h-3.5 w-3.5 shrink-0" />
              <span>Build in progress · {{ elapsed }} — approaching 30 min timeout</span>
            } @else {
              <ng-icon name="lucideLoader" class="h-3.5 w-3.5 shrink-0 animate-spin" />
              <span>Build in progress · {{ elapsed }}</span>
            }
          </div>
        }

        <!-- Deploy progress — shown only when we have real progress data from
             lastOperation. Before that (build_done, or deploying at 0%), the
             timeline spinner already carries the "in progress" signal; an
             indeterminate bar would just be visual noise. -->
        @if (phase() === 'deploying' && deployProgress() > 0) {
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>{{ deployMessage() ?? 'Deploying...' }}</span>
              <span>{{ deployProgress() }}%</span>
            </div>
            <div class="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                class="h-full bg-primary rounded-full transition-all duration-500"
                [style.width.%]="deployProgress()"
              ></div>
            </div>
          </div>
        } @else if (phase() === 'deploying' && deployMessage()) {
          <!-- Substep label without a bar: useful info from operation:progress
               WS events before lastOperation.progress > 0. -->
          <p class="text-xs text-muted-foreground">{{ deployMessage() }}</p>
        }

        <!-- GitHub run link -->
        @if (githubRunUrl() && phase() !== 'live') {
          <a
            [href]="githubRunUrl()"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ng-icon name="lucideGithub" class="h-4 w-4" />
            View on GitHub Actions
            <ng-icon name="lucideExternalLink" class="h-3.5 w-3.5" />
          </a>
        }

        <!-- Deploy failed -->
        @if (phase() === 'deploy_failed') {
          <div class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div class="flex items-start gap-2 text-destructive text-sm">
              <ng-icon name="lucideX" class="h-4 w-4 shrink-0 mt-0.5" />
              <span>{{ buildError() ?? 'Deploy failed. Check application logs.' }}</span>
            </div>
            <button type="button" (click)="goToApp()" class="text-sm text-primary hover:underline">
              View application
            </button>
          </div>
        }

      </div>
    </div>
  `,
})
export class GithubActionsMonitorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appService = inject(ApplicationService);
  private readonly wsService = inject(AppRuntimeWebSocketService);
  private readonly buildsApi = inject(AppBuildsService);

  applicationId = signal('');
  phase = signal<MonitorPhase>('queued');
  deployProgress = signal(0);
  deployMessage = signal<string | null>(null);
  githubRunUrl = signal<string | null>(null);
  buildError = signal<string | null>(null);

  /** Latest application snapshot — single source of truth for the UI. */
  private readonly appSnapshot = signal<Application | null>(null);
  /** 1s ticker that drives the elapsed-time display without needing a new poll. */
  private readonly nowTick = signal(Date.now());

  readonly timelineSteps = TIMELINE_STEPS;

  /**
   * Transitional app states during which we poll GET /applications/:id every 5s.
   * Stable states (running/stopped/failed/etc.) stop the loop — UI updates
   * arrive via WebSocket or user navigation.
   */
  private readonly TRANSITIONAL_STATES: ApplicationStatus[] = [
    ApplicationStatusEnum.Pending,
    ApplicationStatusEnum.AwaitingBuild,
    ApplicationStatusEnum.Provisioning,
    ApplicationStatusEnum.Updating,
  ];
  private readonly POLL_INTERVAL_MS = 5_000;

  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private pollingActive = true;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private buildRefreshInterval: ReturnType<typeof setInterval> | null = null;
  private consecutiveErrors = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 5;
  private readonly BUILD_REFRESH_INTERVAL_MS = 12_000;
  private static readonly TERMINAL_BUILD_STATES: ReadonlyArray<AppBuildResponseDto['status']> = [
    'COMPLETED', 'FAILED', 'CANCELLED',
  ];

  /** Elapsed build time as "Xm Ys", recomputed on each 1s tick while active. */
  readonly buildElapsedLabel = computed(() => {
    const app = this.appSnapshot();
    const startIso = app?.buildStartedAt;
    if (!startIso) return null;
    const startMs = new Date(startIso).getTime();
    if (Number.isNaN(startMs)) return null;
    const elapsedMs = this.nowTick() - startMs;
    if (elapsedMs < 0) return null;
    const totalSec = Math.floor(elapsedMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  });

  readonly isBuildNearTimeout = computed(() => {
    const app = this.appSnapshot();
    const startIso = app?.buildStartedAt;
    if (!startIso) return false;
    const startMs = new Date(startIso).getTime();
    if (Number.isNaN(startMs)) return false;
    return this.nowTick() - startMs > BUILD_WARNING_MS;
  });

  ngOnInit(): void {
    void (async () => {
      const appId = this.route.snapshot.paramMap.get('applicationId') ?? '';
      this.applicationId.set(appId);
  
      // WS events: complementary real-time updates. Polling drives recovery/boot,
      // WS delivers immediate transitions when the backend fires them.
      this.wsService.subscribeToBuildEvents(appId, {
        onCompleted: (e: BuildCompletedEvent) => this.onBuildCompleted(e),
        onFailed: (e: BuildFailedEvent) => this.onBuildFailed(e),
      });
  
      this.wsService.subscribeToOperationEvents(appId, {
        onProgress: (e: OperationProgressEvent) => {
          this.phase.set('deploying');
          this.deployProgress.set(e.percentage ?? 0);
          if (e.message) this.deployMessage.set(e.message);
        },
        onCompleted: () => {
          this.stopPolling();
          this.deployProgress.set(100);
          this.deployMessage.set(null);
          this.phase.set('live');
        },
        onFailed: (e: OperationFailedEvent) => {
          this.stopPolling();
          this.deployMessage.set(null);
          this.buildError.set(e.error ?? null);
          this.phase.set('deploy_failed');
        },
      });
  
      // 1s ticker to keep elapsed-time display smooth (independent of poll cadence)
      this.tickInterval = setInterval(() => this.nowTick.set(Date.now()), 1_000);
  
      // Forces backend to re-poll GitHub Actions every 12s while the latest build
      // is non-terminal. Backend may also flip the app from AWAITING_BUILD to deploy.
      this.buildRefreshInterval = setInterval(
        () => this.tickBuildRefresh(appId),
        this.BUILD_REFRESH_INTERVAL_MS,
      );
  
      // Initial hydration — will also schedule polling if the app is transitional
      try {
        const app = await this.appService.getApplication(appId);
        if (app) this.hydrateFromApp(app);
      } catch {
        // Recovery: start polling anyway — maybe the app exists but this request
        // flaked. Subsequent polls will hydrate.
        this.scheduleNextPoll(appId);
      }
    })();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.buildRefreshInterval) {
      clearInterval(this.buildRefreshInterval);
      this.buildRefreshInterval = null;
    }
    this.wsService.unsubscribeFromApp(this.applicationId());
  }

  private async tickBuildRefresh(appId: string): Promise<void> {
    if (!this.pollingActive) return;
    try {
      const latest = await firstValueFrom(this.buildsApi.appBuildsControllerGetLatestBuild(appId));
      if (!latest || GithubActionsMonitorComponent.TERMINAL_BUILD_STATES.includes(latest.status)) {
        return;
      }
      // Fire-and-forget: response is the updated row but we let the existing
      // app poll surface state changes to the UI.
      await firstValueFrom(this.buildsApi.appBuildsControllerRefreshBuild(latest.id));
    } catch {
      // Best-effort; next tick retries. 404 (no builds yet) is also expected
      // immediately after Force build before the row is created.
    }
  }

  /**
   * Derive UI state from a fresh Application snapshot.
   *
   * Single source of truth: everything the UI needs (status, build metadata,
   * deploy progress, GitHub URL, error message) is read from this one object.
   * Polling schedule is also decided here — the next tick fires only when the
   * app is in a transitional state.
   */
  private hydrateFromApp(app: Application): void {
    const op = app.lastOperation;

    this.appSnapshot.set(app);

    // GitHub run URL — prefer the cached one on the app entity
    if (app.workflowRunUrl) {
      this.githubRunUrl.set(app.workflowRunUrl);
    }

    switch (app.status) {
      case ApplicationStatusEnum.Running:
        this.stopPolling();
        this.phase.set('live');
        return;

      case ApplicationStatusEnum.Failed:
        this.stopPolling();
        this.buildError.set(
          app.reconciliationError ?? op?.errorMessage ?? 'Operation failed'
        );
        // Distinguish build failure from deploy failure: if the last known
        // build conclusion was a failure, it's a build failure; if we have a
        // DEPLOY operation that failed, it's a deploy failure.
        if (
          app.lastBuildConclusion === LastBuildConclusionEnum.Failure ||
          app.lastBuildConclusion === LastBuildConclusionEnum.Cancelled
        ) {
          this.phase.set('build_failed');
        } else if (op?.operationType === 'DEPLOY_APPLICATION' || op?.operationType === 'DEPLOY') {
          this.phase.set('deploy_failed');
        } else {
          this.phase.set('build_failed');
        }
        return;

      case ApplicationStatusEnum.Provisioning:
      case ApplicationStatusEnum.Updating:
        this.phase.set('deploying');
        if (op) {
          this.deployProgress.set(op.progress ?? 0);
          if (op.currentStep) this.deployMessage.set(op.currentStep);
        }
        this.scheduleNextPoll(app.id);
        return;

      case ApplicationStatusEnum.AwaitingBuild:
        // Drive queued vs building from the cached workflow run status.
        // lastBuildStatus === Completed is a brief race window where the
        // backend watcher has seen GH success but hasn't flipped status to
        // PROVISIONING yet — show "build_done" as optimistic hint.
        if (app.lastBuildStatus === LastBuildStatusEnum.Completed) {
          this.phase.set('build_done');
        } else if (app.lastBuildStatus === LastBuildStatusEnum.InProgress) {
          this.phase.set('building');
        } else {
          this.phase.set('queued');
        }
        this.scheduleNextPoll(app.id);
        return;

      case ApplicationStatusEnum.Pending:
        this.phase.set('queued');
        this.scheduleNextPoll(app.id);
        return;

      default:
        // Stopped / Degraded / RollingBack / Deleting / Deleted — no polling,
        // these states are stable and the monitor screen isn't really meant
        // for them anyway.
        this.stopPolling();
        this.phase.set('live');
        return;
    }
  }

  private scheduleNextPoll(appId: string): void {
    if (!this.pollingActive) return;
    if (this.pollingTimer) return; // already scheduled
    this.pollingTimer = setTimeout(() => {
      this.pollingTimer = null;
      this.pollApplication(appId);
    }, this.POLL_INTERVAL_MS);
  }

  private async pollApplication(appId: string): Promise<void> {
    if (!this.pollingActive) return;

    try {
      const app = await this.appService.refreshApplication(appId);
      this.consecutiveErrors = 0;
      if (app) {
        this.hydrateFromApp(app);
      } else {
        this.scheduleNextPoll(appId);
      }
    } catch {
      this.consecutiveErrors++;

      if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
        this.stopPolling();
        this.buildError.set('Lost connection to application. Please refresh.');
        this.phase.set('build_failed');
        return;
      }
      // Transient error — retry at next tick
      this.scheduleNextPoll(appId);
    }
  }

  private stopPolling(): void {
    this.pollingActive = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private onBuildCompleted(_e: BuildCompletedEvent): void {
    // Backend auto-triggers deploy — move to build_done and let the polling
    // loop / WS operation events drive the transition to deploying/live.
    this.phase.set('build_done');
  }

  private onBuildFailed(e: BuildFailedEvent): void {
    // WS fast-path: stop polling immediately, no need to wait for next tick
    this.stopPolling();
    this.buildError.set(e.error ?? null);
    this.phase.set('build_failed');
  }

  async retry(): Promise<void> {
    const appId = this.applicationId();
    if (!appId) return;
    try {
      // Re-generate workflow with same params — app and workflow file already exist
      await this.appService.generateWorkflow(appId, { branch: 'main', framework: '' } as any);
      this.phase.set('queued');
      this.buildError.set(null);
      this.pollingActive = true;
      this.scheduleNextPoll(appId);
    } catch (e: any) {
      this.buildError.set(e?.message ?? 'Failed to retry');
    }
  }

  goToApp(): void {
    this.router.navigate(['/apps/applications', this.applicationId()]);
  }

  isStepDone(step: TimelineStep): boolean {
    return step.donePhases.includes(this.phase());
  }

  isStepActive(step: TimelineStep): boolean {
    return step.activePhases.includes(this.phase());
  }

  getStepLabelClass(step: TimelineStep): string {
    if (this.isStepDone(step)) return 'text-sm text-muted-foreground line-through';
    if (this.isStepActive(step)) return 'text-sm text-foreground font-medium';
    return 'text-sm text-muted-foreground/50';
  }
}
