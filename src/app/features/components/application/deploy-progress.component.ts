import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { firstValueFrom } from 'rxjs';
import { lucideCopy, lucideExternalLink, lucideRefreshCw } from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { AppRuntimeWebSocketService } from '../../service/app-runtime-websocket.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { InfrastructureOperationsService } from '../../../core/api/api/infrastructureOperations.service';
import { Application, DeploymentProgress } from '../../model/application.models';
import { buildOpenAppUrl } from '../../model/open-app-url';
import { evaluateEndpointReadiness } from '../../model/endpoint-readiness';
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
import { FlSpinner } from '../../../ui/primitives/spinner';
import { DeployProgressSteps } from './deploy-progress-steps';
import {
  DEPLOY_STEPS,
  buildDeploySteps,
  deploymentState,
  formatDuration,
  mapDeploymentStatus,
  pendingDeploySteps,
  secondsBetween,
} from './deploy-progress-model';

interface OperationStatusResponse {
  status: string;
  progress?: number;
  currentStep?: string;
  totalSteps?: number;
  errorMessage?: string;
  startedAt?: string;
  resourceName?: string;
  metadata?: { applicationName?: string; applicationId?: string; stepDescription?: string };
}

@Component({
  selector: 'app-deploy-progress',
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
    FlSpinner,
    DeployProgressSteps,
  ],
  providers: [provideIcons({ lucideCopy, lucideExternalLink, lucideRefreshCw })],
  template: `
    <div class="fl-page">
      @if (progress(); as deployment) {
        @let state = headerState();
        <fl-page-header [title]="deployment.applicationName" [breadcrumb]="breadcrumb()">
          <fl-status headerStatus [tone]="state.tone" [label]="state.label" />
          <span headerMeta class="fl-num">
            Step {{ deployment.currentStepIndex + 1 }} of {{ deployment.totalSteps }}
          </span>
          <span headerMeta class="fl-num">{{ deployment.progress }}%</span>
          @if (deployment.startedAt) {
            <span headerMeta>
              Elapsed <span class="fl-mono fl-num">{{ elapsed() }}</span>
            </span>
          }
          @if (deployment.status === 'in_progress') {
            <span headerMeta>This may take a few minutes</span>
          }
          @if (deployment.status === 'completed') {
            <ng-container headerActions>
              <button flButton="ghost" type="button" (click)="deployAnother()">
                Deploy another
              </button>
              @if (appUrl(); as url) {
                <a flButton [href]="url" target="_blank" rel="noopener noreferrer">
                  <fl-icon name="lucideExternalLink" />
                  Open URL
                </a>
              }
              @if (deployment.applicationId) {
                <button flButton="primary" type="button" (click)="viewApplicationDetails()">
                  Open application
                </button>
              }
            </ng-container>
          }
        </fl-page-header>

        @if (deployment.status === 'failed') {
          <fl-alert tone="error" title="Deployment failed">
            {{ deployment.errorMessage || 'The deployment stopped before it finished.' }}
            <ng-container alertActions>
              <button flButton="primary" size="sm" type="button" (click)="retryDeployment()">
                <fl-icon name="lucideRefreshCw" />
                Retry deployment
              </button>
              <button flButton size="sm" type="button" (click)="editConfiguration()">
                Edit configuration
              </button>
              <button flButton="ghost" size="sm" type="button" (click)="navigateBack()">
                Back to applications
              </button>
            </ng-container>
          </fl-alert>
        }

        <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
          <div class="fl-stack lg:col-span-2">
            <app-deploy-progress-steps
              [steps]="deployment.steps"
              [now]="now()"
              [detail]="lastLog()"
            />

            <fl-panel title="Log">
              <button
                panelActions
                flButton="ghost"
                size="sm"
                type="button"
                [disabled]="!deployment.logs.length"
                (click)="copyLogs()"
              >
                <fl-icon name="lucideCopy" />
                Copy log
              </button>
              <div
                class="fl-mono max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3 text-fl-ink"
              >
                @for (log of deployment.logs; track $index) {
                  <div>{{ log }}</div>
                }
                @if (deployment.status === 'in_progress') {
                  <div class="fl-row text-fl-ink-muted">
                    <fl-spinner label="Waiting for output" />
                    Waiting for output
                  </div>
                } @else if (!deployment.logs.length) {
                  <div class="text-fl-ink-muted">No output yet</div>
                }
              </div>
            </fl-panel>
          </div>

          <fl-panel title="Details">
            <fl-key-value class="fl-kv--compact">
              <fl-kv-item key="Operation ID">
                <fl-copy-id
                  [value]="deployment.operationId"
                  [display]="deployment.operationId.substring(0, 12) + '…'"
                  label="operation ID"
                />
              </fl-kv-item>
              @if (deployment.applicationId) {
                <fl-kv-item key="Application ID">
                  <fl-copy-id
                    [value]="deployment.applicationId"
                    [display]="deployment.applicationId | maskId"
                    label="application ID"
                  />
                </fl-kv-item>
              }
              @if (application(); as app) {
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
              }
              @if (appUrl(); as url) {
                <fl-kv-item key="URL">
                  <fl-copy-id [value]="url" label="URL" />
                </fl-kv-item>
              }
              @if (deployment.estimatedDuration) {
                <fl-kv-item key="Estimated duration">
                  <span class="fl-mono fl-num">~{{ deployment.estimatedDuration }}s</span>
                </fl-kv-item>
              }
            </fl-key-value>
          </fl-panel>
        </div>
      } @else {
        <fl-panel><fl-loading-state [rows]="5" /></fl-panel>
      }
    </div>
  `,
})
export class DeployProgressComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly appService = inject(ApplicationService);
  private readonly operationsApi = inject(InfrastructureOperationsService);
  private readonly wsService = inject(AppRuntimeWebSocketService);
  private readonly endpointsService = inject(AppEndpointsService);

  progress = signal<DeploymentProgress | null>(null);
  readonly application = signal<Application | null>(null);
  protected readonly now = signal(Date.now());

  protected readonly headerState = computed(() =>
    deploymentState(this.progress()?.status ?? 'pending'),
  );

  protected readonly breadcrumb = computed<Crumb[]>(() => [
    { label: 'Applications', link: '/apps/applications' },
    { label: 'Deploy', link: '/apps/deploy/new' },
    { label: this.progress()?.applicationName ?? 'Application' },
  ]);

  protected readonly elapsed = computed(() => {
    const deployment = this.progress();
    const seconds = secondsBetween(deployment?.startedAt, deployment?.completedAt ?? this.now());
    return seconds === null ? '' : formatDuration(seconds);
  });

  protected readonly lastLog = computed(() => this.progress()?.logs.at(-1) ?? null);

  readonly appUrl = computed<string | null>(() => {
    const deployment = this.progress();
    if (deployment?.status !== 'completed') return null;
    const appId = deployment.applicationId;
    if (!appId) return null;
    const endpoint = this.endpointsService
      .endpoints()
      .find(
        (e) =>
          e.applicationId === appId &&
          e.endpointType === 'public' &&
          evaluateEndpointReadiness(e).isReady,
      );
    if (!endpoint) return null;
    const url = buildOpenAppUrl(endpoint.fqdn);
    return url || null;
  });

  private endpointsLoadedFor: string | null = null;

  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  private elapsedIntervalId: ReturnType<typeof setInterval> | null = null;
  private operationId = '';
  private appId = '';
  private readonly maxPolls = 200;
  private pollCount = 0;

  ngOnInit(): void {
    this.operationId = this.route.snapshot.paramMap.get('operationId') ?? '';
    this.appId = this.route.snapshot.queryParamMap.get('appId') ?? '';

    if (!this.operationId) {
      this.navigateBack();
      return;
    }

    this.initProgress();
    this.startElapsedTimer();
    this.subscribeWs();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.elapsedIntervalId) clearInterval(this.elapsedIntervalId);
    if (this.appId) this.wsService.unsubscribeFromApp(this.appId);
  }

  private initProgress(): void {
    this.progress.set({
      operationId: this.operationId,
      applicationId: this.appId || undefined,
      applicationName: 'Application',
      status: 'pending',
      progress: 0,
      currentStep: '',
      currentStepIndex: 0,
      totalSteps: DEPLOY_STEPS.length,
      steps: pendingDeploySteps(),
      logs: [],
      startedAt: new Date(),
    });
  }

  private startPolling(): void {
    this.pollOnce();
    this.pollingIntervalId = setInterval(() => this.pollOnce(), 3000);
  }

  private stopPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  }

  private async pollOnce(): Promise<void> {
    if (this.pollCount >= this.maxPolls) {
      this.stopPolling();
      return;
    }
    this.pollCount++;

    const op = (await firstValueFrom(
      this.operationsApi.infrastructureOperationsControllerGetOperationStatus(this.operationId),
    ).catch(() => null)) as OperationStatusResponse | null;
    if (!op) return;

    const mappedStatus = mapDeploymentStatus(op.status);
    const name = op.resourceName ?? op.metadata?.applicationName;
    if (name) {
      this.progress.update((p) => (p ? { ...p, applicationName: name } : p));
    }
    this.applyOperationUpdate({
      percentage: op.progress ?? 0,
      currentStep: op.currentStep ?? '',
      totalSteps: op.totalSteps ?? DEPLOY_STEPS.length,
      message: op.metadata?.stepDescription ?? '',
      status: mappedStatus,
      errorMessage: op.errorMessage,
      appId: op.metadata?.applicationId ?? this.appId,
      startedAt: op.startedAt,
    });

    if (mappedStatus === 'completed' || mappedStatus === 'failed') {
      this.stopPolling();
    }
    if (mappedStatus === 'completed') {
      await this.loadEndpointsForApp();
    }
  }

  private async loadEndpointsForApp(): Promise<void> {
    const appId = this.progress()?.applicationId;
    if (!appId || this.endpointsLoadedFor === appId) return;
    this.endpointsLoadedFor = appId;
    try {
      const app = await this.appService.getApplication(appId);
      this.application.set(app);
      if (app?.clusterId) {
        await this.endpointsService.loadEndpoints(app.clusterId);
      }
    } catch {
      this.endpointsLoadedFor = null;
    }
  }

  private subscribeWs(): void {
    if (!this.appId) return;

    this.wsService.subscribeToOperationEvents(this.appId, {
      onProgress: (e) => {
        const stepId = e.currentStep > 0 ? (DEPLOY_STEPS[e.currentStep - 1]?.id ?? '') : '';
        this.applyOperationUpdate({
          percentage: e.percentage,
          currentStep: stepId,
          totalSteps: e.totalSteps,
          message: e.message,
          status: 'in_progress',
        });
      },
      onCompleted: () => {
        this.applyOperationUpdate({
          percentage: 100,
          currentStep: 'app_deploy_finalize',
          totalSteps: DEPLOY_STEPS.length,
          message: '',
          status: 'completed',
        });
        this.stopPolling();
        this.loadEndpointsForApp();
      },
      onFailed: (e) => {
        this.applyOperationUpdate({
          percentage: 0,
          currentStep: '',
          totalSteps: DEPLOY_STEPS.length,
          message: e.error,
          status: 'failed',
          errorMessage: e.error,
        });
        this.stopPolling();
      },
    });
  }

  private applyOperationUpdate(update: {
    percentage: number;
    currentStep: string;
    totalSteps: number;
    message: string;
    status: string;
    errorMessage?: string;
    appId?: string;
    startedAt?: string;
  }): void {
    this.progress.update((prev) => {
      if (!prev) return prev;

      const now = new Date();
      const mappedStatus = mapDeploymentStatus(update.status);
      const steps = buildDeploySteps(
        prev.steps,
        update.currentStep,
        update.percentage,
        update.errorMessage,
        now,
      );
      const runningIdx = steps.findIndex((s) => s.status === 'running');
      const allCompleted = steps.every((s) => s.status === 'completed');
      let currentStepIdx: number;
      if (runningIdx >= 0) currentStepIdx = runningIdx;
      else if (allCompleted) currentStepIdx = steps.length - 1;
      else currentStepIdx = -1;
      const terminal = mappedStatus === 'completed' || mappedStatus === 'failed';

      return {
        ...prev,
        status: mappedStatus,
        progress: update.percentage,
        currentStep: update.currentStep,
        currentStepIndex: currentStepIdx >= 0 ? currentStepIdx : prev.currentStepIndex,
        totalSteps: update.totalSteps,
        steps,
        errorMessage: update.errorMessage,
        applicationId: update.appId || prev.applicationId,
        startedAt: prev.startedAt ?? (update.startedAt ? new Date(update.startedAt) : undefined),
        completedAt: terminal ? (prev.completedAt ?? now) : undefined,
        logs: update.message ? [...prev.logs, update.message].slice(-50) : prev.logs,
      };
    });
  }

  startElapsedTimer(): void {
    this.elapsedIntervalId = setInterval(() => this.now.set(Date.now()), 1000);
  }

  copyLogs(): void {
    const deployment = this.progress();
    if (!deployment) return;

    const logsText = deployment.logs.join('\n');
    navigator.clipboard.writeText(logsText);
  }

  navigateBack(): void {
    this.router.navigate(['/apps/applications']);
  }

  viewApplicationDetails(): void {
    const deployment = this.progress();
    if (deployment?.applicationId) {
      this.router.navigate(['/apps/applications', deployment.applicationId]);
    }
  }

  deployAnother(): void {
    this.router.navigate(['/apps/deploy/new']);
  }

  retryDeployment(): void {
    this.navigateBack();
  }

  editConfiguration(): void {
    this.router.navigate(['/apps/deploy/new']);
  }
}
