import { Injectable, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AppConfigService } from './app-config.service';
import { WebSocketAuthService } from './websocket-auth.service';

@Injectable({
  providedIn: 'root'
})
export class TerminalService {
  private readonly appConfig = inject(AppConfigService);
  private readonly wsAuth = inject(WebSocketAuthService);
  private socket: Socket | null = null;
  private dataCallback: ((data: string | Uint8Array) => void) | null = null;

  private readonly _connectionState = signal<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  readonly connectionState = this._connectionState.asReadonly();

  private readonly _sessionId = signal<string | null>(null);
  readonly sessionId = this._sessionId.asReadonly();

  private readonly _errorMessage = signal<string | null>(null);
  readonly errorMessage = this._errorMessage.asReadonly();

  connect(
    serverId: string,
    serverIp: string,
    onData: (data: string | Uint8Array) => void,
    options?: {
      cols?: number;
      rows?: number;
      authToken?: string;
      useBootstrapKey?: boolean;
      clusterId?: string;
    }
  ): void {
    if (this.socket?.connected) {
      this.disconnect();
    }

    this._connectionState.set('connecting');
    this._errorMessage.set(null);
    this.dataCallback = onData;

    this.socket = io(this.appConfig.wsUrl, {
      auth: { token: options?.authToken ?? this.wsAuth.getToken() ?? '' },
      query: {
        tenantId: 'default',
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    });
    this.wsAuth.attach(this.socket);

    this.setupSocketListeners();

    this.socket.emit('terminal:connect', {
      serverId,
      serverIp,
      cols: options?.cols || 80,
      rows: options?.rows || 24,
      useBootstrapKey: options?.useBootstrapKey ?? false,
      ...(options?.clusterId ? { clusterId: options.clusterId } : {}),
    });
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {});

    this.socket.on('terminal:data', (data: unknown) => {
      if (!this.dataCallback) return;

      let processedData: string | Uint8Array;

      if (typeof data === 'string') {
        processedData = data;
      } else if (data && typeof data === 'object' && 'data' in data) {
        const inner = (data as { data: unknown }).data;
        if (typeof inner === 'string') {
          processedData = inner;
        } else if (inner instanceof ArrayBuffer || inner instanceof Uint8Array) {
          processedData = new Uint8Array(inner as ArrayBuffer);
        } else if (Array.isArray(inner)) {
          processedData = new Uint8Array(inner);
        } else {
          processedData = String(inner);
        }
      } else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
        processedData = new Uint8Array(data as ArrayBuffer);
      } else if (Array.isArray(data)) {
        processedData = new Uint8Array(data);
      } else {
        processedData = String(data);
      }

      this.dataCallback(processedData);
    });

    this.socket.on('terminal:connected', (data: { sessionId: string }) => {
      this._connectionState.set('connected');
      this._sessionId.set(data.sessionId);
      this._errorMessage.set(null);
    });

    this.socket.on('terminal:error', (data: { message: string }) => {
      this._connectionState.set('error');
      this._errorMessage.set(data.message);
    });

    this.socket.on('terminal:disconnected', () => {
      this._connectionState.set('disconnected');
      this._sessionId.set(null);
    });

    this.socket.on('connect_error', () => {
      this._connectionState.set('error');
      this._errorMessage.set('Failed to connect to server');
    });

    this.socket.on('connect_timeout', () => {
      this._connectionState.set('error');
      this._errorMessage.set('Connection timeout');
    });

    this.socket.on('reconnect_attempt', () => {});

    this.socket.on('reconnect_failed', () => {
      this._connectionState.set('error');
      this._errorMessage.set('Could not reconnect to server');
    });

    this.socket.on('disconnect', () => {
      this._connectionState.set('disconnected');
      this._sessionId.set(null);
    });
  }

  sendInput(data: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('terminal:input', { data });
  }

  resizeTerminal(cols: number, rows: number): void {
    if (!this.socket?.connected) return;
    this.socket.emit('terminal:resize', { cols, rows });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.emit('terminal:disconnect', {});
      this.socket.disconnect();
      this.socket = null;
    }
    this._connectionState.set('disconnected');
    this._sessionId.set(null);
    this._errorMessage.set(null);
    this.dataCallback = null;
  }

  isConnected(): boolean {
    return this._connectionState() === 'connected';
  }
}
