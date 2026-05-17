import { Injectable, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { AppRuntimeWebSocketService } from '../../features/service/app-runtime-websocket.service';
import { ClusterIssuerWebSocketService } from '../../features/service/cluster-issuer-websocket.service';
import { UserEventsService } from './user-events.service';
import { AuthService } from './auth.service';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationSource = 'manual' | 'websocket' | 'system';

// Typed categories — add new ones here as needed
export type NotificationCategory =
  | 'cert-setup'
  | 'deployment'
  | 'rollout'
  | 'ssl-issuer'
  | 'app-delete'
  | 'app-deploy'
  | 'crash-diagnosis'
  | 'auto-remediation'
  | 'cluster-scaling'
  | 'snapshot'
  | 'backup'
  | 'general';

export interface NotificationLink {
  label: string;
  route: string;
}

export interface NotificationAction {
  label: string;
  key: string; // matches a registered action handler
}

export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  link?: NotificationLink;
  action?: NotificationAction;
  category?: NotificationCategory;
  ttl?: number | null;
  type: NotificationType;
  read: boolean;
  createdAt: Date;
  source: NotificationSource;
}

const STORAGE_KEY = 'flui-notifications';
const MAX_NOTIFICATIONS = 50;
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000;
const WEBSOCKET_TTL = 24 * 60 * 60 * 1000; // 24h — cluster/app IDs become stale after recreation

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private readonly runtimeWs = inject(AppRuntimeWebSocketService);
  private readonly issuerWs = inject(ClusterIssuerWebSocketService);
  private readonly userEvents = inject(UserEventsService);
  private readonly authService = inject(AuthService);

  private readonly _notifications = signal<AppNotification[]>(this.loadFromStorage());
  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter(n => !n.read).length);
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  // Action registry: key → handler fn
  private readonly actionHandlers = new Map<string, () => void>();

  private readonly cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.applyTtlFilter();

    // Persist to localStorage on every change
    effect(() => {
      const data = this._notifications();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    });

    // Periodic TTL cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.applyTtlFilter(), 5 * 60_000);
  }

  bootstrapWebSocketListeners(): void {
    this.runtimeWs.onGlobalBuildCompleted(e => {
      const appName = this.runtimeWs.getAppName(e.appId);
      this.add({
        title: appName ? `${appName}: build completed` : 'Build completed',
        body: `Image: ${e.imageRef}`,
        link: { label: 'View application', route: `/apps/applications/${e.appId}` },
        type: 'success',
        source: 'websocket',
        category: 'deployment',
      });
    });

    this.runtimeWs.onGlobalBuildFailed(e => {
      const appName = this.runtimeWs.getAppName(e.appId);
      this.add({
        title: appName ? `${appName}: build failed` : 'Build failed',
        body: e.error,
        link: { label: 'View application', route: `/apps/applications/${e.appId}` },
        type: 'error',
        source: 'websocket',
        category: 'deployment',
      });
    });

    this.runtimeWs.onGlobalCompleted(e => {
      const appName = this.runtimeWs.getAppName(e.appId) ?? e.runtimeSnapshot?.deploymentName;
      this.add({
        title: appName ? `${appName}: rollout completed` : 'Application rollout completed',
        body: `Operation: ${e.operation}`,
        link: { label: 'View application', route: `/apps/applications/${e.appId}` },
        type: 'success',
        source: 'websocket',
        category: 'rollout',
      });
    });

    this.runtimeWs.onGlobalFailed(e => {
      const appName = this.runtimeWs.getAppName(e.appId);
      this.add({
        title: appName ? `${appName}: rollout failed` : 'Application rollout failed',
        body: e.error,
        link: { label: 'View application', route: `/apps/applications/${e.appId}` },
        type: 'error',
        source: 'websocket',
        category: 'rollout',
      });
    });

    this.issuerWs.onGlobalConfigured(e => {
      this.add({
        title: 'SSL issuer configured',
        body: `${e.issuers.length} issuer(s) ready`,
        link: { label: 'View cluster', route: `/cluster/${e.clusterId}/dns` },
        type: 'success',
        source: 'websocket',
        category: 'ssl-issuer',
      });
    });

    this.issuerWs.onGlobalFailed(e => {
      this.add({
        title: 'SSL issuer configuration failed',
        body: e.error,
        link: { label: 'View cluster', route: `/cluster/${e.clusterId}/dns` },
        type: 'error',
        source: 'websocket',
        category: 'ssl-issuer',
      });
    });

    this.runtimeWs.onGlobalOperationCompleted(e => this.handleOperationCompleted(e));
    this.runtimeWs.onGlobalOperationFailed(e => this.handleOperationFailed(e));

    this.runtimeWs.onGlobalAutoRemediation(e => {
      const appName = this.runtimeWs.getAppName(e.appId);
      const prefix = appName ? `${appName}: ` : '';
      this.add({
        title: `${prefix}Memory increased automatically`,
        body: `Flui raised the memory limit from ${e.previousMemoryLimit} to ${e.newMemoryLimit} to recover from the crash. Redeploy in progress.`,
        link: {
          label: 'Open diagnosis',
          route: `/apps/applications/${e.appId}/diagnoses`,
        },
        type: 'info',
        source: 'websocket',
        category: 'auto-remediation',
      });
    });

    this.runtimeWs.onGlobalDiagnosis(e => {
      const appName = this.runtimeWs.getAppName(e.applicationId);
      const prefix = appName ? `${appName}: ` : '';
      const body = e.explanation && e.explanation.length > 220
        ? e.explanation.slice(0, 220).trimEnd() + '…'
        : e.explanation;
      let notificationType: 'error' | 'warning' | 'info';
      if (e.severity === 'critical') notificationType = 'error';
      else if (e.severity === 'warning') notificationType = 'warning';
      else notificationType = 'info';
      this.add({
        title: `${prefix}${e.title}`,
        body,
        link: {
          label: 'Open diagnosis',
          route: `/apps/applications/${e.applicationId}/diagnoses`,
        },
        type: notificationType,
        source: 'websocket',
        category: 'crash-diagnosis',
      });
    });

    this.bootstrapUserEvents();
  }

  /**
   * Connects the per-user WebSocket channel (when an authenticated user is
   * available) and surfaces user-scoped events as toasts. Currently covers
   * the post-callback `github:connected` event from the GitHub App U2S flow.
   */
  private bootstrapUserEvents(): void {
    const user = this.authService.currentUser();
    if (!user?.userId) {
      // Not authenticated yet — UserEventsService will be connected on next
      // login via the AuthService; see effect in loadCurrentUser.
      return;
    }
    this.userEvents.connect(user.userId);
    this.userEvents.onGithubConnected((payload) => {
      this.add({
        title: 'GitHub connected',
        body: `Authorized as @${payload.githubLogin}`,
        link: { label: 'Go to repositories', route: '/apps/repositories' },
        type: 'success',
        source: 'websocket',
        category: 'general',
      });
    });
  }

  // ── Action registry ───────────────────────────────────────

  registerAction(key: string, handler: () => void): void {
    this.actionHandlers.set(key, handler);
  }

  unregisterAction(key: string): void {
    this.actionHandlers.delete(key);
  }

  triggerAction(key: string): void {
    this.actionHandlers.get(key)?.();
  }

  // ── Category helpers ──────────────────────────────────────

  hasCategory(category: NotificationCategory): boolean {
    return this._notifications().some(n => n.category === category);
  }

  removeByCategory(category: NotificationCategory): void {
    this._notifications.update(current => current.filter(n => n.category !== category));
  }

  // ── CRUD ──────────────────────────────────────────────────

  add(partial: Omit<AppNotification, 'id' | 'read' | 'createdAt'> & { type?: NotificationType }): void {
    const defaultTtl = partial.source === 'websocket' ? WEBSOCKET_TTL : DEFAULT_TTL;
    const notification: AppNotification = {
      ...{ type: 'info' as NotificationType, source: 'system' as NotificationSource, ttl: defaultTtl },
      ...partial,
      id: this.generateId(),
      read: false,
      createdAt: new Date(),
    };

    this._notifications.update(current => {
      const updated = [notification, ...current];
      return updated.slice(0, MAX_NOTIFICATIONS);
    });
  }

  markRead(id: string): void {
    this._notifications.update(current =>
      current.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }

  markAllRead(): void {
    this._notifications.update(current => current.map(n => ({ ...n, read: true })));
  }

  remove(id: string): void {
    this._notifications.update(current => current.filter(n => n.id !== id));
  }

  clear(): void {
    this._notifications.set([]);
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private loadFromStorage(): AppNotification[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: AppNotification[] = JSON.parse(raw).map((n: AppNotification & { createdAt: string }) => ({
        ...n,
        createdAt: new Date(n.createdAt),
      }));
      return this.filterExpired(parsed);
    } catch {
      return [];
    }
  }

  private applyTtlFilter(): void {
    this._notifications.update(current => this.filterExpired(current));
  }

  private filterExpired(notifications: AppNotification[]): AppNotification[] {
    const now = Date.now();
    return notifications.filter(n => {
      if (n.ttl === null) return true;
      const ttl = n.ttl ?? DEFAULT_TTL;
      return now - n.createdAt.getTime() < ttl;
    });
  }

  ngOnDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private handleOperationCompleted(e: {
    appId: string;
    operationType: string;
    imageRef?: string;
    revisionNumber?: number;
  }): void {
    if (e.operationType === 'deploy' && this.runtimeWs.hasRecentAutoRemediation(e.appId)) {
      return;
    }
    const spec = this.buildCompletedSpec(e);
    if (!spec) return;
    this.add({ ...spec, type: 'success', source: 'websocket' });
  }

  private buildCompletedSpec(e: {
    appId: string;
    operationType: string;
    imageRef?: string;
    revisionNumber?: number;
  }): { title: string; body?: string; link: NotificationLink; category: NotificationCategory } | null {
    const appName = this.runtimeWs.getAppName(e.appId);
    const appLink: NotificationLink = {
      label: 'View application',
      route: `/apps/applications/${e.appId}`,
    };
    return (
      this.deleteCompletedSpec(e.operationType, appName) ??
      this.deployOrRollbackCompletedSpec(e, appName, appLink) ??
      this.snapshotCompletedSpec(e.operationType, appName, appLink) ??
      this.backupCompletedSpec(e.operationType, appName, appLink)
    );
  }

  private deleteCompletedSpec(
    operationType: string,
    appName: string | undefined,
  ): { title: string; body?: string; link: NotificationLink; category: NotificationCategory } | null {
    if (operationType !== 'delete_application' && operationType !== 'delete') return null;
    return {
      title: appName ? `${appName} deleted successfully` : 'Application deleted successfully',
      body: 'The application and all its resources have been removed.',
      link: { label: 'View applications', route: '/apps/applications' },
      category: 'app-delete',
    };
  }

  private deployOrRollbackCompletedSpec(
    e: { operationType: string; imageRef?: string; revisionNumber?: number },
    appName: string | undefined,
    appLink: NotificationLink,
  ): { title: string; body?: string; link: NotificationLink; category: NotificationCategory } | null {
    if (e.operationType === 'deploy') {
      return {
        title: appName ? `${appName} deployed successfully` : 'Application deployed successfully',
        body: e.imageRef ? `Image: ${e.imageRef}` : undefined,
        link: appLink,
        category: 'app-deploy',
      };
    }
    if (e.operationType === 'rollback') {
      const hasRevision = e.revisionNumber != null;
      return {
        title: appName ? `${appName} rolled back` : 'Application rolled back',
        body: hasRevision ? `Restored to revision ${e.revisionNumber}` : undefined,
        link: appLink,
        category: 'app-deploy',
      };
    }
    return null;
  }

  private backupCompletedSpec(
    operationType: string,
    appName: string | undefined,
    appLink: NotificationLink,
  ): { title: string; body?: string; link: NotificationLink; category: NotificationCategory } | null {
    if (operationType !== 'app_backup_create') return null;
    return {
      title: appName ? `${appName}: backup completed` : 'Backup completed',
      body: 'PVC contents archived to object storage.',
      link: appLink,
      category: 'backup',
    };
  }

  private snapshotCompletedSpec(
    operationType: string,
    appName: string | undefined,
    appLink: NotificationLink,
  ): { title: string; body?: string; link: NotificationLink; category: NotificationCategory } | null {
    if (operationType === 'app_snapshot_create') {
      return {
        title: appName ? `${appName}: snapshot created` : 'Snapshot created',
        link: appLink,
        category: 'snapshot',
      };
    }
    if (operationType === 'app_snapshot_delete') {
      return {
        title: appName ? `${appName}: snapshot deleted` : 'Snapshot deleted',
        link: appLink,
        category: 'snapshot',
      };
    }
    if (operationType === 'app_snapshot_restore') {
      return {
        title: appName ? `${appName}: snapshot restored` : 'Snapshot restored',
        body: 'New side-by-side PVC ready. Swap when you want to switch the live app to the restored data.',
        link: appLink,
        category: 'snapshot',
      };
    }
    if (operationType === 'app_volume_swap') {
      return {
        title: appName ? `${appName}: volume swapped` : 'Volume swapped',
        body: 'Rolling restart in progress, the new PVC is now mounted.',
        link: appLink,
        category: 'snapshot',
      };
    }
    return null;
  }

  private handleOperationFailed(e: { appId: string; operationType: string; error: string }): void {
    const spec = this.buildFailedSpec(e);
    if (!spec) return;
    this.add({ ...spec, type: 'error', source: 'websocket' });
  }

  private buildFailedSpec(e: {
    appId: string;
    operationType: string;
    error: string;
  }): { title: string; body?: string; link: NotificationLink; category: NotificationCategory } | null {
    const appName = this.runtimeWs.getAppName(e.appId);
    const appLink: NotificationLink = {
      label: 'View application',
      route: `/apps/applications/${e.appId}`,
    };
    return (
      this.deleteFailedSpec(e.operationType, e.error, appName) ??
      this.deployOrRollbackFailedSpec(e.operationType, e.error, appName, appLink) ??
      this.snapshotFailedSpec(e.operationType, e.error, appName, appLink) ??
      this.backupFailedSpec(e.operationType, e.error, appName, appLink)
    );
  }

  private deleteFailedSpec(
    operationType: string,
    error: string,
    appName: string | undefined,
  ): { title: string; body?: string; link: NotificationLink; category: NotificationCategory } | null {
    if (operationType !== 'delete_application' && operationType !== 'delete') return null;
    return {
      title: appName ? `${appName} deletion failed` : 'Application deletion failed',
      body: error || 'An error occurred while removing the application.',
      link: { label: 'View applications', route: '/apps/applications' },
      category: 'app-delete',
    };
  }

  private deployOrRollbackFailedSpec(
    operationType: string,
    error: string,
    appName: string | undefined,
    appLink: NotificationLink,
  ): { title: string; body?: string; link: NotificationLink; category: NotificationCategory } | null {
    if (operationType === 'deploy') {
      return {
        title: appName ? `${appName}: deploy failed` : 'Deploy failed',
        body: error,
        link: appLink,
        category: 'app-deploy',
      };
    }
    if (operationType === 'rollback') {
      return {
        title: appName ? `${appName}: rollback failed` : 'Rollback failed',
        body: error,
        link: appLink,
        category: 'app-deploy',
      };
    }
    return null;
  }

  private snapshotFailedSpec(
    operationType: string,
    error: string,
    appName: string | undefined,
    appLink: NotificationLink,
  ): { title: string; body?: string; link: NotificationLink; category: NotificationCategory } | null {
    if (operationType?.startsWith('app_snapshot_')) {
      return {
        title: appName ? `${appName}: snapshot operation failed` : 'Snapshot operation failed',
        body: error,
        link: appLink,
        category: 'snapshot',
      };
    }
    if (operationType === 'app_volume_swap') {
      return {
        title: appName ? `${appName}: volume swap failed` : 'Volume swap failed',
        body: error,
        link: appLink,
        category: 'snapshot',
      };
    }
    return null;
  }

  private backupFailedSpec(
    operationType: string,
    error: string,
    appName: string | undefined,
    appLink: NotificationLink,
  ): { title: string; body?: string; link: NotificationLink; category: NotificationCategory } | null {
    if (operationType !== 'app_backup_create') return null;
    return {
      title: appName ? `${appName}: backup failed` : 'Backup failed',
      body: error,
      link: appLink,
      category: 'backup',
    };
  }
}
