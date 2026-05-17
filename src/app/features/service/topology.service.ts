import { Injectable, inject, signal } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';

import { Configuration } from '../../core/api';
import { TopologyService as TopologyApiService } from '../../core/api/api/topology.service';
import { TopologyResponseDto } from '../../core/api/model/topologyResponseDto';
import { TopologyAppDto } from '../../core/api/model/topologyAppDto';
import { TopologyServerDto } from '../../core/api/model/topologyServerDto';
import { AuthService } from '../../core/services/auth.service';

export type TopologyEvent =
  | { event: 'app.status_changed'; data: { appId: string; status: TopologyAppDto.StatusEnum; statusReason: string | null } }
  | { event: 'app.scaled'; data: { appId: string; replicas: TopologyAppDto['replicas']; replicaCount: number; scalingNote?: string | null } }
  | { event: 'app.deployed'; data: TopologyAppDto }
  | { event: 'app.removed'; data: { appId: string } }
  | { event: 'server.added'; data: { clusterId: string; server: TopologyServerDto } }
  | { event: 'server.removed'; data: { clusterId: string; serverId: string } }
  | { event: 'heartbeat'; data: { ts: string } };

@Injectable({ providedIn: 'root' })
export class TopologyDashboardService {
  private readonly api = inject(TopologyApiService);
  private readonly apiConfig = inject(Configuration);
  private readonly auth = inject(AuthService);

  private readonly _data = signal<TopologyResponseDto | null>(null);
  readonly data = this._data.asReadonly();

  private readonly _connected = signal<boolean>(false);
  readonly connected = this._connected.asReadonly();

  private readonly _events = new Subject<TopologyEvent>();
  readonly events$ = this._events.asObservable();

  private abort: AbortController | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

  async load(): Promise<TopologyResponseDto> {
    const data = await firstValueFrom(this.api.topologyControllerGetTopology());
    this._data.set(data);
    return data;
  }

  startStream(): void {
    if (this.abort) return;
    void this.connect();
  }

  stopStream(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.abort?.abort();
    this.abort = null;
    this._connected.set(false);
  }

  private async connect(): Promise<void> {
    const base = this.apiConfig.basePath ?? '';
    const url = `${base}/api/v1/topology/stream`;
    const token = this.auth.getToken();

    const controller = new AbortController();
    this.abort = controller;

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        credentials: 'include',
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok || !res.body) {
        throw new Error(`SSE connect failed: ${res.status}`);
      }
      this._connected.set(true);
      this.reconnectAttempts = 0;
      this.armHeartbeatWatchdog();

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          this.processFrame(frame);
        }
      }
      throw new Error('SSE stream ended');
    } catch (err) {
      if (controller.signal.aborted) return;
      console.warn('[topology] SSE stream error, will reconnect', err);
      this._connected.set(false);
      this.scheduleReconnect();
    }
  }

  private processFrame(frame: string): void {
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    const raw = dataLines.join('\n');
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (eventName === 'heartbeat') this.armHeartbeatWatchdog();
    this._events.next({ event: eventName, data } as TopologyEvent);
  }

  private armHeartbeatWatchdog(): void {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = setTimeout(() => {
      // No heartbeat for >30s — force reconnect
      this.abort?.abort();
      this.abort = null;
      this._connected.set(false);
      this.scheduleReconnect();
    }, 30_000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.reconnectAttempts - 1, 5));
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      // Refresh full snapshot to recover any missed events
      try {
        await this.load();
      } catch {
        /* swallow — reconnect will surface error */
      }
      void this.connect();
    }, delay);
  }
}
