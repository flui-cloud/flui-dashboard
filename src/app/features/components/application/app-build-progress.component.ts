import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { lucideExternalLink, lucideRefreshCw, lucideSquare } from '@ng-icons/lucide';
import { AppBuildsService } from '../../../core/api/api/appBuilds.service';
import { AppBuildResponseDto } from '../../../core/api/model/appBuildResponseDto';
import {
  AppRuntimeWebSocketService,
  BuildLogEvent,
  BuildPlanEvent,
  BuildCompletedEvent,
  BuildFailedEvent,
  OperationProgressEvent,
  OperationCompletedEvent,
  OperationFailedEvent,
} from '../../service/app-runtime-websocket.service';
import { DeploymentStep } from '../../model/application.models';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { DeployProgressSteps } from './deploy-progress-steps';
import { formatDuration } from './deploy-progress-model';
import { BuildLogPanel } from './build-log-panel';
import {
  BuildPhase,
  buildPageState,
  buildPhaseSteps,
  buildProgressPercent,
  phasesFromLog,
  shortId,
  trackStepTimes,
} from './build-progress-model';

interface RailpackPlan {
  framework?: string;
  buildCommand?: string;
  startCommand?: string;
}

const DEPLOY_WINDOW_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-build-progress',
  imports: [
    MaskIdPipe,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlCopyId,
    FlStatus,
    FlButton,
    FlIcon,
    FlSpinner,
    DeployProgressSteps,
    BuildLogPanel,
  ],
  providers: [provideIcons({ lucideExternalLink, lucideRefreshCw, lucideSquare })],
  templateUrl: './app-build-progress.component.html',
})
export class AppBuildProgressComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly appBuildsApi = inject(AppBuildsService);
  private readonly wsService = inject(AppRuntimeWebSocketService);

  applicationId = signal('');
  buildId = signal('');
  buildStatus = signal<BuildPhase>('PENDING');
  buildLogs = signal<string[]>([]);
  detectedFramework = signal<string | null>(null);
  detectedFrontendFramework = signal<string | null>(null);
  detectedPort = signal<number | null>(null);
  buildCommand = signal<string | null>(null);
  startCommand = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  phase = signal<'building' | 'deploying' | 'completed' | 'failed'>('building');
  deployProgress = signal(0);
  deployMessage = signal('');
  private readonly deployOperationId = signal<string | null>(null);
  elapsedSeconds = signal(0);
  isRetrying = signal(false);
  isCancelling = signal(false);
  connectionLost = signal(false);

  protected readonly shortId = shortId;
  protected readonly now = signal(Date.now());

  readonly isResourceError = computed(() => {
    const err = this.errorMessage()?.toLowerCase() ?? '';
    return err.includes('insufficient') && (err.includes('cpu') || err.includes('memory'));
  });

  protected readonly breadcrumb = computed<Crumb[]>(() => {
    const appId = this.applicationId();
    return [
      { label: 'Applications', link: '/apps/applications' },
      { label: 'Application', link: ['/apps/applications', appId] },
      { label: 'Builds', link: ['/apps/applications', appId, 'builds'] },
      { label: 'Build' },
    ];
  });

  protected readonly failureTitle = computed(() => {
    if (this.buildStatus() === 'CANCELLED') return 'Build cancelled';
    return this.isResourceError() ? 'Not enough cluster resources' : 'Build failed';
  });

  protected readonly headerState = computed(() => buildPageState(this.phase(), this.buildStatus()));
  protected readonly progressPercent = computed(() => buildProgressPercent(this.buildStatus()));
  protected readonly elapsed = computed(() => formatDuration(this.elapsedSeconds()));

  private readonly pageSteps = computed<DeploymentStep[]>(() => {
    const frameworks = [this.detectedFramework(), this.detectedFrontendFramework()].filter(Boolean);
    const steps = buildPhaseSteps(this.buildStatus(), {
      ANALYZING: frameworks.length ? `Detected ${frameworks.join(' · ')}` : null,
    });
    const phase = this.phase();
    if (phase !== 'deploying' && phase !== 'completed') return steps;
    return [
      ...steps,
      {
        id: 'DEPLOY',
        name: 'Deploy application',
        description: this.deployMessage() || 'Rolling out the new image',
        status: phase === 'completed' ? 'completed' : 'running',
      },
    ];
  });

  protected readonly steps = linkedSignal<DeploymentStep[], DeploymentStep[]>({
    source: this.pageSteps,
    computation: (steps, previous) => trackStepTimes(previous?.value, steps, new Date()),
  });

  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  private elapsedIntervalId: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly clockIntervalId = setInterval(() => this.now.set(Date.now()), 1000);

  private readonly HEARTBEAT_TIMEOUT_MS = 60_000;

  ngOnInit(): void {
    void (async () => {
      const appId = this.route.snapshot.paramMap.get('applicationId') ?? '';
      const bId = this.route.snapshot.paramMap.get('buildId') ?? '';

      if (!appId || !bId) {
        this.router.navigate(['/apps/applications']);
        return;
      }

      await this.initializeBuild(appId, bId);
    })();
  }

  private async initializeBuild(appId: string, bId: string): Promise<void> {
    this.applicationId.set(appId);
    this.buildId.set(bId);

    const build = await firstValueFrom(this.appBuildsApi.appBuildsControllerGetBuild(bId)).catch(
      () => null,
    );
    if (build) {
      this.buildStatus.set(build.status);
      if (build.logs?.length) {
        this.buildLogs.set(build.logs);
      }
      this.applyInitialDetectedFields(build);

      if (this.applyInitialPhase(build)) return;
    }

    this.startElapsedTimer(build?.startedAt);
    this.subscribeWebSocket(appId);
    this.startPolling(bId);
  }

  private applyInitialDetectedFields(build: AppBuildResponseDto): void {
    const plan = build.railpackPlan as RailpackPlan | undefined;
    if (plan?.framework && plan.framework !== 'unknown') this.detectedFramework.set(plan.framework);
    if (plan?.buildCommand) this.buildCommand.set(plan.buildCommand);
    if (plan?.startCommand) this.startCommand.set(plan.startCommand);
    if (build.detectedFramework && build.detectedFramework !== 'unknown')
      this.detectedFramework.set(build.detectedFramework);
    if (build.detectedFrontendFramework)
      this.detectedFrontendFramework.set(build.detectedFrontendFramework);
    if (build.detectedPort) this.detectedPort.set(build.detectedPort);
  }

  private applyInitialPhase(build: AppBuildResponseDto): boolean {
    if (build.status === 'COMPLETED') {
      const completedAgo = build.completedAt
        ? Date.now() - new Date(build.completedAt).getTime()
        : Infinity;
      if (completedAgo > DEPLOY_WINDOW_MS) {
        this.phase.set('completed');
        return true;
      }
      this.phase.set('deploying');
    } else if (build.status === 'FAILED' || build.status === 'CANCELLED') {
      this.phase.set('failed');
      this.errorMessage.set(build.errorMessage ?? 'Build failed');
      return true;
    }
    return false;
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.stopElapsedTimer();
    this.stopHeartbeatWatchdog();
    clearInterval(this.clockIntervalId);
    this.wsService.unsubscribeFromApp(this.applicationId());
  }

  private subscribeWebSocket(appId: string): void {
    this.resetHeartbeatWatchdog();

    this.wsService.subscribeToBuildEvents(appId, {
      onLog: (e: BuildLogEvent) => {
        this.resetHeartbeatWatchdog();
        const prefix = e.stream === 'stderr' ? '[stderr] ' : '';
        this.buildLogs.update((logs) => [...logs, prefix + e.line].slice(-500));
        this.inferPhaseFromLog(e.line);
      },
      onPlan: (e: BuildPlanEvent) => {
        this.resetHeartbeatWatchdog();
        if (e.framework && e.framework !== 'unknown') this.detectedFramework.set(e.framework);
        if (e.buildCommand) this.buildCommand.set(e.buildCommand);
        if (e.startCommand) this.startCommand.set(e.startCommand);
      },
      onCompleted: (e: BuildCompletedEvent) => {
        this.buildStatus.set('COMPLETED');
        if (e.deployOperationId) this.deployOperationId.set(e.deployOperationId);
        this.phase.set('deploying');
        this.stopPolling();
        this.stopElapsedTimer();
        this.stopHeartbeatWatchdog();
      },
      onFailed: (e: BuildFailedEvent) => {
        this.buildStatus.set('FAILED');
        this.phase.set('failed');
        this.errorMessage.set(e.error);
        this.stopPolling();
        this.stopElapsedTimer();
        this.stopHeartbeatWatchdog();
      },
      onHeartbeat: () => this.resetHeartbeatWatchdog(),
      onReconnect: () => this.syncLatestBuild(),
    });

    this.wsService.subscribeToOperationEvents(appId, {
      onProgress: (e: OperationProgressEvent) => {
        const opId = this.deployOperationId();
        if (opId && e.operationId !== opId) return;
        this.deployProgress.set(e.percentage);
        this.deployMessage.set(e.message);
      },
      onCompleted: (e: OperationCompletedEvent) => {
        const opId = this.deployOperationId();
        if (opId && e.operationId !== opId) return;
        this.deployProgress.set(100);
        this.phase.set('completed');
      },
      onFailed: (e: OperationFailedEvent) => {
        const opId = this.deployOperationId();
        if (opId && e.operationId !== opId) return;
        this.phase.set('failed');
        this.errorMessage.set(e.error);
        this.stopElapsedTimer();
      },
    });
  }

  private inferPhaseFromLog(line: string): void {
    const next = phasesFromLog(this.buildStatus(), line)[0];
    if (next) this.buildStatus.set(next);
  }

  private startPolling(buildId: string): void {
    this.pollingIntervalId = setInterval(async () => {
      const build = await firstValueFrom(
        this.appBuildsApi.appBuildsControllerGetBuild(buildId),
      ).catch(() => null);
      if (!build) return;
      this.buildStatus.set(build.status);
      this.applySyncedLogs(build);
      this.applyDetectedPlanIfMissing(build);

      const currentPhase = this.phase();
      if (currentPhase === 'completed' || currentPhase === 'failed') {
        this.stopPolling();
        return;
      }
      this.applyTerminalPhaseTransition(build, false);
    }, 5000);
  }

  private applySyncedLogs(build: AppBuildResponseDto): void {
    if (build.logs?.length && build.logs.length > this.buildLogs().length) {
      this.buildLogs.set(build.logs);
    }
  }

  private applyDetectedPlanIfMissing(build: AppBuildResponseDto): void {
    const plan = build.railpackPlan as RailpackPlan | undefined;
    if (plan?.framework && plan.framework !== 'unknown' && !this.detectedFramework()) {
      this.detectedFramework.set(plan.framework);
    }
    if (plan?.buildCommand && !this.buildCommand()) this.buildCommand.set(plan.buildCommand);
    if (plan?.startCommand && !this.startCommand()) this.startCommand.set(plan.startCommand);
    if (
      build.detectedFramework &&
      build.detectedFramework !== 'unknown' &&
      !this.detectedFramework()
    ) {
      this.detectedFramework.set(build.detectedFramework);
    }
    if (build.detectedFrontendFramework && !this.detectedFrontendFramework()) {
      this.detectedFrontendFramework.set(build.detectedFrontendFramework);
    }
    if (build.detectedPort && !this.detectedPort()) this.detectedPort.set(build.detectedPort);
  }

  private applyTerminalPhaseTransition(build: AppBuildResponseDto, stopHeartbeat: boolean): void {
    if (build.status === 'COMPLETED') {
      this.phase.set('deploying');
      this.stopPolling();
      this.stopElapsedTimer();
      if (stopHeartbeat) this.stopHeartbeatWatchdog();
    } else if (build.status === 'FAILED' || build.status === 'CANCELLED') {
      this.phase.set('failed');
      this.errorMessage.set(build.errorMessage ?? 'Build failed');
      this.stopPolling();
      this.stopElapsedTimer();
      if (stopHeartbeat) this.stopHeartbeatWatchdog();
    }
  }

  private stopPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  }

  private resetHeartbeatWatchdog(): void {
    if (this.heartbeatTimeoutId) clearTimeout(this.heartbeatTimeoutId);
    this.connectionLost.set(false);
    this.heartbeatTimeoutId = setTimeout(() => {
      this.connectionLost.set(true);
    }, this.HEARTBEAT_TIMEOUT_MS);
  }

  private stopHeartbeatWatchdog(): void {
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
  }

  private async syncLatestBuild(): Promise<void> {
    const build = await firstValueFrom(
      this.appBuildsApi.appBuildsControllerGetLatestBuild(this.applicationId()),
    ).catch(() => null);
    if (!build) return;
    this.buildStatus.set(build.status);
    this.connectionLost.set(false);
    this.applyDetectedPlanIfMissing(build);

    const currentPhase = this.phase();
    if (currentPhase === 'completed' || currentPhase === 'failed') return;

    this.applyTerminalPhaseTransition(build, true);
  }

  private startElapsedTimer(startedAt?: string): void {
    const offset = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : 0;
    this.elapsedSeconds.set(Math.max(0, offset));
    this.elapsedIntervalId = setInterval(() => {
      this.elapsedSeconds.update((s) => s + 1);
    }, 1000);
  }

  private stopElapsedTimer(): void {
    if (this.elapsedIntervalId) {
      clearInterval(this.elapsedIntervalId);
      this.elapsedIntervalId = null;
    }
  }

  copyLogs(): void {
    navigator.clipboard.writeText(this.buildLogs().join('\n'));
  }

  navigateBack(): void {
    this.router.navigate(['/apps/applications']);
  }

  viewApplication(): void {
    this.router.navigate(['/apps/applications', this.applicationId()]);
  }

  viewBuildHistory(): void {
    this.router.navigate(['/apps/applications', this.applicationId(), 'builds']);
  }

  async cancelBuild(): Promise<void> {
    this.isCancelling.set(true);
    try {
      await firstValueFrom(this.appBuildsApi.appBuildsControllerCancelBuild(this.buildId()));
      this.stopPolling();
      this.stopElapsedTimer();
      this.buildStatus.set('CANCELLED');
      this.phase.set('failed');
      this.errorMessage.set('Build was cancelled.');
    } catch (err: any) {
      this.errorMessage.set(err?.error?.message ?? 'Failed to cancel build');
    } finally {
      this.isCancelling.set(false);
    }
  }

  async retryBuild(): Promise<void> {
    this.isRetrying.set(true);
    try {
      const r = await firstValueFrom(
        this.appBuildsApi.appBuildsControllerTriggerBuild(this.applicationId(), {}),
      );
      if (!r.buildId) return;

      this.stopPolling();
      if (this.elapsedIntervalId) {
        clearInterval(this.elapsedIntervalId);
        this.elapsedIntervalId = null;
      }
      this.wsService.unsubscribeFromApp(this.applicationId());

      this.buildLogs.set([]);
      this.detectedFramework.set(null);
      this.detectedFrontendFramework.set(null);
      this.detectedPort.set(null);
      this.buildCommand.set(null);
      this.startCommand.set(null);
      this.errorMessage.set(null);
      this.phase.set('building');
      this.deployProgress.set(0);
      this.deployMessage.set('');
      this.elapsedSeconds.set(0);
      this.isRetrying.set(false);
      this.isCancelling.set(false);

      this.router.navigate(['/apps/deploy/build', this.applicationId(), r.buildId], {
        replaceUrl: true,
      });

      await this.initializeBuild(this.applicationId(), r.buildId);
    } catch {
      this.isRetrying.set(false);
    }
  }
}
