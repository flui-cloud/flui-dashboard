import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AppConfigService } from './app-config.service';
import { WebSocketAuthService } from './websocket-auth.service';

export interface GithubConnectedEvent {
  githubLogin: string;
  installationId: string | null;
}

/**
 * WebSocket client for the `/user` gateway. Lets the dashboard receive events
 * scoped to the current Flui user (e.g. after the GitHub App install/authorize
 * callback lands on the backend).
 */
@Injectable({ providedIn: 'root' })
export class UserEventsService implements OnDestroy {
  private readonly appConfig = inject(AppConfigService);
  private readonly wsAuth = inject(WebSocketAuthService);
  private socket: Socket | null = null;
  private subscribedUserId: string | null = null;

  private readonly connectedSignal = signal(false);
  readonly isConnected = this.connectedSignal.asReadonly();

  private githubConnectedListeners: Array<(e: GithubConnectedEvent) => void> =
    [];

  connect(userId: string): void {
    if (this.socket && this.subscribedUserId === userId) return;
    if (this.socket) this.disconnect();

    let wsUrl = this.appConfig.wsUrl || globalThis.window.location.origin;
    wsUrl = wsUrl
      .replace(/^wss:\/\//, 'https://')
      .replace(/^ws:\/\//, 'http://');
    if (globalThis.window.location.protocol === 'https:') {
      wsUrl = wsUrl.replace(/^http:\/\//, 'https://');
    }

    this.socket = io(`${wsUrl}/user`, {
      ...this.wsAuth.authOptions(),
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    this.wsAuth.attach(this.socket);
    this.subscribedUserId = userId;

    this.socket.on('connect', () => {
      this.connectedSignal.set(true);
      this.socket?.emit('subscribe:user', { userId });
    });
    this.socket.on('disconnect', () => this.connectedSignal.set(false));
    this.socket.on('github:connected', (payload: GithubConnectedEvent) => {
      this.githubConnectedListeners.forEach((cb) => cb(payload));
    });
  }

  disconnect(): void {
    if (!this.socket) return;
    try {
      if (this.subscribedUserId) {
        this.socket.emit('unsubscribe:user', { userId: this.subscribedUserId });
      }
      this.socket.disconnect();
    } finally {
      this.socket = null;
      this.subscribedUserId = null;
      this.connectedSignal.set(false);
    }
  }

  onGithubConnected(cb: (e: GithubConnectedEvent) => void): () => void {
    this.githubConnectedListeners.push(cb);
    return () => {
      this.githubConnectedListeners = this.githubConnectedListeners.filter(
        (fn) => fn !== cb,
      );
    };
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
