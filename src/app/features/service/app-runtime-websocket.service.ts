import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AppConfigService } from '../../core/services/app-config.service';
import { WebSocketAuthService } from '../../core/services/websocket-auth.service';
import { AppRuntimeResponseDto } from '../../core/api/model/appRuntimeResponseDto';
import { CrashDiagnosis, AutoRemediationPayload } from '../model/crash-diagnosis.models';

export type CrashDiagnosisEvent = CrashDiagnosis;
export type AutoRemediationEvent = AutoRemediationPayload;

export interface RolloutProgressEvent {
  appId: string;
  operation: string;
  percentage: number;
  readyReplicas: number;
  desiredReplicas: number;
  message: string;
  timestamp: string;
}

export interface RolloutCompletedEvent {
  appId: string;
  operation: string;
  duration: number;
  runtimeSnapshot: AppRuntimeResponseDto;
  timestamp: string;
}

export interface RolloutFailedEvent {
  appId: string;
  operation: string;
  error: string;
  timestamp: string;
}

export interface OperationProgressEvent {
  appId: string;
  operationId: string;
  operationType: string;
  percentage: number;
  currentStep: number;
  totalSteps: number;
  message: string;
  timestamp: string;
}

export interface OperationCompletedEvent {
  appId: string;
  operationId: string;
  operationType: string;
  duration: number;
  applicationStatus?: string;
  revisionNumber?: number;
  imageRef?: string;
  digest?: string | null;
  timestamp: string;
}

export interface OperationFailedEvent {
  appId: string;
  operationId: string;
  operationType: string;
  error: string;
  attempt: number;
  timestamp: string;
}

export interface ReleaseStatusChangedEvent {
  appId: string;
  operationId: string;
  status: 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'ROLLED_BACK';
  imageRef?: string | null;
  previousImageRef?: string | null;
  buildId?: string | null;
  failureReason?: string | null;
  timestamp: string;
}

export interface BuildStartedEvent {
  appId: string;
  buildId: string;
  operationId: string;
  branch: string;
  commitSha?: string;
  timestamp: string;
}

export interface BuildLogEvent {
  appId: string;
  buildId: string;
  line: string;
  stream: 'stdout' | 'stderr';
  timestamp: string;
}

export interface BuildPlanEvent {
  appId: string;
  buildId: string;
  framework: string;
  buildCommand: string;
  startCommand: string;
  raw: object;
  timestamp: string;
}

export interface BuildCompletedEvent {
  appId: string;
  buildId: string;
  imageRef: string;
  duration: number;
  deployOperationId?: string;
  timestamp: string;
}

// Standalone build events (pre-app, keyed by buildId only)
export interface StandaloneBuildPlanEvent {
  buildId: string;
  suggestedName?: string;
  framework?: string;
  port?: number;
  buildCommand?: string;
  startCommand?: string;
  detectedStartCommand?: string;
  raw?: object;
  timestamp: string;
}

export interface StandaloneBuildCompletedEvent {
  buildId: string;
  imageRef: string;
  suggestedName?: string;
  duration: number;
  timestamp: string;
}

export interface StandaloneBuildFailedEvent {
  buildId: string;
  error: string;
  attempt: number;
  timestamp: string;
}

export interface BuildFailedEvent {
  appId: string;
  buildId: string;
  operationId: string;
  error: string;
  attempt: number;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class AppRuntimeWebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly subscribedApps = new Set<string>();
  private readonly appConfig = inject(AppConfigService);
  private readonly wsAuth = inject(WebSocketAuthService);

  private readonly isConnectedSignal = signal(false);
  readonly isConnected = this.isConnectedSignal.asReadonly();

  // Per-app callbacks
  private readonly progressCallbacks = new Map<string, (e: RolloutProgressEvent) => void>();
  private readonly completedCallbacks = new Map<string, (e: RolloutCompletedEvent) => void>();
  private readonly failedCallbacks = new Map<string, (e: RolloutFailedEvent) => void>();

  // Per-app operation callbacks
  private readonly opProgressCallbacks = new Map<string, (e: OperationProgressEvent) => void>();
  private readonly opCompletedCallbacks = new Map<string, (e: OperationCompletedEvent) => void>();
  private readonly opFailedCallbacks = new Map<string, (e: OperationFailedEvent) => void>();

  // Per-app release callbacks
  private readonly releaseStatusCallbacks = new Map<string, (e: ReleaseStatusChangedEvent) => void>();

