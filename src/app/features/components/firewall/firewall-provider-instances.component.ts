import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideSearch, lucideShield } from '@ng-icons/lucide';
import { FirewallService } from '../../service/firewall.service';
import { ProvidersService } from '../../service/providers.service';
import { ProviderFirewallExtended, ProviderFirewallFilterState } from '../../model/firewall.models';
import { ProviderBadgeComponent } from './provider-badge.component';
import { UsageStatusBadgeComponent } from './usage-status-badge.component';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlMetric, FlMetricStrip } from '../../../ui/patterns/metric-strip';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlTag } from '../../../ui/primitives/tag';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';

const BREADCRUMB: Crumb[] = [
  { label: 'Cluster firewalls', link: '/infrastructure/firewall/clusters' },
  { label: 'Provider firewalls' },
];

@Component({
  selector: 'app-firewall-provider-instances',
  imports: [
    FormsModule,
    RouterLink,
    ProviderBadgeComponent,
    UsageStatusBadgeComponent,
    FlPageHeader,
    FlPanel,
    FlTable,
    FlAlert,
    FlMetricStrip,
    FlMetric,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlTag,
    FlActionsMenu,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideSearch, lucideShield })],
  template: `
    <div class="fl-page">
      <fl-page-header
        [title]="'Provider firewalls (' + stats().total + ')'"
        [breadcrumb]="breadcrumb"
      >
        <span headerMeta>Firewalls as each cloud provider reports them</span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            [disabled]="firewallService.loadingProviderFirewalls()"
            (click)="refresh()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </fl-page-header>

      <fl-alert tone="warning" title="For emergencies only">
        Change firewalls on the provider only in an emergency. Cluster firewalls keep the desired
        state, detect drift and reconcile it.
      </fl-alert>

      @if (firewallService.providerFirewallsErrorMessage()) {
        <fl-alert tone="error" title="Could not load the provider firewalls">
          {{ firewallService.providerFirewallsErrorMessage() }}
        </fl-alert>
      }

      @if (notice()) {
        <fl-alert tone="error" title="Could not delete the firewall">{{ notice() }}</fl-alert>
      }

      <fl-metric-strip>
        <fl-metric label="Firewalls" [value]="stats().total" caption="Across all providers" />
        <fl-metric label="In use" [value]="stats().inUse" caption="Attached to clusters" />
        <fl-metric label="Unused" [value]="stats().unused" caption="Can be deleted" />
        <fl-metric
          label="Providers"
          [value]="providersWithCount().length"
          [caption]="providersCaption()"
        />
      </fl-metric-strip>

      <fl-panel [flush]="true">
        <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
          <div class="fl-toolbar__group">
            <label class="fl-input">
              <fl-icon name="lucideSearch" [size]="14" />
              <span class="fl-sr">Search firewalls</span>
              <input
                type="search"
                placeholder="Search by name, ID or cluster"
                [ngModel]="filters().search"
                (ngModelChange)="setFilter('search', $event)"
              />
            </label>
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Provider"
                [ngModel]="filters().provider"
                (ngModelChange)="setFilter('provider', $event)"
              >
                <option value="ALL">Provider: All</option>
                @for (p of availableProviders(); track p.id) {
                  <option [value]="p.id">{{ p.displayName }}</option>
                }
              </select>
            </span>
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Usage"
                [ngModel]="filters().inUse"
                (ngModelChange)="setFilter('inUse', $event)"
              >
                <option [ngValue]="'ALL'">Usage: All</option>
                <option [ngValue]="true">In use</option>
                <option [ngValue]="false">Unused</option>
              </select>
            </span>
          </div>
          <div class="fl-toolbar__group">
            <span class="fl-toolbar__info">
              {{ filteredFirewalls().length }}
              {{ filteredFirewalls().length === 1 ? 'firewall' : 'firewalls' }}
            </span>
          </div>
        </div>

        @if (firewallService.loadingProviderFirewalls()) {
          <fl-loading-state [rows]="5" />
        } @else if (filteredFirewalls().length === 0) {
          <fl-empty-state
            icon="lucideShield"
            title="No firewalls found"
            [body]="
              hasActiveFilters()
                ? 'Nothing matches these filters.'
                : 'No firewall has been created on any provider.'
            "
          />
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Status</th>
                  <th scope="col">Cluster</th>
                  <th scope="col" class="is-num">Servers</th>
                  <th scope="col" class="is-num">Rules</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (firewall of filteredFirewalls(); track firewall.id) {
                  <tr>
                    <td class="fl-cell-name">
                      <span class="fl-row">
                        <span class="font-medium">{{ firewall.name }}</span>
                        @if (isObservabilityFirewall(firewall)) {
                          <fl-tag>control</fl-tag>
                        }
                      </span>
                      <span class="block fl-mono fl-muted">{{ firewall.id }}</span>
                    </td>
                    <td><app-provider-badge [provider]="firewall.provider" /></td>
                    <td>
                      <app-usage-status-badge
                        [inUse]="isObservabilityFirewall(firewall) ? true : firewall.inUse"
                      />
                    </td>
                    <td>
                      @if (firewall.clusterId) {
                        <a class="fl-link" [routerLink]="['/cluster', firewall.clusterId]">
                          {{ firewall.clusterName || firewall.clusterId }}
                        </a>
                      } @else {
                        <span class="fl-muted">—</span>
                      }
                    </td>
                    <td class="is-num">{{ firewall.appliedServers.length }}</td>
                    <td class="is-num">{{ firewall.rules.length }}</td>
                    <td class="is-fit">
                      <fl-actions-menu
                        label="Firewall actions"
                        [compact]="true"
                        [items]="actionsFor(firewall)"
                        [attr.title]="deleteHint(firewall)"
                        (action)="onAction(firewall, $event)"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    </div>
  `,
})
export class FirewallProviderInstancesComponent {
  firewallService = inject(FirewallService);
  private readonly providersService = inject(ProvidersService);
  private readonly confirmService = inject(ConfirmService);

