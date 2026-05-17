import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
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
  lucideServer,
  lucideRocket,
  lucideActivity,
  lucideClock,
  lucideExternalLink,
  lucideCopy,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { AppRuntimeWebSocketService } from '../../service/app-runtime-websocket.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { InfrastructureOperationsService } from '../../../core/api/api/infrastructureOperations.service';
import { DeploymentProgress, DeploymentStep } from '../../model/application.models';
import { buildOpenAppUrl } from '../../model/open-app-url';
import { evaluateEndpointReadiness } from '../../model/endpoint-readiness';

// Steps for deploy_application operation type (from API doc)
const DEPLOY_STEPS: Array<{ id: string; name: string; description: string; progress: number }> = [
  { id: 'app_deploy_init', name: 'Initialization', description: 'Preparing deployment configuration', progress: 0 },
  { id: 'app_deploy_generate_manifests', name: 'Generate Manifests', description: 'Generating deployment manifests', progress: 15 },
  { id: 'app_deploy_apply_manifests', name: 'Apply Manifests', description: 'Applying manifests to the cluster', progress: 30 },
  { id: 'app_deploy_wait_ready', name: 'Wait for Instances', description: 'Waiting for instances to be ready', progress: 60 },
  { id: 'app_deploy_finalize', name: 'Finalize', description: 'Finalizing and saving revision', progress: 90 },
];

