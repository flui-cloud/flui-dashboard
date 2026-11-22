import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { BuildsService } from '../../../core/api/api/builds.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { ImagesService } from '../../../core/api/api/images.service';
import { ResourceProfileDto } from '../../../core/api/model/resourceProfileDto';
import { AppBuildResponseDto } from '../../../core/api/model/appBuildResponseDto';
import { CreateApplicationDto } from '../../../core/api/model/createApplicationDto';
import { CreateApplicationResponseDto } from '../../../core/api/model/createApplicationResponseDto';
import {
  AppRuntimeWebSocketService,
  BuildLogEvent,
  StandaloneBuildPlanEvent,
  StandaloneBuildCompletedEvent,
  StandaloneBuildFailedEvent,
} from '../../service/app-runtime-websocket.service';
import { DeploymentStep } from '../../model/application.models';
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
import { StandaloneBuildConfirm, StandaloneWizardState } from './standalone-build-confirm';
import {
  BuildPhase,
  buildPageState,
  buildPhaseSteps,
  buildProgressPercent,
  phasesFromLog,
  shortId,
  trackStepTimes,
} from './build-progress-model';

const BREADCRUMB: readonly Crumb[] = [
  { label: 'Applications', link: '/apps/applications' },
  { label: 'Deploy', link: '/apps/deploy/new' },
  { label: 'Build' },
];

