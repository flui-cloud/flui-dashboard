import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export type UdpPortState =
  | 'open'
  | 'pending'
  | 'closed'
  | 'unmanaged'
  | 'not-published';

export interface UdpPortStatus {
  name: string;
  port: number;
  state: UdpPortState;
  takenBy?: string | null;
}

export interface UdpPortsView {
  clusterId: string;
  firewallId: string | null;
  ports: UdpPortStatus[];
}

export interface AppUdpPort {
  name: string;
  port: number;
}

/** The UDP ports an app was created with; the generated client predates the field. */
export function udpPortsOf(app: unknown): AppUdpPort[] {
  const ports = (app as { udpPorts?: AppUdpPort[] | null } | null)?.udpPorts;
  return Array.isArray(ports) ? ports : [];
}

export const UDP_STATE_TEXT: Record<UdpPortState, string> = {
  open: 'Open',
  pending: 'Rule saved, being applied',
  closed: 'Closed',
  unmanaged: 'Not filtered by Flui',
  'not-published': 'Not available in the trial',
};

/** What the person reading it can do next, or null when every port is open. */
export function udpPortsAdvice(view: UdpPortsView): string | null {
  const states = new Set(view.ports.map((p) => p.state));
  if (states.has('not-published')) {
    return 'Trial apps never get a public UDP port.';
  }
  if (states.has('closed')) {
    return 'Flui never opens a UDP port on its own. Someone who manages the cluster adds an inbound UDP rule for it in Cluster Firewalls.';
  }
  if (states.has('unmanaged')) {
    return 'This cluster has no firewall managed by Flui, so the port is as reachable as your provider allows.';
  }
  if (states.has('pending')) {
    return 'The firewall rule is saved and is being applied.';
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class AppUdpPortsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private get base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1`;
  }

  forApp(appId: string): Observable<UdpPortsView> {
    return this.http.get<UdpPortsView>(
      `${this.base}/applications/${encodeURIComponent(appId)}/udp-ports`,
    );
  }

  forInstall(slug: string, clusterId: string): Observable<UdpPortsView> {
    return this.http.post<UdpPortsView>(
      `${this.base}/catalog/${encodeURIComponent(slug)}/udp-ports`,
      { clusterId },
    );
  }
}