@Component({
  selector: 'app-deploy-progress',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideCheck,
      lucideLoader,
      lucideTriangleAlert,
      lucideX,
      lucideGitBranch,
      lucidePackage,
      lucideServer,
      lucideRocket,
      lucideActivity,
      lucideClock,
      lucideExternalLink,
      lucideCopy,
      lucideRefreshCw,
    }),
  ],
  template: `
    <div class="max-w-6xl mx-auto p-6">
      <!-- Back Button -->
      <div class="mb-6">
        <button
          (click)="navigateBack()"
          class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4 mr-2" />
          Back to Applications
        </button>
      </div>

      @if (progress(); as deployment) {
        <!-- Header -->
        <div class="mb-8">
          <div class="flex items-start justify-between mb-4">
            <div class="flex-1">
              <h1 class="text-2xl font-bold mb-2">{{ deployment.applicationName }}</h1>
              <p class="text-sm text-muted-foreground">
                Deployment in progress...
              </p>
            </div>
            <div class="text-right">
              <div [class]="getStatusBadgeClass(deployment.status)" class="inline-block mb-2">
                {{ getStatusLabel(deployment.status) }}
              </div>
              @if (deployment.startedAt) {
                <div class="text-xs text-muted-foreground flex items-center justify-end">
                  <ng-icon name="lucideClock" class="h-3 w-3 mr-1" />
                  Elapsed: {{ getElapsedTime(deployment.startedAt) }}
                </div>
              }
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="flex items-center gap-3">
            <div class="flex-1 h-3 bg-border rounded-full overflow-hidden">
              <div
                [style.width.%]="deployment.progress"
                [class]="getProgressBarClass(deployment.status)"
                class="h-full transition-all duration-500 ease-out"
              ></div>
            </div>
            <span class="text-xs text-muted-foreground tabular-nums w-8 text-right">{{ deployment.progress }}%</span>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Main Column: Steps -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Steps Timeline -->
            <div class="bg-card border border-border rounded-lg p-6">
              <h2 class="text-lg font-semibold mb-4 flex items-center">
                <ng-icon name="lucideActivity" class="h-5 w-5 mr-2" />
                Deployment Steps
              </h2>

              <div class="space-y-4">
                @for (step of deployment.steps; track step.id; let i = $index) {
                  <div class="flex items-start gap-4">
                    <!-- Step Icon -->
                    <div [class]="getStepIconClass(step.status)" class="flex-shrink-0">
                      @switch (step.status) {
                        @case ('completed') {
                          <ng-icon name="lucideCheck" class="h-5 w-5" />
                        }
                        @case ('running') {
                          <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin" />
                        }
                        @case ('error') {
                          <ng-icon name="lucideX" class="h-5 w-5" />
                        }
                        @default {
                          <div class="w-3 h-3 rounded-full bg-current"></div>
                        }
                      }
                    </div>

                    <!-- Step Content -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between mb-1">
                        <h4 [class]="getStepTitleClass(step.status)">
                          {{ step.name }}
                        </h4>
                        @if (step.duration) {
                          <span class="text-xs text-muted-foreground ml-2">
                            {{ step.duration | number:'1.0-1' }}s
                          </span>
                        }
                      </div>
                      <p class="text-sm text-muted-foreground">{{ step.description }}</p>

                      @if (step.status === 'error' && step.errorMessage) {
                        <div class="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-700 dark:text-red-300">
                          {{ step.errorMessage }}
                        </div>
                      }
                    </div>

                    <!-- Connector -->
                    @if (i < deployment.steps.length - 1) {
                      <div class="absolute left-[18px] top-[40px] w-0.5 h-8 bg-border"></div>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Build Logs -->
            <div class="bg-card border border-border rounded-lg">
              <div class="p-4 border-b border-border flex items-center justify-between">
                <h2 class="text-lg font-semibold flex items-center">
                  <ng-icon name="lucidePackage" class="h-5 w-5 mr-2" />
                  Build Logs
                </h2>
                <button
                  (click)="copyLogs()"
                  class="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ng-icon name="lucideCopy" class="h-4 w-4 mr-1" />
                  Copy Logs
                </button>
              </div>
              <div class="p-4 bg-gray-900 dark:bg-black">
                <div class="font-mono text-xs text-green-400 space-y-1 max-h-96 overflow-y-auto">
                  @for (log of deployment.logs; track $index) {
                    <div class="whitespace-pre-wrap">{{ log }}</div>
                  }
                  @if (deployment.status === 'in_progress') {
                    <div class="flex items-center gap-1.5 text-gray-600 dark:text-gray-500 text-xs">
                      <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
                      waiting...
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar: Info & Actions -->
          <div class="space-y-6">
            <!-- Success State -->
            @if (deployment.status === 'completed') {
              <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                <div class="flex items-center mb-4">
                  <div class="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center mr-4">
                    <ng-icon name="lucideCheck" class="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-green-900 dark:text-green-100">
                      Deployment Successful!
                    </h3>
                    <p class="text-sm text-green-700 dark:text-green-300">
                      Your application is live
                    </p>
                  </div>
                </div>

                <div class="space-y-2">
                  @if (appUrl(); as url) {
                    <a
                      [href]="url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center justify-center w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                    >
                      <ng-icon name="lucideExternalLink" class="h-4 w-4 mr-2" />
                      View Application
                    </a>
                  }
                  <button
                    (click)="viewApplicationDetails()"
                    class="inline-flex items-center justify-center w-full rounded-md border border-green-300 dark:border-green-700 bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Application Details
                  </button>
                  <button
                    (click)="deployAnother()"
                    class="inline-flex items-center justify-center w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Deploy Another
                  </button>
                </div>
              </div>
            }

            <!-- Error State -->
            @if (deployment.status === 'failed') {
              <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <div class="flex items-center mb-4">
                  <div class="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center mr-4">
                    <ng-icon name="lucideTriangleAlert" class="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-red-900 dark:text-red-100">
                      Deployment Failed
                    </h3>
                    <p class="text-sm text-red-700 dark:text-red-300">
                      An error occurred
                    </p>
                  </div>
                </div>

                @if (deployment.errorMessage) {
                  <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded text-sm text-red-800 dark:text-red-200">
                    {{ deployment.errorMessage }}
                  </div>
                }

                <div class="space-y-2">
                  <button
                    (click)="retryDeployment()"
                    class="inline-flex items-center justify-center w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                  >
                    <ng-icon name="lucideRefreshCw" class="h-4 w-4 mr-2" />
                    Retry Deployment
                  </button>
                  <button
                    (click)="editConfiguration()"
                    class="inline-flex items-center justify-center w-full rounded-md border border-red-300 dark:border-red-700 bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Edit Configuration
                  </button>
                  <button
                    (click)="navigateBack()"
                    class="inline-flex items-center justify-center w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Back to Applications
                  </button>
                </div>
              </div>
            }

            <!-- Deployment Info -->
            <div class="bg-card border border-border rounded-lg p-4">
              <h3 class="font-medium mb-3">Deployment Info</h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Operation ID:</span>
                  <code class="text-xs bg-muted px-2 py-1 rounded">
                    {{ deployment.operationId.substring(0, 12) }}...
                  </code>
                </div>
                @if (deployment.applicationId) {
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">App ID:</span>
                    <code class="text-xs bg-muted px-2 py-1 rounded">
                      {{ deployment.applicationId.substring(0, 12) }}...
                    </code>
                  </div>
                }
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Steps:</span>
                  <span class="font-medium">
                    {{ deployment.currentStepIndex + 1 }} / {{ deployment.totalSteps }}
                  </span>
                </div>
                @if (deployment.estimatedDuration) {
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">Est. Duration:</span>
                    <span class="font-medium">~{{ deployment.estimatedDuration }}s</span>
                  </div>
                }
              </div>
            </div>

            <!-- Progress Info -->
            @if (deployment.status === 'in_progress') {
              <div class="bg-muted/40 border border-border rounded-lg p-4">
                <div class="flex items-start gap-3">
                  <ng-icon name="lucideLoader" class="h-4 w-4 text-muted-foreground mt-0.5 animate-spin flex-shrink-0" />
                  <div>
                    <h4 class="text-sm font-medium text-foreground mb-1">Deploying...</h4>
                    <p class="text-xs text-muted-foreground">This may take a few minutes.</p>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      } @else {
        <!-- Loading State -->
        <div class="flex items-center justify-center min-h-[400px]">
          <div class="flex items-center gap-3 text-muted-foreground">
            <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
            <span class="text-sm">Loading deployment...</span>
          </div>
        </div>
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
  elapsedTime = signal<string>('0s');

  readonly appUrl = computed<string | null>(() => {
    const deployment = this.progress();
    if (deployment?.status !== 'completed') return null;
    const appId = deployment.applicationId;
    if (!appId) return null;
    const endpoint = this.endpointsService.endpoints().find(
      e => e.applicationId === appId
        && e.endpointType === 'public'
        && evaluateEndpointReadiness(e).isReady,
    );
    if (!endpoint) return null;
    const url = buildOpenAppUrl(endpoint.fqdn);
    return url || null;
  });

  private endpointsLoadedFor: string | null = null;

  private pollingIntervalId: any = null;
  private elapsedIntervalId: any = null;
  private operationId = '';
  private appId = '';
  private readonly maxPolls = 200; // ~10 min at 3s
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
      steps: DEPLOY_STEPS.map(s => ({ ...s, status: 'pending' as const })),
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

    try {
      const op: any = await firstValueFrom(
        this.operationsApi.infrastructureOperationsControllerGetOperationStatus(this.operationId)
      );
      const mappedStatus = this.mapStatus(op.status);
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
    } catch {
      // Keep polling on transient errors
    }
  }

  private async loadEndpointsForApp(): Promise<void> {
    const appId = this.progress()?.applicationId;
    if (!appId || this.endpointsLoadedFor === appId) return;
    this.endpointsLoadedFor = appId;
    try {
      const app = await this.appService.getApplication(appId);
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
      onCompleted: (e) => {
        this.applyOperationUpdate({ percentage: 100, currentStep: 'app_deploy_finalize', totalSteps: DEPLOY_STEPS.length, message: '', status: 'completed' });
        this.stopPolling();
        this.loadEndpointsForApp();
      },
      onFailed: (e) => {
        this.applyOperationUpdate({ percentage: 0, currentStep: '', totalSteps: DEPLOY_STEPS.length, message: e.error, status: 'failed', errorMessage: e.error });
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
    this.progress.update(prev => {
      if (!prev) return prev;

      const mappedStatus = this.mapStatus(update.status);
      const steps = this.buildSteps(update.currentStep, update.percentage, update.errorMessage);
      const runningIdx = steps.findIndex(s => s.status === 'running');
      const allCompleted = steps.every(s => s.status === 'completed');
      let currentStepIdx: number;
      if (runningIdx >= 0) currentStepIdx = runningIdx;
      else if (allCompleted) currentStepIdx = steps.length - 1;
      else currentStepIdx = -1;

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
        logs: update.message ? [...prev.logs, update.message].slice(-50) : prev.logs,
      };
    });
  }

  private buildSteps(currentStepId: string, percentage: number, errorMsg?: string): DeploymentStep[] {
    const allDone = percentage >= 100 && !errorMsg;
    const currentIdx = DEPLOY_STEPS.findIndex(s => s.id === currentStepId);
    return DEPLOY_STEPS.map((s, i) => {
      let status: DeploymentStep['status'] = 'pending';
      if (allDone) {
        status = 'completed';
      } else if (i < currentIdx) {
        status = 'completed';
      } else if (i === currentIdx) {
        status = errorMsg ? 'error' : 'running';
      }
      return { ...s, status, errorMessage: i === currentIdx ? errorMsg : undefined };
    });
  }

  private mapStatus(apiStatus: string): DeploymentProgress['status'] {
    if (apiStatus === 'COMPLETED' || apiStatus === 'completed') return 'completed';
    if (apiStatus === 'FAILED' || apiStatus === 'failed') return 'failed';
    if (apiStatus === 'IN_PROGRESS' || apiStatus === 'in_progress') return 'in_progress';
    return 'pending';
  }

  startElapsedTimer(): void {
    this.elapsedIntervalId = setInterval(() => {
      const deployment = this.progress();
      if (deployment?.startedAt) {
        const elapsed = Math.floor(
          (Date.now() - new Date(deployment.startedAt).getTime()) / 1000
        );
        this.elapsedTime.set(this.formatDuration(elapsed));
      }
    }, 1000);
  }

  getElapsedTime(startedAt: Date): string {
    const elapsed = Math.floor(
      (Date.now() - new Date(startedAt).getTime()) / 1000
    );
    return this.formatDuration(elapsed);
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      failed: 'Failed',
    };
    return labels[status] || status;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'completed': return 'badge badge-success';
      case 'in_progress': return 'badge badge-in-progress';
      case 'failed': return 'badge badge-error';
      default: return 'badge badge-pending';
    }
  }

  getProgressBarClass(status: string): string {
    switch (status) {
      case 'completed': return 'bg-green-500 dark:bg-green-600';
      case 'failed': return 'bg-destructive';
      default: return 'bg-muted-foreground';
    }
  }

  getStepIconClass(status: string): string {
    switch (status) {
      case 'completed': return 'step-icon step-icon-completed';
      case 'running': return 'step-icon step-icon-running';
      case 'error': return 'step-icon step-icon-error';
      default: return 'step-icon step-icon-pending';
    }
  }

  getStepTitleClass(status: string): string {
    const baseClass = 'text-sm font-medium';

    switch (status) {
      case 'completed':
        return `${baseClass} text-foreground`;
      case 'running':
        return `${baseClass} text-primary`;
      case 'error':
        return `${baseClass} text-red-600 dark:text-red-400`;
      default:
        return `${baseClass} text-muted-foreground`;
    }
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
