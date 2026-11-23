import { Component, computed, inject, input, output, signal } from '@angular/core';

import { FirewallResponseDto } from '../../../core/api/model/models';
import { PermissionService } from '../../../core/services/permission.service';
import { FirewallV2Service } from '../../service/firewall-v2.service';
import { HostFirewallLayer, HostFirewallLayerState } from '../../model/firewall-v2.models';
import { AlertTone, FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

const STATE_LABEL: Record<HostFirewallLayerState, string> = {
  'not-applicable': 'Not offered',
  off: 'Off',
  pending: 'Applying',
  applied: 'On',
  blocked: 'Waiting',
  failed: 'Failed',
  removing: 'Turning off',
};

const STATE_TONE: Record<HostFirewallLayerState, StatusTone> = {
  'not-applicable': 'neutral',
  off: 'neutral',
  pending: 'progress',
  applied: 'success',
  blocked: 'warning',
  failed: 'error',
  removing: 'progress',
};

const REASON_TITLE: Partial<Record<HostFirewallLayerState, string>> = {
  blocked: 'Waiting to apply',
  failed: 'Not applied',
  removing: 'Turning off',
};

@Component({
  selector: 'cluster-host-layer',
  imports: [FlStatus, FlAlert, FlButton, FlSpinner],
  host: { class: 'block' },
  template: `
    <section
      class="flex flex-col gap-3 border-t border-fl-border-subtle pt-4 text-fl-body-sm"
      aria-label="Firewall on each node"
      data-testid="host-layer"
    >
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="m-0 text-fl-body font-semibold">Firewall on each node</h3>
        <fl-status data-testid="host-layer-state" [tone]="tone()" [label]="stateLabel()" />
        <span class="flex-1"></span>
        @if (saving()) {
          <fl-spinner label="Saving" />
        }
        <button
          flButton
          size="sm"
          type="button"
          role="switch"
          data-testid="host-layer-toggle"
          [attr.aria-checked]="layer().enabled"
          [attr.aria-label]="
            layer().enabled
              ? 'Turn off the firewall on each node'
              : 'Turn on the firewall on each node'
          "
          [disabled]="saving() || !canManage()"
          (click)="toggle()"
        >
          {{ layer().enabled ? 'Turn off' : 'Turn on' }}
        </button>
      </div>

      @if (layer().state === 'applied' && layer().appliedNodes) {
        <p class="m-0" data-testid="host-layer-nodes">
          Applied to {{ layer().appliedNodes }} node{{ layer().appliedNodes === 1 ? '' : 's' }}.
        </p>
      }

      @if (showReason()) {
        <fl-alert [tone]="reasonTone()" [title]="reasonTitle()" data-testid="host-layer-reason">
          {{ reasonText() }}
        </fl-alert>
      }

      @if (error()) {
        <fl-alert tone="error" title="Could not change it" data-testid="host-layer-error">
          {{ error() }}
        </fl-alert>
      }

      <p class="m-0 text-fl-ink-muted" data-testid="host-layer-independent">
        A problem here never changes the status of the cluster firewall.
      </p>

      <button
        type="button"
        class="fl-link self-start"
        data-testid="host-layer-more"
        [attr.aria-expanded]="showMore()"
        aria-controls="host-layer-explanation"
        (click)="showMore.set(!showMore())"
      >
        {{ showMore() ? 'Less' : 'What is this?' }}
      </button>
      @if (showMore()) {
        <p
          id="host-layer-explanation"
          class="m-0 text-fl-ink-muted"
          data-testid="host-layer-explanation"
        >
          The cluster firewall is kept by your provider and covers the servers it is attached to.
          When this is on, each node also applies the same rules itself, so a node that ends up
          outside the provider firewall still refuses what the cluster does not open, including
          shared storage and traffic between nodes that does not come over the private network. Flui
          waits instead of applying when it cannot do so safely, for example while it does not know
          the cluster's private network, and tells you why here.
        </p>
      }
    </section>
  `,
})
export class ClusterHostLayerComponent {
  private readonly firewalls = inject(FirewallV2Service);
  private readonly permissions = inject(PermissionService);

  readonly clusterId = input.required<string>();
  readonly layer = input.required<HostFirewallLayer>();
  readonly changed = output<FirewallResponseDto>();

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly showMore = signal(false);

  readonly canManage = computed(() => this.permissions.can('cluster:manage'));
  readonly stateLabel = computed(() => STATE_LABEL[this.layer().state] ?? this.layer().state);
  readonly tone = computed(() => STATE_TONE[this.layer().state] ?? STATE_TONE.off);
  readonly reasonTone = computed<AlertTone>(() => {
    const state = this.layer().state;
    if (state === 'failed') return 'error';
    return state === 'removing' ? 'info' : 'warning';
  });
  readonly reasonTitle = computed(() => REASON_TITLE[this.layer().state] ?? 'Waiting to apply');
  readonly showReason = computed(() => {
    const state = this.layer().state;
    return state === 'blocked' || state === 'failed' || state === 'removing';
  });
  readonly reasonText = computed(() => {
    const { state, reason } = this.layer();
    if (reason) return reason;
    if (state === 'removing') return 'Being removed from the nodes.';
    if (state === 'blocked') return 'Waiting until it can be applied safely.';
    return 'The last attempt did not succeed.';
  });

  async toggle(): Promise<void> {
    if (this.saving() || !this.canManage()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const firewall = await this.firewalls.setHostLayer(this.clusterId(), !this.layer().enabled);
      this.changed.emit(firewall);
    } catch (err: unknown) {
      const e = err as { error?: { message?: string }; message?: string } | null;
      this.error.set(
        e?.error?.message || e?.message || 'Could not change the firewall on each node.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
