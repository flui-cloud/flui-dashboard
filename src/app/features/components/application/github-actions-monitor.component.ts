import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideGithub, lucideRefreshCw } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { ApplicationService, BuildExpectation } from '../../service/application.service';
import {
  AppRuntimeWebSocketService,
  BuildCompletedEvent,
  BuildFailedEvent,
  OperationProgressEvent,
  OperationFailedEvent,
} from '../../service/app-runtime-websocket.service';
import { AppBuildsService } from '../../../core/api/api/appBuilds.service';
import { AppBuildResponseDto } from '../../../core/api/model/appBuildResponseDto';
import {
  Application,
  ApplicationStatus,
  ApplicationStatusEnum,
  LastBuildStatusEnum,
  LastBuildConclusionEnum,
} from '../../model/application.models';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { GithubActionsMonitorSteps } from './github-actions-monitor-steps';
import {
  BUILD_WARNING_MS,
  MonitorPhase,
  elapsedSince,
  formatElapsed,
  isBuildPhase,
  isFailedPhase,
  phaseState,
} from './github-actions-monitor-model';

@Component({
  selector: 'app-github-actions-monitor',
  imports: [
    MaskIdPipe,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlCopyId,
    FlLoadingState,
    FlStatus,
    FlButton,
    FlIcon,
    GithubActionsMonitorSteps,
  ],
  providers: [provideIcons({ lucideExternalLink, lucideGithub, lucideRefreshCw })],
  template: `
    <div class="fl-page">
      @let state = headerState();
      <fl-page-header [title]="title()" [breadcrumb]="breadcrumb()">
        <fl-status role="status" headerStatus [tone]="state.tone" [label]="state.label" />
        <span headerMeta>GitHub Actions</span>
        @if (buildPhase() && buildElapsedLabel(); as elapsed) {
          <span headerMeta>
            Elapsed <span class="fl-mono fl-num">{{ elapsed }}</span>
          </span>
        }
        <ng-container headerActions>
          @if (githubRunUrl() && phase() !== 'live' && phase() !== 'build_failed') {
            <a flButton [href]="githubRunUrl()" target="_blank" rel="noopener noreferrer">
              <fl-icon name="lucideGithub" />
              View on GitHub Actions
              <fl-icon name="lucideExternalLink" />
            </a>
          }
          @if (phase() === 'live') {
            <button flButton="primary" type="button" (click)="goToApp()">View application</button>
          }
        </ng-container>
      </fl-page-header>

      @if (phase() === 'build_failed') {
        <fl-alert tone="error" title="The GitHub Actions workflow failed">
          {{ buildError() || 'The build stopped before it finished.' }}
          <ng-container alertActions>
            <button flButton="primary" size="sm" type="button" (click)="retry()">
              <fl-icon name="lucideRefreshCw" />
              Retry
            </button>
            @if (githubRunUrl()) {
              <a
                flButton
                size="sm"
                [href]="githubRunUrl()"
                target="_blank"
                rel="noopener noreferrer"
              >
                <fl-icon name="lucideExternalLink" />
                View logs on GitHub
              </a>
            }
          </ng-container>
        </fl-alert>
      }

      @if (phase() === 'deploy_failed') {
        <fl-alert tone="error" title="Deploy failed">
          {{ buildError() ?? 'Deploy failed. Check application logs.' }}
          <ng-container alertActions>
            <button flButton="primary" size="sm" type="button" (click)="goToApp()">
              View application
            </button>
          </ng-container>
        </fl-alert>
      }

      @if (buildPhase() && isBuildNearTimeout()) {
        <fl-alert tone="warning" title="Approaching the 30 min timeout">
          The build has been running for
          <span class="fl-mono fl-num">{{ buildElapsedLabel() }}</span>.
        </fl-alert>
      }

      <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        @if (!failed()) {
          <div class="fl-stack lg:col-span-2">
            <app-github-actions-monitor-steps
              [phase]="phase()"
              [elapsed]="buildElapsedLabel()"
              [deployProgress]="deployProgress()"
              [deployMessage]="deployMessage()"
              [note]="buildExpectation()?.note ?? null"
            />
          </div>
        }

        <div [class]="failed() ? 'lg:col-span-3' : ''">
          <fl-panel title="Details">
            @if (appSnapshot(); as app) {
              <fl-key-value class="fl-kv--compact">
                <fl-kv-item key="Application">{{ app.name }}</fl-kv-item>
                <fl-kv-item key="Application ID">
                  <fl-copy-id [value]="app.id" [display]="app.id | maskId" label="application ID" />
                </fl-kv-item>
                @if (app.workflowRunId) {
                  <fl-kv-item key="Workflow run ID">
                    <fl-copy-id [value]="app.workflowRunId" label="workflow run ID" />
                  </fl-kv-item>
                }
                <fl-kv-item key="Cluster">
                  <fl-copy-id
                    [value]="app.clusterId"
                    [display]="app.clusterId | maskId"
                    label="cluster ID"
                  />
                </fl-kv-item>
                <fl-kv-item key="Namespace" [mono]="true">{{ app.k8sNamespace }}</fl-kv-item>
                @if (app.imageRef) {
                  <fl-kv-item key="Image">
                    <fl-copy-id [value]="app.imageRef" label="image" />
                  </fl-kv-item>
                }
              </fl-key-value>
            } @else if (failed()) {
              <p class="m-0 text-fl-body-sm text-fl-ink-muted">No details available</p>
            } @else {
              <fl-loading-state [rows]="4" />
            }
          </fl-panel>
        </div>
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
  buildExpectation = signal<BuildExpectation | null>(null);

  protected readonly appSnapshot = signal<Application | null>(null);
  private readonly nowTick = signal(Date.now());

  protected readonly headerState = computed(() => phaseState(this.phase()));
  protected readonly buildPhase = computed(() => isBuildPhase(this.phase()));
  protected readonly failed = computed(() => isFailedPhase(this.phase()));
  protected readonly title = computed(() => this.appSnapshot()?.name ?? 'GitHub Actions build');
  protected readonly breadcrumb = computed<Crumb[]>(() => [
    { label: 'Applications', link: '/apps/applications' },
    { label: 'Deploy', link: '/apps/deploy/new' },
    { label: this.appSnapshot()?.name ?? 'Build' },
  ]);

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
    'COMPLETED',
    'FAILED',
    'CANCELLED',
  ];

  readonly buildElapsedLabel = computed(() => {
    const elapsedMs = elapsedSince(this.appSnapshot()?.buildStartedAt, this.nowTick());
    return elapsedMs === null ? null : formatElapsed(elapsedMs);
  });

  readonly isBuildNearTimeout = computed(() => {
    const elapsedMs = elapsedSince(this.appSnapshot()?.buildStartedAt, this.nowTick());
    return elapsedMs !== null && elapsedMs > BUILD_WARNING_MS;
  });

  ngOnInit(): void {
    void (async () => {
      const appId = this.route.snapshot.paramMap.get('applicationId') ?? '';
      this.applicationId.set(appId);

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

      void this.appService
        .getBuildExpectation(appId)
        .then((e) => this.buildExpectation.set(e))
        .catch(() => this.buildExpectation.set(null));

      this.tickInterval = setInterval(() => this.nowTick.set(Date.now()), 1_000);

      this.buildRefreshInterval = setInterval(
        () => this.tickBuildRefresh(appId),
        this.BUILD_REFRESH_INTERVAL_MS,
      );

      try {
        const app = await this.appService.getApplication(appId);
        if (app) this.hydrateFromApp(app);
      } catch {
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
      await firstValueFrom(this.buildsApi.appBuildsControllerRefreshBuild(latest.id));
    } catch {
      return;
    }
  }

  private hydrateFromApp(app: Application): void {
    const op = app.lastOperation;

    this.appSnapshot.set(app);

    if (app.workflowRunUrl) {
      this.githubRunUrl.set(app.workflowRunUrl);
    }

    switch (app.status) {
      case ApplicationStatusEnum.Failed:
        this.stopPolling();
        this.buildError.set(app.reconciliationError ?? op?.errorMessage ?? 'Operation failed');
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

      case ApplicationStatusEnum.Running:
      default:
        this.stopPolling();
        this.phase.set('live');
        return;
    }
  }

  private scheduleNextPoll(appId: string): void {
    if (!this.pollingActive) return;
    if (this.pollingTimer) return;
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
    this.phase.set('build_done');
  }

  private onBuildFailed(e: BuildFailedEvent): void {
    this.stopPolling();
    this.buildError.set(e.error ?? null);
    this.phase.set('build_failed');
  }

  async retry(): Promise<void> {
    const appId = this.applicationId();
    if (!appId) return;
    try {
      await this.appService.generateWorkflowV3(appId, { branch: 'main' });
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
}
