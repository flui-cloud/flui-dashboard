import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideLock, lucideServer } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import {
  ClusterDnsZoneService,
  InternalHostingRequirement,
} from '../../service/cluster-dns-zone.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { DnsClusterPicker } from './dns-cluster-picker';

@Component({
  selector: 'app-dns-internal-hosting-tab',
  imports: [
    RouterLink,
    FlPanel,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlEmptyState,
    FlLoadingState,
    FlStatus,
    DnsClusterPicker,
  ],
  providers: [provideIcons({ lucideLock, lucideServer })],
  host: { class: 'fl-stack' },
  template: `
    <fl-alert tone="info" title="What is internal hosting?">
      <span class="flex flex-col gap-1">
        <span>
          Internal apps run inside a cluster without a public URL. They are reachable only from your
          Flui dashboard through an authenticated proxy, at
          <span class="fl-mono">&#123;slug&#125;.internal.&lt;zone&gt;</span>.
        </span>
        <span>
          Useful for admin-only tools (database UIs like pgweb, monitoring dashboards) and internal
          services that should not be exposed to the public internet.
        </span>
        <span>
          Internal hosting becomes available once the cluster has a DNS zone and a wildcard TLS
          issuer configured. There is no separate toggle.
        </span>
      </span>
    </fl-alert>

    @if (clustersLoading()) {
      <fl-panel title="Internal hosting" [flush]="true">
        <fl-loading-state [rows]="3" />
      </fl-panel>
    } @else if (clusters().length === 0) {
      <fl-panel title="Internal hosting" [flush]="true">
        <fl-empty-state
          icon="lucideServer"
          title="No clusters yet"
          body="Create a cluster first."
        />
      </fl-panel>
    } @else {
      <app-dns-cluster-picker
        [clusters]="clusters()"
        [value]="selectedClusterId()"
        [showRefresh]="!!selectedClusterId()"
        [refreshing]="statusLoading()"
        (valueChange)="onClusterChange($event)"
        (refresh)="refresh()"
      />

      @if (!selectedClusterId()) {
        <fl-panel title="Internal hosting" [flush]="true">
          <fl-empty-state
            icon="lucideServer"
            title="No cluster selected"
            body="Select a cluster to view its internal hosting status."
          />
        </fl-panel>
      } @else if (statusLoading() && !status()) {
        <fl-panel title="Internal hosting" [flush]="true">
          <fl-loading-state [rows]="3" />
        </fl-panel>
      } @else if (status(); as s) {
        <fl-panel title="Internal hosting">
          <div class="flex flex-col gap-5">
            <fl-key-value>
              <fl-kv-item key="Status">
                <fl-status
                  [tone]="s.enabled ? 'success' : 'neutral'"
                  [label]="s.enabled ? 'Available' : 'Not available'"
                />
              </fl-kv-item>
              @if (s.enabled && s.internalHostTemplate) {
                <fl-kv-item key="Internal apps reachable at" [mono]="true">
                  {{ s.internalHostTemplate }}
                </fl-kv-item>
              }
            </fl-key-value>

            @if (!(s.enabled && s.internalHostTemplate)) {
              <p class="text-fl-body-sm text-fl-ink-muted">
                Internal apps require the same DNS setup as public hosting. Once it is configured,
                you can deploy apps with <span class="fl-mono">exposure: internal</span> from the
                install wizard.
              </p>
            }

            <div class="flex flex-col gap-2 border-t border-fl-border pt-4">
              <h3 class="text-fl-section-title">Requirements</h3>
              <ul class="flex flex-col gap-2">
                @for (req of requirementChecklist(); track req.key) {
                  <li class="fl-row">
                    <fl-status [tone]="req.met ? 'success' : 'error'" [label]="req.label" />
                    @if (req.hint; as hint) {
                      <a class="fl-link text-fl-body-sm" [routerLink]="hint.route">{{
                        hint.label
                      }}</a>
                    }
                  </li>
                }
              </ul>
            </div>
          </div>
        </fl-panel>
      }
    }
  `,
})
export class DnsInternalHostingTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly clusterDnsZone = inject(ClusterDnsZoneService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly clusters = this.clusterService.clusters;
  protected readonly clustersLoading = signal(false);

  protected readonly selectedClusterId = signal('');
  protected readonly status = this.clusterDnsZone.internalHostingStatus;
  protected readonly statusLoading = this.clusterDnsZone.internalHostingLoading;

  protected readonly requirementChecklist = computed(() => {
    const s = this.status();
    const missing = new Set<InternalHostingRequirement>(s?.missingRequirements ?? []);
    return [
      {
        key: 'dns_zone' as const,
        label: 'DNS zone assigned',
        met: !missing.has('dns_zone'),
        hint: missing.has('dns_zone')
          ? { label: 'Configure', route: ['/infrastructure/domains/zones'] }
          : null,
      },
      {
        key: 'wildcard_issuer' as const,
        label: 'Wildcard TLS issuer ready',
        met: !missing.has('wildcard_issuer'),
        hint: missing.has('wildcard_issuer')
          ? { label: 'Configure', route: ['/infrastructure/domains/issuers'] }
          : null,
      },
    ];
  });

  constructor() {
    effect(() => {
      const id = this.selectedClusterId();
      if (!id) {
        this.clusterDnsZone.resetInternalHostingStatus();
        return;
      }
      void this.clusterDnsZone.loadInternalHostingStatus(id);
    });
  }

  ngOnInit(): void {
    void (async () => {
      this.clustersLoading.set(true);
      await this.clusterService.loadClusters();
      this.clustersLoading.set(false);

      const queryId = this.route.snapshot.queryParamMap.get('clusterId');
      const list = this.clusters();
      if (queryId && list.some((c) => c.id === queryId)) {
        this.selectedClusterId.set(queryId);
      } else if (list.length === 1 && list[0].id) {
        this.selectedClusterId.set(list[0].id);
      }
    })();
  }

  onClusterChange(id: string): void {
    this.selectedClusterId.set(id);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: id ? { clusterId: id } : {},
      replaceUrl: true,
    });
  }

  refresh(): void {
    const id = this.selectedClusterId();
    if (!id) return;
    void this.clusterDnsZone.loadInternalHostingStatus(id);
  }
}
