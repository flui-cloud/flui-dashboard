import { Component, OnInit, OnDestroy, signal, computed, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideLoader,
  lucideTriangleAlert,
  lucideX,
  lucideGitBranch,
  lucidePackage,
  lucideTerminal,
  lucideClock,
  lucideExternalLink,
  lucideCopy,
  lucideRefreshCw,
  lucideHammer,
  lucideContainer,
  lucideRocket,
  lucideCpu,
  lucideSquare,
} from '@ng-icons/lucide';
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

type BuildPhase = AppBuildResponseDto['status'];

const BUILD_PHASES: Array<{ id: BuildPhase; label: string; icon: string }> = [
  { id: 'CLONING',   label: 'Cloning repository',  icon: 'lucideGitBranch' },
  { id: 'ANALYZING', label: 'Detecting framework',  icon: 'lucidePackage' },
  { id: 'BUILDING',  label: 'Building image',       icon: 'lucideHammer' },
  { id: 'PUSHING',   label: 'Pushing to registry',  icon: 'lucideContainer' },
];

const PHASE_ORDER: BuildPhase[] = ['PENDING', 'CLONING', 'ANALYZING', 'BUILDING', 'PUSHING', 'COMPLETED'];

function phaseIndex(status: BuildPhase): number {
  return PHASE_ORDER.indexOf(status);
}

