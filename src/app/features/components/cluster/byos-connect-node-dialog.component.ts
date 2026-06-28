import { Component, inject, input, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideX,
  lucideCopy,
  lucideCheck,
  lucideServer,
  lucideTerminal,
  lucideLoader,
  lucideCircleAlert,
  lucideShieldCheck,
} from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { VNetService } from '../../service/vnet.service';
import { ToastService } from '../../../shared/services/toast.service';

interface IssuedToken {
  command: string;
  expiresAt: string;
  serverName: string;
  masterIp: string;
  nodeNetwork?: string;
}

@Component({
  selector: 'app-byos-connect-node-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  providers: [
    provideIcons({
      lucideX,
      lucideCopy,
      lucideCheck,
      lucideServer,
      lucideTerminal,
      lucideLoader,
      lucideCircleAlert,
      lucideShieldCheck,
    }),
  ],
  template: `
    <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" (click)="closed.emit()">
      <div class="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] p-4">
        <div class="card-surface p-5 space-y-4" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between">
            <div class="flex items-start gap-3">
              <span class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ng-icon name="lucideServer" class="h-5 w-5" />
              </span>
              <div>
                <h2 class="text-lg font-semibold text-foreground">Connect a worker node</h2>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Self-hosted clusters don't provision servers — point Flui at a Linux
                  box you already own and it installs over SSH.
                </p>
              </div>
            </div>
            <button type="button" (click)="closed.emit()" class="text-muted-foreground hover:text-foreground p-1 rounded">
              <ng-icon name="lucideX" class="h-4 w-4" />
            </button>
          </div>

          @if (!result()) {
            <div class="space-y-3">
              <div class="space-y-1">
                <label class="text-sm font-medium text-foreground">Master address (node reaches k3s API here)</label>
                <input
                  type="text" [(ngModel)]="formMasterIp"
                  placeholder="10.0.0.11"
                  class="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background"
                />
              </div>
              @if (registeredNetwork()) {
                <div class="space-y-1">
                  <label class="text-sm font-medium text-foreground">Private network</label>
                  <div class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border bg-muted/40">
                    <ng-icon name="lucideShieldCheck" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span class="font-mono text-foreground">{{ registeredNetwork() }}</span>
                    <span class="text-xs text-muted-foreground">registered</span>
                  </div>
                  <p class="text-xs text-muted-foreground">
                    The new node joins this cluster's private network. Manage it from the Network tab.
                  </p>
                </div>
              } @else {
                <div class="space-y-1">
                  <label class="text-sm font-medium text-foreground">Private network CIDR (nodes share it)</label>
                  <input
                    type="text" [(ngModel)]="formNodeNetwork"
                    placeholder="10.0.0.0/24"
                    class="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background"
                  />
                  <p class="text-xs text-muted-foreground">
                    The host firewall allows this network for node-to-node k3s traffic. Use the
                    private subnet your nodes share (not the public internet).
                  </p>
                </div>
              }
              @if (error()) {
                <div class="flex items-center gap-2 text-sm status-error">
                  <ng-icon name="lucideCircleAlert" class="h-4 w-4" /> {{ error() }}
                </div>
              }
            </div>
            <div class="flex justify-end gap-2">
              <button type="button" (click)="closed.emit()" class="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted">
                Cancel
              </button>
              <button
                type="button" (click)="generate()" [disabled]="generating() || !formMasterIp"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                @if (generating()) { <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" /> }
                Generate join command
              </button>
            </div>
          } @else {
            <ol class="text-sm text-foreground/90 space-y-1.5 list-decimal list-inside">
              <li>On the new host (a clean Linux box, 2GB+ RAM), run as root:</li>
            </ol>
            <div class="relative">
              <pre class="text-xs bg-muted rounded-md p-3 pr-10 overflow-x-auto font-mono whitespace-pre-wrap break-all">{{ result()!.command }}</pre>
              <button
                type="button" (click)="copy()" title="Copy command"
                class="absolute top-2 right-2 inline-flex items-center justify-center h-7 w-7 rounded border border-border bg-background hover:bg-muted"
              >
                <ng-icon [name]="copied() ? 'lucideCheck' : 'lucideCopy'" class="h-3.5 w-3.5" [class.text-green-600]="copied()" />
              </button>
            </div>
            <div class="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <div>Node name: <span class="font-mono text-foreground">{{ result()!.serverName }}</span></div>
              <div>Reaches master at <span class="font-mono text-foreground">{{ result()!.masterIp }}:6443</span> · firewall allows <span class="font-mono text-foreground">{{ result()!.nodeNetwork || 'n/a' }}</span></div>
              <div>Single-use · expires {{ result()!.expiresAt | date: 'short' }}. The node appears in this list once it joins.</div>
            </div>
            <div class="flex justify-end">
              <button type="button" (click)="closed.emit()" class="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted">
                Done
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ByosConnectNodeDialogComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly vnetService = inject(VNetService);
  private readonly toast = inject(ToastService);

  clusterId = input.required<string>();
  masterIp = input<string | undefined>(undefined);
  closed = output<void>();

  protected formMasterIp = '';
  protected formNodeNetwork = '';
  protected generating = signal(false);
  protected error = signal<string | null>(null);
  protected result = signal<IssuedToken | null>(null);
  protected copied = signal(false);
  protected registeredNetwork = signal<string | null>(null);

  ngOnInit(): void {
    this.formMasterIp = this.masterIp() ?? '';
    this.formNodeNetwork = this.deriveSlash24(this.formMasterIp);
    void this.loadRegisteredNetwork();
  }

  private async loadRegisteredNetwork(): Promise<void> {
    try {
      await this.vnetService.loadVNets('byos', this.clusterId());
      const vnet = this.vnetService.vnets()[0];
      if (vnet?.ipRange) {
        this.registeredNetwork.set(vnet.ipRange);
        this.formNodeNetwork = vnet.ipRange;
      }
    } catch {
    }
  }

  private deriveSlash24(ip: string): string {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec((ip || '').trim());
    return m ? `${m[1]}.${m[2]}.${m[3]}.0/24` : '';
  }

  async generate(): Promise<void> {
    this.generating.set(true);
    this.error.set(null);
    try {
      const res = await this.clusterService.issueJoinToken(this.clusterId(), {
        masterIp: this.formMasterIp.trim() || undefined,
        nodeNetwork: this.formNodeNetwork.trim() || undefined,
      });
      this.result.set(res);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed to generate join command');
    } finally {
      this.generating.set(false);
    }
  }

  async copy(): Promise<void> {
    const cmd = this.result()?.command;
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      this.toast.showError('Could not copy to clipboard');
    }
  }
}