@Component({
  selector: 'app-standalone-build-progress',
  imports: [
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
    StandaloneBuildConfirm,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  templateUrl: './standalone-build-progress.component.html',
})
export class StandaloneBuildProgressComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly buildsApi = inject(BuildsService);
  private readonly applicationsApi = inject(ApplicationsService);
  private readonly imagesApi = inject(ImagesService);
  private readonly wsService = inject(AppRuntimeWebSocketService);

  buildId = signal('');
  buildStatus = signal<BuildPhase>('PENDING');
  buildLogs = signal<string[]>([]);
  detectedFramework = signal<string | null>(null);
  buildCommand = signal<string | null>(null);
  startCommand = signal<string | null>(null);
  detectedStartCommand = signal<string | null>(null);

  readonly startCommandIsAutoCorrected = computed(() => {
    const raw = this.startCommand();
    const detected = this.detectedStartCommand();
    return !!raw && !!detected && raw !== detected;
  });
  imageRef = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  phase = signal<'building' | 'confirm' | 'failed'>('building');
  appName = signal('');
  detectedPort = signal<number | null>(null);
  selectedProfile = signal<string>('small');
  availableProfiles = signal<ResourceProfileDto[]>([]);
  loadingProfiles = signal(false);
  elapsedSeconds = signal(0);
  isCreating = signal(false);
  startCommandOverride = signal<string>('');
  startCommandOverrideExpanded = signal(false);
  isDeleting = signal(false);
  connectionLost = signal(false);
  wizardState = signal<StandaloneWizardState | null>(null);

  protected readonly breadcrumb = BREADCRUMB;
  protected readonly shortId = shortId;
  protected readonly now = signal(Date.now());
  readonly isNameValid = computed(() => this.appName().trim().length > 0);
  readonly effectivePort = computed(() => this.detectedPort() ?? this.wizardState()?.port ?? null);

  protected readonly headerState = computed(() => buildPageState(this.phase(), this.buildStatus()));
  protected readonly progressPercent = computed(() => buildProgressPercent(this.buildStatus()));
  protected readonly elapsed = computed(() => formatDuration(this.elapsedSeconds()));

  private readonly phaseSteps = computed(() => {
    const framework = this.detectedFramework();
    return buildPhaseSteps(this.buildStatus(), {
      ANALYZING: framework ? `Detected ${framework}` : null,
    });
  });

  protected readonly steps = linkedSignal<DeploymentStep[], DeploymentStep[]>({
    source: this.phaseSteps,
    computation: (steps, previous) => trackStepTimes(previous?.value, steps, new Date()),
  });

  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  private elapsedIntervalId: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly clockIntervalId = setInterval(() => this.now.set(Date.now()), 1000);

  private readonly HEARTBEAT_TIMEOUT_MS = 60_000;

  ngOnInit(): void {
    void (async () => {
      const bId = this.route.snapshot.paramMap.get('buildId') ?? '';
      if (!bId) {
        this.router.navigate(['/apps/deploy/new']);
        return;
      }

      const state = (this.router.currentNavigation()?.extras?.state ?? history.state) as
        StandaloneWizardState | undefined;
      if (state?.clusterId) {
        this.wizardState.set(state);
      }

      this.buildId.set(bId);
      await Promise.all([this.loadInitialState(bId), this.loadProfiles()]);
    })();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.stopElapsedTimer();
    this.stopHeartbeatWatchdog();
    clearInterval(this.clockIntervalId);
    this.wsService.unsubscribeFromStandaloneBuild(this.buildId());
  }

  private async loadInitialState(bId: string): Promise<void> {
    const build = await firstValueFrom(
      this.buildsApi.standaloneBuildsControllerGetBuild(bId),
    ).catch(() => null);
    if (build) {
      this.applyInitialBuild(build);
      if (this.settleTerminalBuild(build)) return;
    }

    this.startElapsedTimer();
    this.subscribeWebSocket(bId);
    this.startPolling(bId);
  }

  private applyInitialBuild(build: AppBuildResponseDto): void {
    this.buildStatus.set(build.status);
    if (build.logs?.length) {
      this.buildLogs.set(build.logs);
    }
    if (build.detectedFramework && build.detectedFramework !== 'unknown') {
      this.detectedFramework.set(build.detectedFramework);
    }
    if (build.detectedPort) this.detectedPort.set(build.detectedPort);
    if (build.suggestedName && !this.appName()) {
      this.appName.set(build.suggestedName);
    }
    if (build.imageRef) this.imageRef.set(build.imageRef);
    if (build.detectedStartCommand) this.detectedStartCommand.set(build.detectedStartCommand);
  }

  private settleTerminalBuild(build: AppBuildResponseDto): boolean {
    if (build.status === 'COMPLETED') {
      this.phase.set('confirm');
      return true;
    }
    if (build.status === 'FAILED' || build.status === 'CANCELLED') {
      this.phase.set('failed');
      this.errorMessage.set(build.errorMessage ?? 'Build failed');
      return true;
    }
    return false;
  }

  private subscribeWebSocket(bId: string): void {
    this.resetHeartbeatWatchdog();

    this.wsService.subscribeToStandaloneBuild(bId, {
      onLog: (e: BuildLogEvent) => {
        this.resetHeartbeatWatchdog();
        const prefix = e.stream === 'stderr' ? '[stderr] ' : '';
        this.buildLogs.update((logs) => [...logs, prefix + e.line].slice(-500));
        this.inferPhaseFromLog(e.line);
      },
      onPlan: (e: StandaloneBuildPlanEvent) => {
        this.resetHeartbeatWatchdog();
        if (e.framework && e.framework !== 'unknown') this.detectedFramework.set(e.framework);
        if (e.port) this.detectedPort.set(e.port);
        if (e.suggestedName && !this.appName()) this.appName.set(e.suggestedName);
        if (e.buildCommand) this.buildCommand.set(e.buildCommand);
        if (e.startCommand) this.startCommand.set(e.startCommand);
        if (e.detectedStartCommand) this.detectedStartCommand.set(e.detectedStartCommand);
      },
      onCompleted: (e: StandaloneBuildCompletedEvent) => {
        this.buildStatus.set('COMPLETED');
        this.imageRef.set(e.imageRef);
        if (e.suggestedName && !this.appName()) this.appName.set(e.suggestedName);
        this.phase.set('confirm');
        this.stopPolling();
        this.stopElapsedTimer();
        this.stopHeartbeatWatchdog();
      },
      onFailed: (e: StandaloneBuildFailedEvent) => {
        this.buildStatus.set('FAILED');
        this.phase.set('failed');
        this.errorMessage.set(e.error);
        this.stopPolling();
        this.stopElapsedTimer();
        this.stopHeartbeatWatchdog();
      },
      onHeartbeat: () => this.resetHeartbeatWatchdog(),
      onReconnect: () => this.syncBuildState(),
    });
  }

  private inferPhaseFromLog(line: string): void {
    const next = phasesFromLog(this.buildStatus(), line).at(-1);
    if (next) this.buildStatus.set(next);
  }

  private startPolling(bId: string): void {
    this.pollingIntervalId = setInterval(async () => {
      const build = await firstValueFrom(
        this.buildsApi.standaloneBuildsControllerGetBuild(bId),
      ).catch(() => null);
      if (!build) return;
      this.buildStatus.set(build.status);

      if (build.logs?.length && build.logs.length > this.buildLogs().length) {
        this.buildLogs.set(build.logs);
      }
      this.applyDetectedFieldsIfMissing(build);
      if (build.detectedStartCommand && !this.detectedStartCommand())
        this.detectedStartCommand.set(build.detectedStartCommand);

      const currentPhase = this.phase();
      if (currentPhase === 'confirm' || currentPhase === 'failed') {
        this.stopPolling();
        return;
      }
      this.applyTerminalPhaseTransition(build, false);
    }, 5000);
  }

  private applyDetectedFieldsIfMissing(build: {
    detectedFramework?: string | null;
    detectedPort?: number | null;
    suggestedName?: string | null;
    imageRef?: string | null;
  }): void {
    if (
      build.detectedFramework &&
      build.detectedFramework !== 'unknown' &&
      !this.detectedFramework()
    ) {
      this.detectedFramework.set(build.detectedFramework);
    }
    if (build.detectedPort && !this.detectedPort()) this.detectedPort.set(build.detectedPort);
    if (build.suggestedName && !this.appName()) this.appName.set(build.suggestedName);
    if (build.imageRef && !this.imageRef()) this.imageRef.set(build.imageRef);
  }

  private applyTerminalPhaseTransition(
    build: { status: string; errorMessage?: string | null },
    stopHeartbeat: boolean,
  ): void {
    if (build.status === 'COMPLETED') {
      this.phase.set('confirm');
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

  private async syncBuildState(): Promise<void> {
    const build = await firstValueFrom(
      this.buildsApi.standaloneBuildsControllerGetBuild(this.buildId()),
    ).catch(() => null);
    if (!build) return;
    this.buildStatus.set(build.status);
    this.connectionLost.set(false);
    this.applyDetectedFieldsIfMissing(build);
    const currentPhase = this.phase();
    if (currentPhase === 'confirm' || currentPhase === 'failed') return;
    this.applyTerminalPhaseTransition(build, true);
  }

  private startElapsedTimer(): void {
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

  async createAndDeploy(): Promise<void> {
    if (!this.isNameValid() || this.isCreating()) return;
    const state = this.wizardState();
    if (!state) return;

    this.isCreating.set(true);
    try {
      const response: CreateApplicationResponseDto = await firstValueFrom(
        this.applicationsApi.applicationsControllerCreate(state.clusterId, {
          name: this.appName().trim(),
          projectId: state.projectId ?? undefined,
          buildId: this.buildId(),
          category: CreateApplicationDto.CategoryEnum.User,
          sourceType: CreateApplicationDto.SourceTypeEnum.GitBuild,
          sourceConfig: {},
          autoDeploy: true,
          port: this.effectivePort() ?? undefined,
          replicas: state.replicas,
          resourceProfile: this.selectedProfile() as CreateApplicationDto.ResourceProfileEnum,
          env: state.envVars,
          ...(this.startCommandOverride().trim()
            ? { startCommand: this.startCommandOverride().trim() }
            : {}),
        } as any),
      );

      if (response.operation?.id) {
        this.router.navigate(['/apps/deploy', response.operation.id], {
          queryParams: { appId: response.application.id },
        });
      } else {
        this.router.navigate(['/apps/applications', response.application.id]);
      }
    } catch (err) {
      console.error('[StandaloneBuild] createAndDeploy failed', err);
    } finally {
      this.isCreating.set(false);
    }
  }

  async retryFromWizard(): Promise<void> {
    const state = this.wizardState();
    if (!state?.gitUrl) {
      this.router.navigate(['/apps/deploy/new']);
      return;
    }

    this.isDeleting.set(true);

    const oldBuildId = this.buildId();
    this.stopPolling();
    this.stopElapsedTimer();
    this.stopHeartbeatWatchdog();
    this.wsService.unsubscribeFromStandaloneBuild(oldBuildId);
    await firstValueFrom(
      this.buildsApi.standaloneBuildsControllerDeleteStandaloneBuild(oldBuildId),
    ).catch(() => undefined);

    let buildResp;
    try {
      buildResp = await firstValueFrom(
        this.buildsApi.standaloneBuildsControllerTriggerStandaloneBuild({
          gitUrl: state.gitUrl,
          branch: state.branch,
          targetClusterId: state.clusterId,
        }),
      );
    } catch {
      this.isDeleting.set(false);
      return;
    }

    this.buildId.set(buildResp.id);
    this.buildStatus.set('PENDING');
    this.buildLogs.set([]);
    this.detectedFramework.set(null);
    this.buildCommand.set(null);
    this.startCommand.set(null);
    this.imageRef.set(null);
    this.errorMessage.set(null);
    this.phase.set('building');
    this.appName.set('');
    this.detectedPort.set(null);
    this.elapsedSeconds.set(0);
    this.isDeleting.set(false);
    this.connectionLost.set(false);

    this.location.replaceState(`/apps/deploy/standalone/${buildResp.id}`);

    await this.loadInitialState(buildResp.id);
  }

  private async loadProfiles(): Promise<void> {
    this.loadingProfiles.set(true);
    const res = await firstValueFrom(this.imagesApi.imagesControllerGetProfiles()).catch(
      () => null,
    );
    if (res) {
      this.availableProfiles.set(res.profiles);
      this.selectedProfile.set(res.defaultProfile);
    }
    this.loadingProfiles.set(false);
  }

  onPortInput(value: string): void {
    const n = Number.parseInt(value, 10);
    this.detectedPort.set(n > 0 && n <= 65535 ? n : null);
  }

  navigateBack(): void {
    this.router.navigate(['/apps/deploy/new']);
  }

  copyLogs(): void {
    navigator.clipboard.writeText(this.buildLogs().join('\n'));
  }
}
