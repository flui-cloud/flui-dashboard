import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AppConfigService } from '../../core/services/app-config.service';
import { WebSocketAuthService } from '../../core/services/websocket-auth.service';
import { ClusterDnsZoneControllerGetIssuers200ResponseInner } from '../../core/api/model/clusterDnsZoneControllerGetIssuers200ResponseInner';

export interface IssuerStatusEvent {
  clusterId: string;
  issuers: ClusterDnsZoneControllerGetIssuers200ResponseInner[];
}

export interface IssuerConfiguredEvent {
  clusterId: string;
  issuers: ClusterDnsZoneControllerGetIssuers200ResponseInner[];
}

export interface IssuerFailedEvent {
  clusterId: string;
  error: string;
}

@Injectable({ providedIn: 'root' })
export class ClusterIssuerWebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly subscribedClusters = new Set<string>();
  private readonly appConfig = inject(AppConfigService);
  private readonly wsAuth = inject(WebSocketAuthService);

  private readonly isConnectedSignal = signal(false);
  readonly isConnected = this.isConnectedSignal.asReadonly();

  // Per-cluster callbacks
  private readonly statusCallbacks = new Map<string, (e: IssuerStatusEvent) => void>();
  private readonly configuredCallbacks = new Map<string, (e: IssuerConfiguredEvent) => void>();
  private readonly failedCallbacks = new Map<string, (e: IssuerFailedEvent) => void>();

  // Global callbacks (fire for any clusterId)
  private readonly globalConfiguredCbs: ((e: IssuerConfiguredEvent) => void)[] = [];
  private readonly globalFailedCbsGlobal: ((e: IssuerFailedEvent) => void)[] = [];

  onGlobalConfigured(cb: (e: IssuerConfiguredEvent) => void): void {
    this.globalConfiguredCbs.push(cb);
  }

  onGlobalFailed(cb: (e: IssuerFailedEvent) => void): void {
    this.globalFailedCbsGlobal.push(cb);
  }

  private ensureConnected(): void {
    if (this.socket?.connected) return;

    const wsUrl = this.appConfig.wsUrl || globalThis.window.location.origin;
    this.socket = io(`${wsUrl}/clusters`, {
      ...this.wsAuth.authOptions(),
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    this.wsAuth.attach(this.socket);

    this.socket.on('connect', () => this.isConnectedSignal.set(true));
    this.socket.on('disconnect', () => this.isConnectedSignal.set(false));
    this.socket.on('connect_error', () => this.isConnectedSignal.set(false));

    this.socket.on('cluster:issuer:status', (data: IssuerStatusEvent) => {
      this.statusCallbacks.get(data.clusterId)?.(data);
    });

    this.socket.on('cluster:issuer:configured', (data: IssuerConfiguredEvent) => {
      this.configuredCallbacks.get(data.clusterId)?.(data);
      this.globalConfiguredCbs.forEach(cb => cb(data));
    });

    this.socket.on('cluster:issuer:failed', (data: IssuerFailedEvent) => {
      this.failedCallbacks.get(data.clusterId)?.(data);
      this.globalFailedCbsGlobal.forEach(cb => cb(data));
    });
  }

  subscribeToCluster(
    clusterId: string,
    callbacks: {
      onStatus: (e: IssuerStatusEvent) => void;
      onConfigured: (e: IssuerConfiguredEvent) => void;
      onFailed: (e: IssuerFailedEvent) => void;
    }
  ): void {
    this.ensureConnected();

    this.statusCallbacks.set(clusterId, callbacks.onStatus);
    this.configuredCallbacks.set(clusterId, callbacks.onConfigured);
    this.failedCallbacks.set(clusterId, callbacks.onFailed);

    if (this.socket?.connected) {
      this.socket.emit('subscribe:cluster', { clusterId });
      this.subscribedClusters.add(clusterId);
    } else {
      this.socket?.once('connect', () => {
        this.socket?.emit('subscribe:cluster', { clusterId });
        this.subscribedClusters.add(clusterId);
      });
    }
  }

  unsubscribeFromCluster(clusterId: string): void {
    if (!this.subscribedClusters.has(clusterId)) return;
    this.socket?.emit('unsubscribe:cluster', { clusterId });
    this.subscribedClusters.delete(clusterId);
    this.statusCallbacks.delete(clusterId);
    this.configuredCallbacks.delete(clusterId);
    this.failedCallbacks.delete(clusterId);
  }

  ngOnDestroy(): void {
    this.subscribedClusters.forEach(id => this.unsubscribeFromCluster(id));
    this.socket?.disconnect();
    this.socket = null;
  }
}
