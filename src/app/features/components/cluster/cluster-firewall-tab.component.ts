import { Component, computed, inject, signal, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideShield } from '@ng-icons/lucide';

import { ClusterService } from '../../service/cluster.service';
import { ProvidersService } from '../../service/providers.service';
import { FirewallV2Service } from '../../service/firewall-v2.service';
import { FirewallResponseDto } from '../../../core/api/model/models';
import { ClusterHostLayerComponent } from './cluster-host-layer.component';
import { hostLayerOf } from '../../model/firewall-v2.models';
import { ClusterEgressCardComponent } from '../egress/cluster-egress-card.component';
import { ClusterFirewallRules } from './cluster-firewall-rules';
import {
  canReconcile,
  driftState,
  reconciliationState,
  timeSince,
} from './cluster-firewall-format';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlField } from '../../../ui/patterns/field';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'cluster-firewall-tab',
  imports: [
    FormsModule,
    ClusterHostLayerComponent,
    ClusterEgressCardComponent,
    ClusterFirewallRules,
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlField,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlStatus,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucideExternalLink, lucideShield })],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Machines">
      <ng-container panelActions>
        @if (clusterFirewall()) {
          <button flButton size="sm" type="button" (click)="navigateToFirewallManagement()">
            Manage rules
            <fl-icon name="lucideExternalLink" [size]="14" />
          </button>
        } @else if (isHostFirewall() && !isLoading()) {
          <button
            flButton="primary"
            size="sm"
            type="button"
            [disabled]="enabling()"
            (click)="enableHostFirewall()"
          >
            @if (enabling()) {
              <fl-spinner label="Enabling" />
              Enabling…
            } @else {
              <fl-icon name="lucideShield" [size]="14" />
              Enable host firewall
            }
          </button>
        }
      </ng-container>

      <div class="flex flex-col gap-4">
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          Traffic to and from the cluster's servers. It covers everything on them, the platform
          included.
        </p>

        @if (isLoading()) {
          <fl-loading-state [rows]="3" />
        } @else if (clusterFirewall(); as fw) {
          @if (isHostFirewall()) {
            <p class="m-0 text-fl-body-sm text-fl-ink-muted">
              Host firewall, nftables over SSH. SSH on port 22 always stays open and is protected by
              CA certificates. Ports 80 and 443 are required and can only be IP-allowlisted.
              Outbound traffic from the machines is not restricted.
            </p>
          }
          <fl-key-value>
            <fl-kv-item key="Status">
              <span class="fl-row">
                <fl-status [tone]="reconciliation().tone" [label]="reconciliation().label" />
                @if (canReconcile(fw.reconciliationStatus)) {
                  <button
                    flButton="ghost"
                    size="sm"
                    type="button"
                    [disabled]="reconciling()"
                    (click)="reconcileFirewall()"
                  >
                    {{ reconciling() ? 'Reconciling…' : 'Reconcile' }}
                  </button>
                }
              </span>
            </fl-kv-item>
            <fl-kv-item key="Last reconciled">
              {{ getTimeSinceReconciliation(fw.lastReconciliationAt) }}
            </fl-kv-item>
            @if (fw.reconciliationStatus) {
              <fl-kv-item key="Provider state">
                <fl-status [tone]="drift().tone" [label]="drift().label" />
              </fl-kv-item>
            }
          </fl-key-value>

          @if (hostLayer()?.applicable && clusterId()) {
            <cluster-host-layer
              [clusterId]="clusterId()!"
              [layer]="hostLayer()!"
              (changed)="clusterFirewall.set($event)"
            />
          }
        } @else if (isHostFirewall()) {
          <p class="m-0 text-fl-body-sm text-fl-ink-secondary">
            This server's firewall is enforced on the host with nftables over SSH. There is no
            cloud-edge firewall to manage here. Enabling generates a default ruleset and applies it
            on the node, then you can edit the rules.
          </p>
          @if (firewallCap()?.supportsSshAllowlist === false) {
            <p class="m-0 text-fl-body-sm text-fl-ink-secondary">
              SSH on port 22 stays open and is protected by short-lived CA certificates.
              IP-allowlisting port 22 is disabled so you cannot lock yourself out, as there is no
              out-of-band recovery channel. Allowlisting still applies to other ports.
            </p>
          }
          <p class="m-0 text-fl-body-sm text-fl-ink-secondary">
            Ports 80 and 443 must stay open for HTTPS ingress and certificate renewal. They can be
            IP-allowlisted but not removed. Outbound traffic from the machines is not restricted.
          </p>
          @if (enableError()) {
            <fl-alert tone="error" title="Could not enable the firewall">
              {{ enableError() }}
            </fl-alert>
          }
        } @else {
          <fl-empty-state
            icon="lucideShield"
            title="No firewall"
            body="This cluster has no firewall configuration."
            [compact]="true"
          />
        }
      </div>
    </fl-panel>

    @if (isHostFirewall()) {
      <fl-panel title="SSH connection">
        <ng-container panelActions>
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [attr.aria-expanded]="showSshSettings()"
            (click)="showSshSettings.set(!showSshSettings())"
          >
            {{ showSshSettings() ? 'Hide' : 'Configure' }}
          </button>
        </ng-container>

        <div class="flex flex-col gap-4">
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            Flui applies this host's firewall over SSH. Leave the host empty to use the node's IP
            address.
          </p>
          @if (showSshSettings()) {
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <fl-field label="Host" for="ssh-target-host" hint="Optional">
                <div class="fl-input fl-input--lg">
                  <input
                    id="ssh-target-host"
                    class="fl-mono"
                    placeholder="Node IP or hostname"
                    [(ngModel)]="sshHost"
                  />
                </div>
              </fl-field>
              <fl-field label="Port" for="ssh-target-port">
                <div class="fl-input fl-input--lg">
                  <input
                    id="ssh-target-port"
                    class="fl-mono"
                    type="number"
                    min="1"
                    max="65535"
                    [(ngModel)]="sshPort"
                  />
                </div>
              </fl-field>
              <fl-field label="User" for="ssh-target-user">
                <div class="fl-input fl-input--lg">
                  <input
                    id="ssh-target-user"
                    class="fl-mono"
                    placeholder="root"
                    [(ngModel)]="sshUser"
                  />
                </div>
              </fl-field>
            </div>
            @if (sshError()) {
              <fl-alert tone="error" title="Could not save the SSH connection">
                {{ sshError() }}
              </fl-alert>
            }
            <div class="fl-row">
              <button
                [flButton]="clusterFirewall() ? 'primary' : 'secondary'"
                type="button"
                [disabled]="savingSsh()"
                (click)="saveSshTarget()"
              >
                @if (savingSsh()) {
                  <fl-spinner label="Saving" />
                  Saving…
                } @else {
                  Save and apply
                }
              </button>
              @if (sshSaved()) {
                <fl-status tone="success" label="Saved" />
              }
            </div>
          }
        </div>
      </fl-panel>
    }

    @if (!isLoading() && clusterFirewall(); as fw) {
      <app-cluster-firewall-rules [rules]="fw.lastAppliedRules ?? []" />
    }

    <app-cluster-egress-card class="block" [clusterId]="clusterId()" />
  `,
})
export class ClusterFirewallTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly firewallV2Service = inject(FirewallV2Service);
  private readonly providersService = inject(ProvidersService);
  private readonly router = inject(Router);

  clusterFirewall = signal<FirewallResponseDto | null>(null);
  isLoading = signal<boolean>(false);
  enabling = signal<boolean>(false);
  enableError = signal<string | null>(null);
  reconciling = signal<boolean>(false);

  showSshSettings = signal<boolean>(false);
  sshHost = signal('');
  sshPort = signal('22');
  sshUser = signal('root');
  savingSsh = signal<boolean>(false);
  sshSaved = signal<boolean>(false);
  sshError = signal<string | null>(null);

  protected readonly canReconcile = canReconcile;

  readonly firewallCap = computed(() => {
    const provider = this.clusterService.cluster()?.provider;
    return provider
      ? this.providersService.getProviderDefinition(provider)?.capabilities?.firewall
      : undefined;
  });
  readonly hostLayer = computed(() => hostLayerOf(this.clusterFirewall()));
  readonly clusterId = computed(() => this.clusterService.cluster()?.id ?? null);
  readonly isHostFirewall = computed(() => this.firewallCap()?.backend === 'host-nftables');
  readonly reconciliation = computed(() =>
    reconciliationState(this.clusterFirewall()?.reconciliationStatus),
  );
  readonly drift = computed(() => {
    const fw = this.clusterFirewall();
    return driftState(!!fw?.hasDrift, fw?.reconciliationStatus);
  });

  ngOnInit(): void {
    void (async () => {
      const cluster = this.clusterService.cluster();
      if (cluster?.provider) {
        this.providersService.loadProviderDefinition(cluster.provider);
      }
      if (cluster?.id) {
        await this.loadClusterFirewall(cluster.id);
      }
    })();
  }

  async loadClusterFirewall(clusterId: string) {
    this.isLoading.set(true);
    try {
      const firewall = await this.firewallV2Service.getFirewallByCluster(clusterId);
      this.clusterFirewall.set(firewall || null);
    } catch (error) {
      console.error('Failed to load cluster firewall:', error);
      this.clusterFirewall.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshFirewall() {
    const cluster = this.clusterService.cluster();
    if (cluster?.id) {
      await this.loadClusterFirewall(cluster.id);
    }
  }

  async reconcileFirewall() {
    const firewall = this.clusterFirewall();
    if (!firewall?.id) return;
    this.reconciling.set(true);
    try {
      const updated = await this.firewallV2Service.reconcile(firewall.id);
      if (updated) this.clusterFirewall.set(updated);
    } finally {
      this.reconciling.set(false);
    }
  }

  async saveSshTarget() {
    const cluster = this.clusterService.cluster();
    if (!cluster?.id) return;
    this.savingSsh.set(true);
    this.sshSaved.set(false);
    this.sshError.set(null);
    try {
      const port = Number(this.sshPort()) || 22;
      await this.clusterService.updateSshTarget(cluster.id, {
        host: this.sshHost().trim() || undefined,
        port,
        user: this.sshUser().trim() || 'root',
      });
      this.sshSaved.set(true);
      if (this.clusterFirewall()?.id) {
        await this.reconcileFirewall();
      }
    } catch (error: any) {
      this.sshError.set(error?.message || 'Failed to save SSH settings');
    } finally {
      this.savingSsh.set(false);
    }
  }

  async enableHostFirewall() {
    const cluster = this.clusterService.cluster();
    if (!cluster?.id) return;
    this.enabling.set(true);
    this.enableError.set(null);
    try {
      const firewall = await this.firewallV2Service.enableForCluster(cluster.id);
      if (firewall) {
        this.clusterFirewall.set(firewall);
      } else {
        this.enableError.set(this.firewallV2Service.error() || 'Failed to enable firewall');
      }
    } catch (error) {
      console.error('Failed to enable host firewall:', error);
      this.enableError.set('Failed to enable firewall');
    } finally {
      this.enabling.set(false);
    }
  }

  navigateToFirewallManagement() {
    const firewall = this.clusterFirewall();
    if (firewall?.id) {
      this.router.navigate(['/infrastructure/firewall', firewall.id]);
    }
  }

  getTimeSinceReconciliation(timestamp?: string): string {
    return timeSince(timestamp);
  }
}