@Component({
  selector: 'app-build-progress',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({
      lucideArrowLeft, lucideCheck, lucideLoader, lucideTriangleAlert,
      lucideX, lucideGitBranch, lucidePackage, lucideTerminal, lucideClock,
      lucideExternalLink, lucideCopy, lucideRefreshCw, lucideHammer,
      lucideContainer, lucideRocket, lucideCpu, lucideSquare,
    }),
  ],
  template: `
    <div class="max-w-6xl mx-auto p-6">
      <!-- Back -->
      <div class="mb-6">
        <button (click)="navigateBack()"
          class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ng-icon name="lucideArrowLeft" class="h-4 w-4 mr-2" />
          Back to Applications
        </button>
      </div>

      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-start justify-between mb-2">
          <div>
            <h1 class="text-2xl font-bold mb-1">Building Application</h1>
            <p class="text-sm text-muted-foreground font-mono">{{ applicationId() }}</p>
          </div>
          <div class="text-right">
            <span [class]="getStatusBadgeClass()">{{ getStatusLabel() }}</span>
            <div class="text-xs text-muted-foreground mt-1 flex items-center justify-end">
              <ng-icon name="lucideClock" class="h-3 w-3 mr-1" />
              {{ formatDuration(elapsedSeconds()) }}
            </div>
          </div>
        </div>

        <!-- Build progress bar -->
        @if (phase() === 'building') {
          <div class="flex items-center gap-3 mt-4">
            <div class="flex-1 h-2 bg-border rounded-full overflow-hidden">
              <div [style.width.%]="getBuildProgressPercent()"
                class="h-full bg-blue-500 transition-all duration-500 ease-out"></div>
            </div>
            <span class="text-xs text-muted-foreground tabular-nums w-8 text-right">
              {{ getBuildProgressPercent() }}%
            </span>
          </div>
        }
        <!-- Deploy progress bar -->
        @if (phase() === 'deploying') {
          <div class="flex items-center gap-3 mt-4">
            <div class="flex-1 h-2 bg-border rounded-full overflow-hidden">
              <div [style.width.%]="deployProgress()"
                class="h-full bg-primary transition-all duration-500 ease-out"></div>
            </div>
            <span class="text-xs text-muted-foreground tabular-nums w-8 text-right">
              {{ deployProgress() }}%
            </span>
          </div>
        }
      </div>

      <!-- Connection lost banner -->
      @if (connectionLost() && (phase() === 'building' || phase() === 'deploying')) {
        <div class="mb-6 flex items-center gap-3 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
          <ng-icon name="lucideTriangleAlert" class="h-4 w-4 flex-shrink-0" />
          <span>Connection lost — the build is still running. Reconnecting...</span>
          <ng-icon name="lucideLoader" class="h-4 w-4 flex-shrink-0 animate-spin ml-auto" />
        </div>
      }

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left + Center: phases + logs -->
        <div class="lg:col-span-2 space-y-6">

          <!-- Build Phase Timeline -->
          <div class="bg-card border border-border rounded-lg p-6">
            <h2 class="text-lg font-semibold mb-4 flex items-center">
              <ng-icon name="lucideHammer" class="h-5 w-5 mr-2" />
              Build Pipeline
            </h2>
            <div class="space-y-4">
              @for (ph of buildPhases; track ph.id) {
                <div class="flex items-start gap-4">
                  <div [class]="getPhaseIconClass(ph.id)" class="flex-shrink-0 mt-0.5">
                    @if (getPhaseStatus(ph.id) === 'completed') {
                      <ng-icon name="lucideCheck" class="h-4 w-4" />
                    } @else if (getPhaseStatus(ph.id) === 'running') {
                      <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                    } @else if (getPhaseStatus(ph.id) === 'error') {
                      <ng-icon name="lucideX" class="h-4 w-4" />
                    } @else {
                      <div class="w-2.5 h-2.5 rounded-full bg-current"></div>
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span [class]="getPhaseLabelClass(ph.id)" class="text-sm font-medium">
                        {{ ph.label }}
                      </span>
                      @if (ph.id === 'ANALYZING' && detectedFramework()) {
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          <ng-icon name="lucidePackage" class="h-3 w-3 mr-1" />
                          {{ detectedFramework() }}
                        </span>
                      }
                      @if (ph.id === 'ANALYZING' && detectedFrontendFramework()) {
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          <ng-icon name="lucidePackage" class="h-3 w-3 mr-1" />
                          {{ detectedFrontendFramework() }}
                        </span>
                      }
                    </div>
                    @if (ph.id === 'ANALYZING' && (buildCommand() || startCommand())) {
                      <div class="mt-1.5 space-y-1">
                        @if (buildCommand()) {
                          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span class="font-medium text-muted-foreground/70 w-16 shrink-0">build:</span>
                            <code class="bg-muted px-1.5 py-0.5 rounded font-mono truncate">{{ buildCommand() }}</code>
                          </div>
                        }
                        @if (startCommand()) {
                          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span class="font-medium text-muted-foreground/70 w-16 shrink-0">start:</span>
                            <code class="bg-muted px-1.5 py-0.5 rounded font-mono truncate">{{ startCommand() }}</code>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Deploy phase (appears after build completes) -->
              @if (phase() === 'deploying' || phase() === 'completed') {
                <div class="flex items-start gap-4">
                  <div [class]="getDeployPhaseIconClass()" class="flex-shrink-0 mt-0.5">
                    @if (phase() === 'completed') {
                      <ng-icon name="lucideCheck" class="h-4 w-4" />
                    } @else {
                      <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                    }
                  </div>
                  <div class="flex-1">
                    <span class="text-sm font-medium" [class]="phase() === 'completed' ? 'text-foreground' : 'text-primary'">
                      Deploying application
                    </span>
                    @if (deployMessage()) {
                      <p class="text-xs text-muted-foreground mt-0.5">{{ deployMessage() }}</p>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Live Logs -->
          <div class="bg-card border border-border rounded-lg">
            <div class="p-4 border-b border-border flex items-center justify-between">
              <h2 class="text-lg font-semibold flex items-center">
                <ng-icon name="lucideTerminal" class="h-5 w-5 mr-2" />
                Build Logs
              </h2>
              <button (click)="copyLogs()"
                class="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ng-icon name="lucideCopy" class="h-4 w-4 mr-1" />
                Copy
              </button>
            </div>
            <div class="p-4 bg-gray-900 dark:bg-black rounded-b-lg">
              <div #logContainer
                class="font-mono text-xs text-green-400 space-y-0.5 h-80 overflow-y-auto">
                @for (log of buildLogs(); track $index) {
                  <div [class]="log.startsWith('[stderr]') ? 'text-yellow-400' : ''"
                    class="whitespace-pre-wrap leading-relaxed">{{ log }}</div>
                }
                @if (phase() === 'building' && buildLogs().length === 0) {
                  <div class="flex items-center gap-1.5 text-gray-500 text-xs">
                    <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
                    Waiting for build output...
                  </div>
                }
              </div>
            </div>
          </div>

        </div>

        <!-- Right Sidebar -->
        <div class="space-y-4">

          <!-- Success -->
          @if (phase() === 'completed') {
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
              <div class="flex items-center mb-4">
                <div class="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center mr-3">
                  <ng-icon name="lucideCheck" class="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 class="font-semibold text-green-900 dark:text-green-100">Build & Deploy Successful!</h3>
                  <p class="text-xs text-green-700 dark:text-green-300">Application is running</p>
                </div>
              </div>
              <div class="space-y-2">
                <button (click)="viewApplication()"
                  class="inline-flex items-center justify-center w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors">
                  <ng-icon name="lucideExternalLink" class="h-4 w-4 mr-2" />
                  View Application
                </button>
                <button (click)="viewBuildHistory()"
                  class="inline-flex items-center justify-center w-full rounded-md border border-green-300 dark:border-green-700 bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                  Build History
                </button>
              </div>
            </div>
          }

          <!-- Failed -->
          @if (phase() === 'failed') {
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <div class="flex items-center mb-4">
                <div class="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center mr-3">
                  @if (isResourceError()) {
                    <ng-icon name="lucideCpu" class="h-5 w-5 text-white" />
                  } @else {
                    <ng-icon name="lucideTriangleAlert" class="h-5 w-5 text-white" />
                  }
                </div>
                <div>
                  <h3 class="font-semibold text-red-900 dark:text-red-100">
                    {{ isResourceError() ? 'Build Failed — Insufficient Resources' : 'Build Failed' }}
                  </h3>
                  @if (isResourceError()) {
                    <p class="text-xs text-red-700 dark:text-red-300 mt-0.5">
                      The cluster did not have enough resources to run the build job.
                    </p>
                  }
                </div>
              </div>

              @if (errorMessage()) {
                @if (isResourceError()) {
                  <!-- Structured resource error -->
                  <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg space-y-2">
                    <p class="text-xs font-medium text-red-800 dark:text-red-200">Error details:</p>
                    <p class="text-xs text-red-700 dark:text-red-300 font-mono break-all">{{ errorMessage() }}</p>
                    <div class="pt-2 border-t border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                      <strong>Tip:</strong> Free up resources on the cluster, or trigger a new build once autoscaling completes.
                    </div>
                  </div>
                } @else {
                  <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-800 dark:text-red-200 font-mono break-all">
                    {{ errorMessage() }}
                  </div>
                }
              }

              <div class="space-y-2">
                @if (!isResourceError()) {
                  <button (click)="retryBuild()" [disabled]="isRetrying()"
                    class="inline-flex items-center justify-center w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
                    @if (isRetrying()) {
                      <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" />
                    } @else {
                      <ng-icon name="lucideRefreshCw" class="h-4 w-4 mr-2" />
                    }
                    Retry Build
                  </button>
                } @else {
                  <button (click)="retryBuild()" [disabled]="isRetrying()"
                    class="inline-flex items-center justify-center w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
                    @if (isRetrying()) {
                      <ng-icon name="lucideLoader" class="h-4 w-4 mr-2 animate-spin" />
                    } @else {
                      <ng-icon name="lucideRefreshCw" class="h-4 w-4 mr-2" />
                    }
                    Retry when resources free up
                  </button>
                }
                <button (click)="viewBuildHistory()"
                  class="inline-flex items-center justify-center w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                  Build History
                </button>
              </div>
            </div>
          }

          <!-- In-progress info -->
          @if (phase() === 'building' || phase() === 'deploying') {
            <div class="bg-muted/40 border border-border rounded-lg p-4">
              <div class="flex items-start gap-3">
                <ng-icon name="lucideLoader" class="h-4 w-4 text-muted-foreground mt-0.5 animate-spin flex-shrink-0" />
                <div>
                  <h4 class="text-sm font-medium mb-1">
                    {{ phase() === 'building' ? 'Building...' : 'Deploying...' }}
                  </h4>
                  <p class="text-xs text-muted-foreground">This may take a few minutes.</p>
                </div>
              </div>
              @if (phase() === 'building') {
                <button (click)="cancelBuild()" [disabled]="isCancelling()"
                  class="mt-3 inline-flex items-center justify-center w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-60 transition-colors">
                  @if (isCancelling()) {
                    <ng-icon name="lucideLoader" class="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  } @else {
                    <ng-icon name="lucideSquare" class="h-3.5 w-3.5 mr-1.5" />
                  }
                  Cancel Build
                </button>
              }
            </div>
          }

          <!-- Build Info -->
          <div class="bg-card border border-border rounded-lg p-4">
            <h3 class="font-medium mb-3 text-sm">Build Info</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-muted-foreground">Build ID:</span>
                <code class="text-xs bg-muted px-2 py-0.5 rounded">{{ buildId().substring(0, 12) }}...</code>
              </div>
              @if (detectedFramework()) {
                <div class="flex justify-between items-center">
                  <span class="text-muted-foreground">Runtime:</span>
                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                    {{ detectedFramework() }}
                  </span>
                </div>
              }
              @if (detectedFrontendFramework()) {
                <div class="flex justify-between items-center">
                  <span class="text-muted-foreground">Frontend:</span>
                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {{ detectedFrontendFramework() }}
                  </span>
                </div>
              }
              @if (detectedPort()) {
                <div class="flex justify-between items-center">
                  <span class="text-muted-foreground">Port:</span>
                  <code class="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{{ detectedPort() }}</code>
                </div>
              }
              @if (buildCommand()) {
                <div class="flex justify-between items-start gap-2">
                  <span class="text-muted-foreground shrink-0">Build cmd:</span>
                  <code class="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-right break-all">{{ buildCommand() }}</code>
                </div>
              }
              @if (startCommand()) {
                <div class="flex justify-between items-start gap-2">
                  <span class="text-muted-foreground shrink-0">Start cmd:</span>
                  <code class="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-right break-all">{{ startCommand() }}</code>
                </div>
              }
              <div class="flex justify-between">
                <span class="text-muted-foreground">Status:</span>
                <span class="font-medium text-xs">{{ buildStatus() }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">Elapsed:</span>
                <span class="font-medium text-xs tabular-nums">{{ formatDuration(elapsedSeconds()) }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class AppBuildProgressComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('logContainer') private readonly logContainer?: ElementRef<HTMLDivElement>;

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

  readonly buildPhases = BUILD_PHASES;

  readonly isResourceError = computed(() => {
    const err = this.errorMessage()?.toLowerCase() ?? '';
    return err.includes('insufficient') && (err.includes('cpu') || err.includes('memory'));
  });

  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  private elapsedIntervalId: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private shouldScrollLogs = false;

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

    // Load initial state (handles page reload mid-build)
    let startedAt: string | undefined;
    try {
      const build = await firstValueFrom(this.appBuildsApi.appBuildsControllerGetBuild(bId));
      this.buildStatus.set(build.status);
      startedAt = build.startedAt;
      if (build.logs?.length) {
        this.buildLogs.set(build.logs);
        this.shouldScrollLogs = true;
      }
      const plan = build.railpackPlan as any;
      if (plan?.framework && plan.framework !== 'unknown') this.detectedFramework.set(plan.framework);
      if (plan?.buildCommand) this.buildCommand.set(plan.buildCommand);
      if (plan?.startCommand) this.startCommand.set(plan.startCommand);
      if (build.detectedFramework && build.detectedFramework !== 'unknown') this.detectedFramework.set(build.detectedFramework);
      if (build.detectedFrontendFramework) this.detectedFrontendFramework.set(build.detectedFrontendFramework);
      if (build.detectedPort) this.detectedPort.set(build.detectedPort);

      if (build.status === 'COMPLETED') {
        const DEPLOY_WINDOW_MS = 5 * 60 * 1000;
        const completedAgo = build.completedAt
          ? Date.now() - new Date(build.completedAt).getTime()
          : Infinity;
        if (completedAgo > DEPLOY_WINDOW_MS) {
          this.phase.set('completed');
          return;
        }
        this.phase.set('deploying');
      } else if (build.status === 'FAILED' || build.status === 'CANCELLED') {
        this.phase.set('failed');
        this.errorMessage.set(build.errorMessage ?? 'Build failed');
        return; // no WS needed
      }
    } catch {
      // proceed with defaults
    }

    this.startElapsedTimer(startedAt);
    this.subscribeWebSocket(appId);
    this.startPolling(bId);
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.stopElapsedTimer();
    this.stopHeartbeatWatchdog();
    this.wsService.unsubscribeFromApp(this.applicationId());
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollLogs) {
      this.scrollLogsToBottom();
      this.shouldScrollLogs = false;
    }
  }

  private subscribeWebSocket(appId: string): void {
    this.resetHeartbeatWatchdog();

    this.wsService.subscribeToBuildEvents(appId, {
      onLog: (e: BuildLogEvent) => {
        this.resetHeartbeatWatchdog();
        const prefix = e.stream === 'stderr' ? '[stderr] ' : '';
        this.buildLogs.update(logs => [...logs, prefix + e.line].slice(-500));
        this.shouldScrollLogs = true;
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
    // Only advance — never go backwards
    const current = this.buildStatus();
    if (current === 'COMPLETED' || current === 'FAILED' || current === 'CANCELLED') return;

    const l = line.toLowerCase();

    if (current === 'PENDING' || current === 'CLONING') {
      // Railpack output appears once cloning is done and analysis starts
      if (l.includes('railpack') || l.includes('detected ') || l.includes('deploying as')) {
        this.buildStatus.set('ANALYZING');
        return;
      }
    }
    if (current === 'PENDING' || current === 'CLONING' || current === 'ANALYZING') {
      // buildctl / --- RAILPACK BUILD --- marks the start of the image build
      if (l.includes('railpack build') || l.includes('buildctl') || l.includes('#1 ') || l.includes('load build definition')) {
        this.buildStatus.set('BUILDING');
        return;
      }
    }
    if (current === 'BUILDING') {
      // pushing / exporting marks the PUSHING phase
      if (l.includes('pushing') || l.includes('exporting') || l.includes('writing image')) {
        this.buildStatus.set('PUSHING');
        return;
      }
    }
  }

  private startPolling(buildId: string): void {
    this.pollingIntervalId = setInterval(async () => {
      try {
        const build = await firstValueFrom(this.appBuildsApi.appBuildsControllerGetBuild(buildId));
        this.buildStatus.set(build.status);

        // Sync logs from API as fallback when WS events are missed
        if (build.logs?.length && build.logs.length > this.buildLogs().length) {
          this.buildLogs.set(build.logs);
          this.shouldScrollLogs = true;
        }

        // Pick up railpackPlan if we missed the WS buildPlan event
        const plan = build.railpackPlan as any;
        if (plan) {
          if (plan.framework && plan.framework !== 'unknown' && !this.detectedFramework()) {
            this.detectedFramework.set(plan.framework);
          }
          if (plan.buildCommand && !this.buildCommand()) this.buildCommand.set(plan.buildCommand);
          if (plan.startCommand && !this.startCommand()) this.startCommand.set(plan.startCommand);
        }
        if (build.detectedFramework && build.detectedFramework !== 'unknown' && !this.detectedFramework()) {
          this.detectedFramework.set(build.detectedFramework);
        }
        if (build.detectedFrontendFramework && !this.detectedFrontendFramework()) {
          this.detectedFrontendFramework.set(build.detectedFrontendFramework);
        }
        if (build.detectedPort && !this.detectedPort()) this.detectedPort.set(build.detectedPort);

        const currentPhase = this.phase();
        if (currentPhase === 'completed' || currentPhase === 'failed') {
          this.stopPolling();
          return;
        }
        if (build.status === 'COMPLETED') {
          this.phase.set('deploying');
          this.stopPolling();
          this.stopElapsedTimer();
        } else if (build.status === 'FAILED' || build.status === 'CANCELLED') {
          this.phase.set('failed');
          this.errorMessage.set(build.errorMessage ?? 'Build failed');
          this.stopPolling();
          this.stopElapsedTimer();
        }
      } catch { /* ignore */ }
    }, 5000);
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
    try {
      const build = await firstValueFrom(
        this.appBuildsApi.appBuildsControllerGetLatestBuild(this.applicationId())
      );
      this.buildStatus.set(build.status);
      this.connectionLost.set(false);
      const plan = build.railpackPlan as any;
      if (plan?.framework && plan.framework !== 'unknown' && !this.detectedFramework()) {
        this.detectedFramework.set(plan.framework);
      }
      if (plan?.buildCommand && !this.buildCommand()) this.buildCommand.set(plan.buildCommand);
      if (plan?.startCommand && !this.startCommand()) this.startCommand.set(plan.startCommand);
      if (build.detectedFramework && build.detectedFramework !== 'unknown' && !this.detectedFramework()) {
        this.detectedFramework.set(build.detectedFramework);
      }
      if (build.detectedFrontendFramework && !this.detectedFrontendFramework()) {
        this.detectedFrontendFramework.set(build.detectedFrontendFramework);
      }
      if (build.detectedPort && !this.detectedPort()) this.detectedPort.set(build.detectedPort);
      // Don't override a terminal phase (completed/failed) on reconnect
      const currentPhase = this.phase();
      if (currentPhase === 'completed' || currentPhase === 'failed') return;

      if (build.status === 'COMPLETED') {
        this.phase.set('deploying');
        this.stopPolling();
        this.stopElapsedTimer();
        this.stopHeartbeatWatchdog();
      } else if (build.status === 'FAILED' || build.status === 'CANCELLED') {
        this.phase.set('failed');
        this.errorMessage.set(build.errorMessage ?? 'Build failed');
        this.stopPolling();
        this.stopElapsedTimer();
        this.stopHeartbeatWatchdog();
      }
    } catch { /* ignore */ }
  }

  private startElapsedTimer(startedAt?: string): void {
    const offset = startedAt
      ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      : 0;
    this.elapsedSeconds.set(Math.max(0, offset));
    this.elapsedIntervalId = setInterval(() => {
      this.elapsedSeconds.update(s => s + 1);
    }, 1000);
  }

  private stopElapsedTimer(): void {
    if (this.elapsedIntervalId) {
      clearInterval(this.elapsedIntervalId);
      this.elapsedIntervalId = null;
    }
  }

  private scrollLogsToBottom(): void {
    if (this.logContainer) {
      const el = this.logContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  // ── Phase helpers ───────────────────────────────────────────────

  getPhaseStatus(phaseId: BuildPhase): 'pending' | 'running' | 'completed' | 'error' {
    const status = this.buildStatus();
    if (status === 'FAILED' && phaseIndex(phaseId) === phaseIndex(status)) return 'error';
    if (status === 'FAILED' && phaseIndex(phaseId) < phaseIndex('COMPLETED')) {
      // If failed, show earlier phases as completed if they came before the failure phase
      // We don't know exact failure phase, mark all as completed for safety
      return phaseIndex(phaseId) < phaseIndex(status) ? 'completed' : 'error';
    }
    if (phaseIndex(status) > phaseIndex(phaseId)) return 'completed';
    if (status === phaseId) return 'running';
    return 'pending';
  }

  getPhaseIconClass(phaseId: BuildPhase): string {
    const s = this.getPhaseStatus(phaseId);
    const base = 'h-6 w-6 rounded-full flex items-center justify-center text-sm';
    switch (s) {
      case 'completed': return `${base} bg-green-500 text-white`;
      case 'running':   return `${base} bg-primary text-primary-foreground`;
      case 'error':     return `${base} bg-destructive text-destructive-foreground`;
      default:          return `${base} bg-muted text-muted-foreground`;
    }
  }

  getPhaseLabelClass(phaseId: BuildPhase): string {
    const s = this.getPhaseStatus(phaseId);
    switch (s) {
      case 'completed': return 'text-foreground';
      case 'running':   return 'text-primary';
      case 'error':     return 'text-destructive';
      default:          return 'text-muted-foreground';
    }
  }

  getDeployPhaseIconClass(): string {
    const base = 'h-6 w-6 rounded-full flex items-center justify-center';
    return this.phase() === 'completed'
      ? `${base} bg-green-500 text-white`
      : `${base} bg-primary text-primary-foreground`;
  }

  getBuildProgressPercent(): number {
    const order = phaseIndex(this.buildStatus());
    const total = PHASE_ORDER.length - 1; // exclude COMPLETED
    return Math.round((order / total) * 100);
  }

  getStatusLabel(): string {
    switch (this.phase()) {
      case 'building':  return this.buildStatus();
      case 'deploying': return 'DEPLOYING';
      case 'completed': return 'RUNNING';
      case 'failed':    return 'FAILED';
    }
  }

  getStatusBadgeClass(): string {
    switch (this.phase()) {
      case 'completed': return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'failed':    return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:          return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
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
      // If already terminal, just reflect that state
      this.errorMessage.set(err?.error?.message ?? 'Failed to cancel build');
    } finally {
      this.isCancelling.set(false);
    }
  }

  async retryBuild(): Promise<void> {
    this.isRetrying.set(true);
    try {
      const r = await firstValueFrom(
        this.appBuildsApi.appBuildsControllerTriggerBuild(this.applicationId(), {})
      );
      if (!r.buildId) return;

      // Clean up current session before reinitializing
      this.stopPolling();
      if (this.elapsedIntervalId) { clearInterval(this.elapsedIntervalId); this.elapsedIntervalId = null; }
      this.wsService.unsubscribeFromApp(this.applicationId());

      // Reset all state signals
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

      // Update URL without full navigation (component stays mounted)
      this.router.navigate(['/apps/deploy/build', this.applicationId(), r.buildId], { replaceUrl: true });

      // Reinitialize with the new build
      await this.initializeBuild(this.applicationId(), r.buildId);
    } catch {
      this.isRetrying.set(false);
    }
  }
}
