import { Injectable, inject, signal } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';

import { SystemAppsPreference } from '../../core/services/system-apps-preference.service';
import { TopologyService as TopologyApiService } from '../../core/api/api/topology.service';
import { TopologyResponseDto } from '../../core/api/model/topologyResponseDto';
import { TopologyStreamMessageDto } from '../../core/api/model/topologyStreamMessageDto';
import { TopologyStreamPayloadDto } from '../../core/api/model/topologyStreamPayloadDto';
import { AuthService } from '../../core/services/auth.service';
import { AppConfigService } from '../../core/services/app-config.service';
import { MaskModeService } from '../../core/services/mask-mode.service';
import { SandboxService } from '../../core/services/sandbox.service';
import { maskModeHeaders } from '../../core/interceptors/mask-mode.interceptor';
import { apiPath } from '../../core/interceptors/sandbox-fence.interceptor';

export interface TopologyEvent {
  event: TopologyStreamMessageDto.TypeEnum;
  data: TopologyStreamPayloadDto;
}

@Injectable({ providedIn: 'root' })
export class TopologyDashboardService {
  private readonly api = inject(TopologyApiService);
  private readonly appConfig = inject(AppConfigService);
  private readonly auth = inject(AuthService);
  private readonly mask = inject(MaskModeService);
  private readonly sandbox = inject(SandboxService);
  private readonly systemApps = inject(SystemAppsPreference);

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
    const data = await firstValueFrom(
      this.api.topologyControllerGetTopology(this.systemApps.shown() ? '1' : undefined),
    );
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
    const base = this.appConfig.apiBaseUrl ?? '';
    const url = `${base}/api/v1/topology/stream${this.systemApps.shown() ? '?system=1' : ''}`;
    const path = apiPath(url, base);
    if (path !== null && (!this.sandbox.allows('GET', path) || this.sandbox.needsSignIn('GET', path))) {
      this.abort = null;
      return;
    }
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
          ...maskModeHeaders(this.mask.enabled(), url, base),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok || !res.body) {
        throw new Error(`SSE connect failed: ${res.status}`);
      }
      this._connected.set(true);
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
    // Only a stream that delivers counts as healthy: one that closes at once must back off.
    this.reconnectAttempts = 0;
    const event = eventName as TopologyEvent['event'];
    if (event === 'heartbeat') this.armHeartbeatWatchdog();
    this._events.next({ event, data: data as TopologyStreamPayloadDto });
  }

  private armHeartbeatWatchdog(): void {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = setTimeout(() => {
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
