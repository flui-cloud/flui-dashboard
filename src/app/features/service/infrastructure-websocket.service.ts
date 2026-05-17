import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AppConfigService } from '../../core/services/app-config.service';
import { WebSocketAuthService } from '../../core/services/websocket-auth.service';

export interface InfrastructureOperationProgressDto {
  operationId: string;
  resourceId: string;
  operationType: string;
  resourceType: string;
  percentage: number;
  currentStepIndex: number;
  totalSteps: number;
  message: string;
  timestamp: string;
}

export interface InfrastructureOperationCompletedDto {
  operationId: string;
  resourceId: string;
  operationType: string;
  resourceType: string;
  duration: number;
  timestamp: string;
}

export interface InfrastructureOperationFailedDto {
  operationId: string;
  resourceId: string;
  operationType: string;
  resourceType: string;
  error: string;
  timestamp: string;
}

export interface ResourceCallbacks {
  onProgress?: (event: InfrastructureOperationProgressDto) => void;
  onCompleted?: (event: InfrastructureOperationCompletedDto) => void;
  onFailed?: (event: InfrastructureOperationFailedDto) => void;
}

/**
 * InfrastructureWebSocketService
 *
 * Manages WebSocket connections to the /infrastructure namespace.
 * Supports subscribe:resource and subscribe:operation patterns for
 * real-time tracking of cluster/server delete operations.
 */
@Injectable({
  providedIn: 'root',
})
export class InfrastructureWebSocketService implements OnDestroy {
  private socket: Socket | null = null;

  private readonly isConnectedSignal = signal<boolean>(false);
  readonly isConnected = this.isConnectedSignal.asReadonly();

  private readonly resourceCallbacks = new Map<string, ResourceCallbacks>();
  private readonly operationCallbacks = new Map<string, ResourceCallbacks>();

  private readonly appConfig = inject(AppConfigService);
  private readonly wsAuth = inject(WebSocketAuthService);

  private ensureConnected(): void {
    if (this.socket?.connected) return;

    const wsUrl = this.appConfig.wsUrl || globalThis.window.location.origin;

    this.socket = io(`${wsUrl}/infrastructure`, {
      ...this.wsAuth.authOptions(),
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    this.wsAuth.attach(this.socket);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnectedSignal.set(true);
    });

    this.socket.on('disconnect', () => {
      this.isConnectedSignal.set(false);
    });

    this.socket.on('connect_error', () => {
      this.isConnectedSignal.set(false);
    });

    this.socket.on('infrastructure:operation:progress', (dto: InfrastructureOperationProgressDto) => {
      this.resourceCallbacks.get(dto.resourceId)?.onProgress?.(dto);
      this.operationCallbacks.get(dto.operationId)?.onProgress?.(dto);
    });

    this.socket.on('infrastructure:operation:completed', (dto: InfrastructureOperationCompletedDto) => {
      this.resourceCallbacks.get(dto.resourceId)?.onCompleted?.(dto);
      this.operationCallbacks.get(dto.operationId)?.onCompleted?.(dto);
    });

    this.socket.on('infrastructure:operation:failed', (dto: InfrastructureOperationFailedDto) => {
      console.error(`❌ Operation failed: ${dto.error}`);
      this.resourceCallbacks.get(dto.resourceId)?.onFailed?.(dto);
      this.operationCallbacks.get(dto.operationId)?.onFailed?.(dto);
    });
  }

  /**
   * Subscribe to events by resource ID (UUID of cluster/server).
   * Use before initiating the DELETE so no events are missed.
   */
  subscribeToResource(resourceId: string, callbacks: ResourceCallbacks): void {
    this.ensureConnected();
    this.resourceCallbacks.set(resourceId, callbacks);
    this.socket?.emit('subscribe:resource', { resourceId });
  }

  /**
   * Subscribe to events by operation ID (returned by the DELETE API).
   * Use after the DELETE call if you didn't subscribe by resource first.
   */
  subscribeToOperation(operationId: string, callbacks: ResourceCallbacks): void {
    this.ensureConnected();
    this.operationCallbacks.set(operationId, callbacks);
    this.socket?.emit('subscribe:operation', { operationId });
  }

  unsubscribeFromResource(resourceId: string): void {
    this.resourceCallbacks.delete(resourceId);
    this.socket?.emit('unsubscribe:resource', { resourceId });
  }

  unsubscribeFromOperation(operationId: string): void {
    this.operationCallbacks.delete(operationId);
    this.socket?.emit('unsubscribe:operation', { operationId });
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
