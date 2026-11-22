import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  OnInit,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy, lucideX } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { VNetService } from '../../service/vnet.service';
import { ToastService } from '../../../shared/services/toast.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

interface IssuedToken {
  command: string;
  expiresAt: string;
  serverName: string;
  masterIp: string;
  nodeNetwork?: string;
}

@Component({
  selector: 'app-byos-connect-node-dialog',
  imports: [
    DatePipe,
    FormsModule,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
  ],
  providers: [provideIcons({ lucideX, lucideCopy, lucideCheck })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="closed.emit()"
    >
      <div
        class="fl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="byos-connect-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="byos-connect-title">Connect a worker node</h2>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="closed.emit()">
            <fl-icon name="lucideX" />
          </button>
        </header>

        @if (!result()) {
          <div class="fl-dialog__body">
            <p class="m-0 text-fl-ink-muted">
              Self-hosted clusters do not provision servers. Point Flui at a Linux box you already
              own and it installs over SSH.
            </p>
            <fl-field label="Master address (node reaches k3s API here)" for="byos-master-ip">
              <span class="fl-input fl-input--lg">
                <input
                  id="byos-master-ip"
                  type="text"
                  placeholder="10.0.0.11"
                  [(ngModel)]="formMasterIp"
                />
              </span>
            </fl-field>
            @if (registeredNetwork()) {
              <div class="fl-field">
                <span class="fl-field__label">Private network</span>
                <span class="fl-row">
                  <span class="fl-mono">{{ registeredNetwork() }}</span>
                  <fl-status tone="success" label="Registered" />
                </span>
                <span class="fl-field__hint">
                  The new node joins this cluster's private network. Manage it from the Network tab.
                </span>
              </div>
            } @else {
              <fl-field
                label="Private network CIDR (nodes share it)"
                for="byos-node-network"
                hint="The host firewall allows this network for node-to-node k3s traffic. Use the private subnet your nodes share (not the public internet)."
              >
                <span class="fl-input fl-input--lg">
                  <input
                    id="byos-node-network"
                    type="text"
                    placeholder="10.0.0.0/24"
                    [(ngModel)]="formNodeNetwork"
                  />
                </span>
              </fl-field>
            }
            @if (error()) {
              <fl-alert tone="error" title="Could not generate the command">{{ error() }}</fl-alert>
            }
          </div>
          <footer class="fl-dialog__footer">
            <button flButton="ghost" type="button" (click)="closed.emit()">Cancel</button>
            <button
              flButton="primary"
              type="button"
              [disabled]="generating() || !formMasterIp"
              (click)="generate()"
            >
              @if (generating()) {
                <fl-spinner label="Generating" />
              }
              Generate join command
            </button>
          </footer>
        } @else {
          <div class="fl-dialog__body">
            <p class="m-0">On the new host (a clean Linux box, 2GB+ RAM), run as root:</p>
            <pre
              class="fl-mono m-0 overflow-x-auto whitespace-pre-wrap break-all rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3"
              >{{ result()!.command }}</pre>
            <div>
              <button flButton size="sm" type="button" (click)="copy()">
                <fl-icon [name]="copied() ? 'lucideCheck' : 'lucideCopy'" [size]="14" />
                {{ copied() ? 'Copied' : 'Copy command' }}
              </button>
            </div>
            <fl-key-value class="fl-kv--compact">
              <fl-kv-item key="Node name" [mono]="true">{{ result()!.serverName }}</fl-kv-item>
              <fl-kv-item key="Reaches master at" [mono]="true"
                >{{ result()!.masterIp }}:6443</fl-kv-item
              >
              <fl-kv-item key="Firewall allows" [mono]="true">{{
                result()!.nodeNetwork || 'n/a'
              }}</fl-kv-item>
              <fl-kv-item key="Expires">{{ result()!.expiresAt | date: 'short' }}</fl-kv-item>
            </fl-key-value>
            <p class="m-0 text-fl-body-sm text-fl-ink-muted">
              Single-use. The node appears in this list once it joins.
            </p>
          </div>
          <footer class="fl-dialog__footer">
            <button flButton type="button" (click)="closed.emit()">Done</button>
          </footer>
        }
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
    } catch {}
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
    } catch (err) {
      const e = err as { error?: { message?: string }; message?: string } | null;
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
