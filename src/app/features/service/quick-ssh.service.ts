import { Injectable, signal, computed } from '@angular/core';

export interface SshSession {
  serverId: string;
  serverIp: string;
  serverName: string;
  clusterId?: string;
  clusterName?: string;
}

export type PanelState = 'closed' | 'open' | 'minimized';

@Injectable({ providedIn: 'root' })
export class QuickSshService {
  private readonly panelStateSignal = signal<PanelState>('closed');
  private readonly activeSessionSignal = signal<SshSession | null>(null);

  readonly panelState = this.panelStateSignal.asReadonly();
  readonly activeSession = this.activeSessionSignal.asReadonly();
  readonly hasActiveSession = computed(() => !!this.activeSessionSignal());
  readonly isOpen = computed(() => this.panelStateSignal() === 'open');
  readonly isMinimized = computed(() => this.panelStateSignal() === 'minimized');

  open(): void {
    this.panelStateSignal.set('open');
  }

  close(): void {
    this.activeSessionSignal.set(null);
    this.panelStateSignal.set('closed');
  }

  minimize(): void {
    this.panelStateSignal.set('minimized');
  }

  restore(): void {
    this.panelStateSignal.set('open');
  }

  toggle(): void {
    const state = this.panelStateSignal();
    if (state === 'closed') {
      this.panelStateSignal.set('open');
    } else if (state === 'open') {
      this.panelStateSignal.set('minimized');
    } else {
      this.panelStateSignal.set('open');
    }
  }

  setSession(session: SshSession): void {
    this.activeSessionSignal.set(session);
    this.panelStateSignal.set('open');
  }

  clearSession(): void {
    this.activeSessionSignal.set(null);
  }
}