  protected readonly breadcrumb = BREADCRUMB;

  readonly availableProviders = computed(() => this.providersService.availableProviders());

  filters = signal<ProviderFirewallFilterState>({
    search: '',
    provider: 'ALL',
    inUse: 'ALL',
  });

  deleting = signal<string | null>(null);
  notice = signal<string | null>(null);
  private firewallToDelete: ProviderFirewallExtended | null = null;

  constructor() {
    this.providersService.loadProviders();
    effect(
      () => {
        this.firewallService.loadProviderFirewalls();
      },
      { allowSignalWrites: true },
    );
  }

  stats = computed(() => this.firewallService.providerFirewallStats());

  providersWithCount = computed(() => {
    const byProvider = this.stats().byProvider;
    return Object.entries(byProvider).map(([name, count]) => ({ name, count }));
  });

  providersCaption = computed(
    () =>
      this.providersWithCount()
        .map((p) => `${p.name} ${p.count}`)
        .join(', ') || undefined,
  );

  filteredFirewalls = computed(() => {
    const currentFilters = this.filters();
    const all = this.firewallService.allProviderFirewalls();

    return all.filter((fw) => {
      if (currentFilters.search) {
        const searchLower = currentFilters.search.toLowerCase();
        const matchesName = fw.name.toLowerCase().includes(searchLower);
        const matchesId = fw.id.toLowerCase().includes(searchLower);
        const matchesCluster = fw.clusterName?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesId && !matchesCluster) {
          return false;
        }
      }

      if (currentFilters.provider !== 'ALL' && fw.provider !== currentFilters.provider) {
        return false;
      }

      if (currentFilters.inUse !== 'ALL' && fw.inUse !== currentFilters.inUse) {
        return false;
      }

      return true;
    });
  });

  hasActiveFilters = computed(() => {
    const currentFilters = this.filters();
    return (
      currentFilters.search !== '' ||
      currentFilters.provider !== 'ALL' ||
      currentFilters.inUse !== 'ALL'
    );
  });

  setFilter<K extends keyof ProviderFirewallFilterState>(
    field: K,
    value: ProviderFirewallFilterState[K],
  ): void {
    this.filters.update((current) => ({ ...current, [field]: value }));
  }

  actionsFor(firewall: ProviderFirewallExtended): MenuAction[] {
    return [
      {
        id: 'delete',
        label: 'Delete firewall',
        danger: true,
        disabled:
          this.isObservabilityFirewall(firewall) ||
          firewall.inUse ||
          this.deleting() === firewall.id,
      },
    ];
  }

  deleteHint(firewall: ProviderFirewallExtended): string | null {
    if (this.isObservabilityFirewall(firewall)) {
      return 'Control-cluster firewalls are managed automatically and cannot be deleted';
    }
    if (firewall.inUse) return 'A firewall in use cannot be deleted';
    return null;
  }

  onAction(firewall: ProviderFirewallExtended, action: string): void {
    if (action === 'delete') void this.deleteFirewall(firewall);
  }

  async refresh(): Promise<void> {
    await this.firewallService.loadProviderFirewalls();
  }

  isObservabilityFirewall(firewall: ProviderFirewallExtended): boolean {
    return (
      firewall.labels?.['flui-cluster-type'] === 'control' ||
      firewall.labels?.['flui-cluster-type'] === 'observability'
    );
  }

  async deleteFirewall(firewall: ProviderFirewallExtended): Promise<void> {
    if (this.isObservabilityFirewall(firewall)) {
      this.notice.set(
        'Control-cluster firewalls are managed automatically and cannot be deleted manually.',
      );
      return;
    }

    if (firewall.inUse) {
      this.notice.set('A firewall in use cannot be deleted. Detach it from the cluster first.');
      return;
    }

    this.firewallToDelete = firewall;
    const provider = firewall.provider.charAt(0).toUpperCase() + firewall.provider.slice(1);
    const ok = await this.confirmService.confirm({
      title: `Delete ${firewall.name}?`,
      body: `The firewall is deleted from ${provider} with its ${firewall.rules.length} rules and ${firewall.appliedServers.length} servers. This cannot be undone.`,
      confirmLabel: 'Delete firewall',
      destructive: true,
    });
    if (ok) await this.confirmDelete();
    else this.cancelDelete();
  }

  async confirmDelete(): Promise<void> {
    if (!this.firewallToDelete) {
      return;
    }

    const firewall = this.firewallToDelete;
    this.deleting.set(firewall.id);
    this.notice.set(null);

    try {
      await this.firewallService.deleteProviderFirewall(firewall.provider, firewall.id);
      this.firewallToDelete = null;
    } catch (error: unknown) {
      const e = error as { error?: { message?: string }; message?: string } | null;
      this.notice.set(e?.error?.message || e?.message || 'An unexpected error occurred.');
    } finally {
      this.deleting.set(null);
    }
  }

  cancelDelete(): void {
    this.firewallToDelete = null;
    this.deleting.set(null);
  }
}
