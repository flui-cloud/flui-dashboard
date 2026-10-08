import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import { ToastService } from '../../shared/services/toast.service';

export interface EgressPort {
  port: number;
  protocol: 'TCP' | 'UDP';
}

export interface EgressView {
  open: boolean;
  ports: EgressPort[];
  summary: string;
}

export interface EgressChange extends EgressView {
  applied: number;
  failed: Array<{ namespace: string; error: string }>;
}

/** `80, 443, 123/udp` → ports, or the reason it cannot be read. */
export function parseEgressPorts(text: string): EgressPort[] | string {
  const ports: EgressPort[] = [];
  for (const raw of text.split(',')) {
    const entry = raw.trim();
    if (!entry) continue;
    const [num, proto = 'tcp'] = entry.split('/');
    const port = Number(num);
    const protocol = proto.trim().toUpperCase();
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return `"${entry}" is not a port between 1 and 65535`;
    }
    if (protocol !== 'TCP' && protocol !== 'UDP') {
      return `"${entry}": the protocol must be tcp or udp`;
    }
    ports.push({ port, protocol });
  }
  return ports;
}

export function formatEgressPorts(ports: EgressPort[]): string {
  return ports.map((p) => (p.protocol === 'TCP' ? `${p.port}` : `${p.port}/udp`)).join(', ');
}

@Injectable({ providedIn: 'root' })
export class EgressService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly toast = inject(ToastService);

  private get base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1`;
  }

  cluster(clusterId: string): Promise<EgressView> {
    return firstValueFrom(this.http.get<EgressView>(`${this.base}/infrastructure/clusters/${clusterId}/egress-policy`));
  }

  setCluster(clusterId: string, ports: EgressPort[]): Promise<EgressChange | null> {
    return this.guard(this.http.put<EgressChange>(`${this.base}/infrastructure/clusters/${clusterId}/egress-policy`, { ports }), 'The rule was not saved');
  }

  openCluster(clusterId: string): Promise<EgressChange | null> {
    return this.guard(this.http.delete<EgressChange>(`${this.base}/infrastructure/clusters/${clusterId}/egress-policy`), 'The rule was not removed');
  }

  app(appId: string): Promise<EgressView> {
    return firstValueFrom(this.http.get<EgressView>(`${this.base}/applications/${appId}/egress`));
  }

  private async guard<T>(call: import('rxjs').Observable<T>, title: string): Promise<T | null> {
    try {
      return await firstValueFrom(call);
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string | string[] } })?.error?.message;
      this.toast.showError({ title, message: Array.isArray(message) ? message.join(' ') : (message ?? 'Please try again.') });
      return null;
    }
  }
}