  // Per-app build callbacks
  private readonly buildStartedCbs = new Map<string, (e: BuildStartedEvent) => void>();
  private readonly buildLogCbs = new Map<string, (e: BuildLogEvent) => void>();
  private readonly buildPlanCbs = new Map<string, (e: BuildPlanEvent) => void>();
  private readonly buildCompletedCbs = new Map<string, (e: BuildCompletedEvent) => void>();
  private readonly buildFailedCbs = new Map<string, (e: BuildFailedEvent) => void>();
  private readonly buildHeartbeatCbs = new Map<string, (appId: string) => void>();

  // Per-app reconnect callbacks
  private readonly reconnectCbs = new Map<string, () => void>();

  // Per-app crash diagnosis callbacks
  private readonly diagnosisCallbacks = new Map<string, (e: CrashDiagnosisEvent) => void>();

  // Per-app auto-remediation callbacks (phase 3)
  private readonly autoRemediationCallbacks = new Map<string, (e: AutoRemediationEvent) => void>();

  // Recent auto-remediation timestamps per appId. Used by notification service
  // to suppress redundant "deploy started/succeeded" toasts that are triggered
  // by the Actuator rather than by the user.
  private readonly recentAutoRemediations = new Map<string, number>();
  private readonly AUTO_REMEDIATION_WINDOW_MS = 2 * 60_000;

  // Standalone build callbacks (keyed by buildId, not appId)
  private readonly subscribedBuilds = new Set<string>();
  private readonly standaloneBuildLogCbs  = new Map<string, (e: BuildLogEvent) => void>();
  private readonly standaloneBuildPlanCbs = new Map<string, (e: StandaloneBuildPlanEvent) => void>();
  private readonly standaloneBuildCompCbs = new Map<string, (e: StandaloneBuildCompletedEvent) => void>();
  private readonly standaloneBuildFailCbs = new Map<string, (e: StandaloneBuildFailedEvent) => void>();
  private readonly standaloneBuildHbCbs   = new Map<string, (buildId: string) => void>();
  private readonly standaloneBuildReconnectCbs = new Map<string, () => void>();

  // Global callbacks (fire for any appId)
  private readonly globalCompletedCbs: ((e: RolloutCompletedEvent) => void)[] = [];
  private readonly globalFailedCbs: ((e: RolloutFailedEvent) => void)[] = [];
  private readonly globalOpProgressCbs: ((e: OperationProgressEvent) => void)[] = [];
  private readonly globalOpCompletedCbs: ((e: OperationCompletedEvent) => void)[] = [];
  private readonly globalOpFailedCbs: ((e: OperationFailedEvent) => void)[] = [];
  private readonly globalReleaseStatusCbs: ((e: ReleaseStatusChangedEvent) => void)[] = [];
  private readonly globalBuildCompletedCbs: ((e: BuildCompletedEvent) => void)[] = [];
  private readonly globalBuildFailedCbs: ((e: BuildFailedEvent) => void)[] = [];
  private readonly globalDiagnosisCbs: ((e: CrashDiagnosisEvent) => void)[] = [];
  private readonly globalAutoRemediationCbs: ((e: AutoRemediationEvent) => void)[] = [];

  // App name registry: populated externally so notifications can show the app name
  private readonly appNameRegistry = new Map<string, string>();

  registerAppName(appId: string, name: string): void {
    this.appNameRegistry.set(appId, name);
  }

  getAppName(appId: string): string | undefined {
    return this.appNameRegistry.get(appId);
  }

  onGlobalCompleted(cb: (e: RolloutCompletedEvent) => void): void {
    this.globalCompletedCbs.push(cb);
  }

  onGlobalFailed(cb: (e: RolloutFailedEvent) => void): void {
    this.globalFailedCbs.push(cb);
  }

  onGlobalOperationProgress(cb: (e: OperationProgressEvent) => void): void {
    this.globalOpProgressCbs.push(cb);
  }

  onGlobalOperationCompleted(cb: (e: OperationCompletedEvent) => void): void {
    this.globalOpCompletedCbs.push(cb);
  }

  onGlobalOperationFailed(cb: (e: OperationFailedEvent) => void): void {
    this.globalOpFailedCbs.push(cb);
  }

  onGlobalReleaseStatus(cb: (e: ReleaseStatusChangedEvent) => void): void {
    this.globalReleaseStatusCbs.push(cb);
  }

  onReleaseStatus(appId: string, cb: (e: ReleaseStatusChangedEvent) => void): void {
    this.releaseStatusCallbacks.set(appId, cb);
  }

  onGlobalBuildCompleted(cb: (e: BuildCompletedEvent) => void): void {
    this.globalBuildCompletedCbs.push(cb);
  }

  onGlobalBuildFailed(cb: (e: BuildFailedEvent) => void): void {
    this.globalBuildFailedCbs.push(cb);
  }

