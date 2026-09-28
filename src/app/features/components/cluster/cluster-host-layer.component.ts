import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideServer } from '@ng-icons/lucide';

import { FirewallResponseDto } from '../../../core/api/model/models';
import { PermissionService } from '../../../core/services/permission.service';
import { FirewallV2Service } from '../../service/firewall-v2.service';
import { HostFirewallLayer, HostFirewallLayerState } from '../../model/firewall-v2.models';

const STATE_LABEL: Record<HostFirewallLayerState, string> = {
  'not-applicable': 'Not offered',
  off: 'Off',
  pending: 'Applying',
  applied: 'On',
  blocked: 'Waiting',
  failed: 'Failed',
  removing: 'Turning off',
};

const STATE_TONE: Record<HostFirewallLayerState, string> = {
  'not-applicable': 'bg-muted text-sub',
  off: 'bg-muted text-sub',
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  applied: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  blocked: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  removing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

@Component({
  selector: 'cluster-host-layer',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideLoader, lucideServer })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-inner p-4 space-y-2" data-testid="host-layer">
      <div class="flex items-center gap-2">
        <ng-icon name="lucideServer" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span class="text-label">Firewall on each node</span>
        <span class="text-xs px-2 py-0.5 rounded-full {{ tone() }}" data-testid="host-layer-state">
          {{ stateLabel() }}
        </span>
        <button
          type="button"
          role="switch"
          data-testid="host-layer-toggle"
          [attr.aria-checked]="layer().enabled"
          [attr.aria-label]="layer().enabled ? 'Turn off the firewall on each node' : 'Turn on the firewall on each node'"
          [disabled]="saving() || !canManage()"
          (click)="toggle()"
          class="ml-auto relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 {{ layer().enabled ? 'bg-blue-600' : 'bg-muted-foreground/30' }}"
        >
          <span
            class="inline-block h-4 w-4 rounded-full bg-background shadow transition-transform {{ layer().enabled ? 'translate-x-4' : 'translate-x-0.5' }}"
          ></span>
        </button>
        @if (saving()) {
          <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin text-sub" />
        }
      </div>

      @if (layer().state === 'applied' && layer().appliedNodes) {
        <p class="text-xs text-sub" data-testid="host-layer-nodes">
          Applied to {{ layer().appliedNodes }} node{{ layer().appliedNodes === 1 ? '' : 's' }}.
        </p>
      }

      @if (showReason()) {
        <p
          class="text-sm {{ layer().state === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-300' }}"
          data-testid="host-layer-reason"
        >
          {{ reasonText() }}
        </p>
      }

      @if (error()) {
        <p class="text-sm text-red-600 dark:text-red-400" data-testid="host-layer-error">{{ error() }}</p>
      }

      <p class="text-xs text-sub" data-testid="host-layer-independent">
        A problem here never changes the status of the cluster firewall.
      </p>

      <button
        type="button"
        class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        data-testid="host-layer-more"
        (click)="showMore.set(!showMore())"
      >
        {{ showMore() ? 'Less' : 'What is this?' }}
      </button>
      @if (showMore()) {
        <p class="text-sm text-sub" data-testid="host-layer-explanation">
          The cluster firewall is kept by your provider and covers the servers it is attached to.
          When this is on, each node also applies the same rules itself, so a node that ends up
          outside the provider firewall still refuses what the cluster does not open, including
          shared storage and traffic between nodes that does not come over the private network.
          Flui waits instead of applying when it cannot do so safely, for example while it does
          not know the cluster's private network, and tells you why here.
        </p>
      }
    </div>
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
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Could not change the firewall on each node.');
    } finally {
      this.saving.set(false);
    }
  }
}