  onDiagnosis(appId: string, cb: (e: CrashDiagnosisEvent) => void): void {
    this.diagnosisCallbacks.set(appId, cb);
  }

  onGlobalDiagnosis(cb: (e: CrashDiagnosisEvent) => void): void {
    this.globalDiagnosisCbs.push(cb);
  }

  onAutoRemediation(appId: string, cb: (e: AutoRemediationEvent) => void): void {
    this.autoRemediationCallbacks.set(appId, cb);
  }

  onGlobalAutoRemediation(cb: (e: AutoRemediationEvent) => void): void {
    this.globalAutoRemediationCbs.push(cb);
  }

  /** True if an auto-remediation event was received for appId in the last ~2 minutes. */
  hasRecentAutoRemediation(appId: string): boolean {
    const ts = this.recentAutoRemediations.get(appId);
    if (!ts) return false;
    return Date.now() - ts < this.AUTO_REMEDIATION_WINDOW_MS;
  }

  private ensureConnected(): void {
    if (this.socket) return;

    let wsUrl = this.appConfig.wsUrl || globalThis.window.location.origin;
    // Normalize ws:// → http://, wss:// → https://
    wsUrl = wsUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
    // Enforce HTTPS when the page is served over HTTPS (prevents Mixed Content errors)
    if (globalThis.window.location.protocol === 'https:') {
      wsUrl = wsUrl.replace(/^http:\/\//, 'https://');
    }
    this.socket = io(`${wsUrl}/applications`, {
      ...this.wsAuth.authOptions(),
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    this.wsAuth.attach(this.socket);

    this.socket.on('connect', () => {
      this.isConnectedSignal.set(true);
      // Re-subscribe all apps and fire reconnect callbacks
      this.subscribedApps.forEach(appId => {
        this.socket?.emit('subscribe:application', { appId });
        this.reconnectCbs.get(appId)?.();
      });
      // Re-subscribe all standalone builds
      this.subscribedBuilds.forEach(buildId => {
        this.socket?.emit('subscribe:build', { buildId });
        this.standaloneBuildReconnectCbs.get(buildId)?.();
      });
    });
    this.socket.on('disconnect', () => {
      this.isConnectedSignal.set(false);
    });
    this.socket.on('connect_error', () => {
      this.isConnectedSignal.set(false);
    });
    this.socket.on('error', () => {
      this.isConnectedSignal.set(false);
    });

    this.socket.on('application:rollout:progress', (data: RolloutProgressEvent) => {
      this.progressCallbacks.get(data.appId)?.(data);
    });

    this.socket.on('application:rollout:completed', (data: RolloutCompletedEvent) => {
      this.completedCallbacks.get(data.appId)?.(data);
      this.globalCompletedCbs.forEach(cb => cb(data));
    });

    this.socket.on('application:rollout:failed', (data: RolloutFailedEvent) => {
      this.failedCallbacks.get(data.appId)?.(data);
      this.globalFailedCbs.forEach(cb => cb(data));
    });

    this.socket.on('application:operation:progress', (data: OperationProgressEvent) => {
      this.opProgressCallbacks.get(data.appId)?.(data);
      this.globalOpProgressCbs.forEach(cb => cb(data));
    });

    this.socket.on('application:operation:completed', (data: OperationCompletedEvent) => {
      this.opCompletedCallbacks.get(data.appId)?.(data);
      this.globalOpCompletedCbs.forEach(cb => cb(data));
    });

    this.socket.on('application:operation:failed', (data: OperationFailedEvent) => {
      this.opFailedCallbacks.get(data.appId)?.(data);
      this.globalOpFailedCbs.forEach(cb => cb(data));
    });

    this.socket.on('application:release:status', (data: ReleaseStatusChangedEvent) => {
      this.releaseStatusCallbacks.get(data.appId)?.(data);
      this.globalReleaseStatusCbs.forEach(cb => cb(data));
    });

    this.socket.on('application:build:started',   (d: BuildStartedEvent)   => {
      this.buildStartedCbs.get(d.appId)?.(d);
    });
    this.socket.on('application:build:log', (d: BuildLogEvent) => {
      this.buildLogCbs.get(d.appId)?.(d);
    });
    this.socket.on('application:build:plan',      (d: BuildPlanEvent)      => this.buildPlanCbs.get(d.appId)?.(d));
    this.socket.on('application:build:heartbeat', (d: { appId: string })   => {
      this.buildHeartbeatCbs.get(d.appId)?.(d.appId);
    });
    this.socket.on('application:build:completed', (d: BuildCompletedEvent) => {
      this.buildCompletedCbs.get(d.appId)?.(d);
      this.globalBuildCompletedCbs.forEach(cb => cb(d));
    });
    this.socket.on('application:build:failed', (d: BuildFailedEvent) => {
      this.buildFailedCbs.get(d.appId)?.(d);
      this.globalBuildFailedCbs.forEach(cb => cb(d));
    });

    this.socket.on('application:crash-diagnosis', (d: CrashDiagnosisEvent) => {
      this.diagnosisCallbacks.get(d.applicationId)?.(d);
      this.globalDiagnosisCbs.forEach(cb => cb(d));
    });

    this.socket.on('application:auto-remediation', (d: AutoRemediationEvent) => {
      this.recentAutoRemediations.set(d.appId, Date.now());
      this.autoRemediationCallbacks.get(d.appId)?.(d);
      this.globalAutoRemediationCbs.forEach(cb => cb(d));
    });

    // Standalone build events (room: build:{buildId})
    this.socket.on('build:log', (d: BuildLogEvent) => {
      this.standaloneBuildLogCbs.get(d.buildId)?.(d);
    });
    this.socket.on('build:plan', (d: StandaloneBuildPlanEvent) => {
      this.standaloneBuildPlanCbs.get(d.buildId)?.(d);
    });
    this.socket.on('build:completed', (d: StandaloneBuildCompletedEvent) => {
      this.standaloneBuildCompCbs.get(d.buildId)?.(d);
    });
    this.socket.on('build:failed', (d: StandaloneBuildFailedEvent) => {
      this.standaloneBuildFailCbs.get(d.buildId)?.(d);
    });
    this.socket.on('build:heartbeat', (d: { buildId: string }) => {
      this.standaloneBuildHbCbs.get(d.buildId)?.(d.buildId);
    });
  }

  /**
   * Ensure the socket is subscribed to the given application's room so any
   * globally-registered or per-app handler (diagnoses, operations, etc.) can
   * receive events without triggering a deploy first.
   */
  ensureAppSubscription(appId: string): void {
    this.ensureConnected();
    if (this.subscribedApps.has(appId)) return;
    if (this.socket?.connected) {
      this.socket.emit('subscribe:application', { appId });
      this.subscribedApps.add(appId);
    } else {
      this.socket?.once('connect', () => {
        this.socket?.emit('subscribe:application', { appId });
        this.subscribedApps.add(appId);
      });
    }
  }

  subscribeToApp(
    appId: string,
    callbacks: {
      onProgress: (e: RolloutProgressEvent) => void;
      onCompleted: (e: RolloutCompletedEvent) => void;
      onFailed: (e: RolloutFailedEvent) => void;
    }
  ): void {
    this.ensureConnected();

    this.progressCallbacks.set(appId, callbacks.onProgress);
    this.completedCallbacks.set(appId, callbacks.onCompleted);
    this.failedCallbacks.set(appId, callbacks.onFailed);

    if (this.socket?.connected) {
      this.socket.emit('subscribe:application', { appId });
      this.subscribedApps.add(appId);
    } else {
      // Retry once connected
      this.socket?.once('connect', () => {
        this.socket?.emit('subscribe:application', { appId });
        this.subscribedApps.add(appId);
      });
    }
  }

  unsubscribeFromApp(appId: string): void {
    if (!this.subscribedApps.has(appId)) return;
    this.socket?.emit('unsubscribe:application', { appId });
    this.subscribedApps.delete(appId);
    this.progressCallbacks.delete(appId);
    this.completedCallbacks.delete(appId);
    this.failedCallbacks.delete(appId);
    this.opProgressCallbacks.delete(appId);
    this.opCompletedCallbacks.delete(appId);
    this.opFailedCallbacks.delete(appId);
    this.releaseStatusCallbacks.delete(appId);
    this.buildStartedCbs.delete(appId);
    this.buildLogCbs.delete(appId);
    this.buildPlanCbs.delete(appId);
    this.buildCompletedCbs.delete(appId);
    this.buildFailedCbs.delete(appId);
    this.buildHeartbeatCbs.delete(appId);
    this.reconnectCbs.delete(appId);
    this.diagnosisCallbacks.delete(appId);
    this.autoRemediationCallbacks.delete(appId);
  }

  subscribeToBuildEvents(
    appId: string,
    callbacks: {
      onStarted?: (e: BuildStartedEvent) => void;
      onLog?: (e: BuildLogEvent) => void;
      onPlan?: (e: BuildPlanEvent) => void;
      onCompleted?: (e: BuildCompletedEvent) => void;
      onFailed?: (e: BuildFailedEvent) => void;
      onHeartbeat?: (appId: string) => void;
      onReconnect?: () => void;
    }
  ): void {
    this.ensureConnected();
    if (callbacks.onStarted)   this.buildStartedCbs.set(appId, callbacks.onStarted);
    if (callbacks.onLog)       this.buildLogCbs.set(appId, callbacks.onLog);
    if (callbacks.onPlan)      this.buildPlanCbs.set(appId, callbacks.onPlan);
    if (callbacks.onCompleted) this.buildCompletedCbs.set(appId, callbacks.onCompleted);
    if (callbacks.onFailed)    this.buildFailedCbs.set(appId, callbacks.onFailed);
    if (callbacks.onHeartbeat) this.buildHeartbeatCbs.set(appId, callbacks.onHeartbeat);
    if (callbacks.onReconnect) this.reconnectCbs.set(appId, callbacks.onReconnect);

    if (!this.subscribedApps.has(appId)) {
      if (this.socket?.connected) {
        this.socket.emit('subscribe:application', { appId });
        this.subscribedApps.add(appId);
      } else {
        this.socket?.once('connect', () => {
          this.socket?.emit('subscribe:application', { appId });
          this.subscribedApps.add(appId);
        });
      }
    }
  }

  subscribeToOperationEvents(
    appId: string,
    callbacks: {
      onProgress: (e: OperationProgressEvent) => void;
      onCompleted: (e: OperationCompletedEvent) => void;
      onFailed: (e: OperationFailedEvent) => void;
    }
  ): void {
    this.ensureConnected();
    this.opProgressCallbacks.set(appId, callbacks.onProgress);
    this.opCompletedCallbacks.set(appId, callbacks.onCompleted);
    this.opFailedCallbacks.set(appId, callbacks.onFailed);

    if (!this.subscribedApps.has(appId)) {
      if (this.socket?.connected) {
        this.socket.emit('subscribe:application', { appId });
        this.subscribedApps.add(appId);
      } else {
        this.socket?.once('connect', () => {
          this.socket?.emit('subscribe:application', { appId });
          this.subscribedApps.add(appId);
        });
      }
    }
  }

  subscribeToStandaloneBuild(
    buildId: string,
    callbacks: {
      onLog?: (e: BuildLogEvent) => void;
      onPlan?: (e: StandaloneBuildPlanEvent) => void;
      onCompleted?: (e: StandaloneBuildCompletedEvent) => void;
      onFailed?: (e: StandaloneBuildFailedEvent) => void;
      onHeartbeat?: (buildId: string) => void;
      onReconnect?: () => void;
    }
  ): void {
    this.ensureConnected();
    if (callbacks.onLog)       this.standaloneBuildLogCbs.set(buildId, callbacks.onLog);
    if (callbacks.onPlan)      this.standaloneBuildPlanCbs.set(buildId, callbacks.onPlan);
    if (callbacks.onCompleted) this.standaloneBuildCompCbs.set(buildId, callbacks.onCompleted);
    if (callbacks.onFailed)    this.standaloneBuildFailCbs.set(buildId, callbacks.onFailed);
    if (callbacks.onHeartbeat) this.standaloneBuildHbCbs.set(buildId, callbacks.onHeartbeat);
    if (callbacks.onReconnect) this.standaloneBuildReconnectCbs.set(buildId, callbacks.onReconnect);

    if (!this.subscribedBuilds.has(buildId)) {
      if (this.socket?.connected) {
        this.socket.emit('subscribe:build', { buildId });
        this.subscribedBuilds.add(buildId);
      } else {
        this.socket?.once('connect', () => {
          this.socket?.emit('subscribe:build', { buildId });
          this.subscribedBuilds.add(buildId);
        });
      }
    }
  }

  unsubscribeFromStandaloneBuild(buildId: string): void {
    if (!this.subscribedBuilds.has(buildId)) return;
    this.socket?.emit('unsubscribe:build', { buildId });
    this.subscribedBuilds.delete(buildId);
    this.standaloneBuildLogCbs.delete(buildId);
    this.standaloneBuildPlanCbs.delete(buildId);
    this.standaloneBuildCompCbs.delete(buildId);
    this.standaloneBuildFailCbs.delete(buildId);
    this.standaloneBuildHbCbs.delete(buildId);
    this.standaloneBuildReconnectCbs.delete(buildId);
  }

  ngOnDestroy(): void {
    this.subscribedApps.forEach(id => this.unsubscribeFromApp(id));
    this.subscribedBuilds.forEach(id => this.unsubscribeFromStandaloneBuild(id));
    this.socket?.disconnect();
    this.socket = null;
  }
}
