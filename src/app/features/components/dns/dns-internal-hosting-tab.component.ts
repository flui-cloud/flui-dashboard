import { Component, computed, effect, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleX,
  lucideInfo,
  lucideLoader,
  lucideLock,
  lucideRefreshCw,
  lucideServer,
} from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import {
  ClusterDnsZoneService,
  InternalHostingRequirement,
} from '../../service/cluster-dns-zone.service';

@Component({
  selector: 'app-dns-internal-hosting-tab',
  standalone: true,
  imports: [NgIconComponent, FormsModule, RouterLink],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideCircleX,
      lucideInfo,
      lucideLoader,
      lucideLock,
      lucideRefreshCw,
      lucideServer,
    }),
  ],
  template: `
    <div class="space-y-4">

      <!-- Explanatory badge -->
      <div class="flex items-start gap-3 p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10">
        <ng-icon name="lucideLock" class="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div class="text-sm text-blue-900 dark:text-blue-200 space-y-1.5">
          <div class="font-semibold text-blue-950 dark:text-blue-100">What is internal hosting?</div>
          <p>
            Internal apps run inside a cluster without a public URL. They're reachable only from
            your Flui dashboard through an authenticated proxy, at
            <span class="font-mono text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40">&#123;slug&#125;.internal.&lt;zone&gt;</span>.
          </p>
          <p class="text-blue-800 dark:text-blue-300">
            Useful for admin-only tools (database UIs like pgweb, monitoring dashboards) and
            internal services that shouldn't be exposed to the public internet.
          </p>
          <p class="text-blue-800 dark:text-blue-300 text-xs">
            Internal hosting becomes available automatically once the cluster has a DNS zone
            and a wildcard TLS issuer configured — no separate toggle needed.
          </p>
        </div>
      </div>

      @if (clustersLoading()) {
        <div class="animate-pulse space-y-4">
          <div class="flex items-center gap-3">
            <div class="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
            <div class="h-8 w-64 rounded-md bg-gray-200 dark:bg-gray-700"></div>
          </div>
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 h-40"></div>
        </div>
      } @else if (clusters().length === 0) {
        <div class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <ng-icon name="lucideInfo" class="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p class="text-sm text-gray-600 dark:text-gray-400">No clusters available. Create a cluster first.</p>
        </div>
      } @else {

        <!-- Cluster picker -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <ng-icon name="lucideServer" class="h-4 w-4 text-gray-400 flex-shrink-0" />
            <select
              [ngModel]="selectedClusterId()"
              (ngModelChange)="onClusterChange($event)"
              class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a cluster...</option>
              @for (cluster of clusters(); track cluster.id) {
                <option [value]="cluster.id">{{ cluster.name }}</option>
              }
            </select>
          </div>
          @if (selectedClusterId()) {
            <button
              type="button"
              (click)="refresh()"
              [disabled]="statusLoading()"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
            >
              <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="statusLoading()" />
              Refresh
            </button>
          }
        </div>

        @if (!selectedClusterId()) {
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Select a cluster to view its internal hosting status.
          </p>
        } @else if (statusLoading() && !status()) {
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
              Loading status...
            </div>
          </div>
        } @else if (status()) {
          @let s = status()!;

          <!-- Status card (read-only) -->
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">

            <!-- Header: status line -->
            <div class="flex items-center gap-2">
              <span
                class="h-2.5 w-2.5 rounded-full"
                [class]="s.enabled ? 'bg-green-500' : 'bg-gray-400'"
              ></span>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ s.enabled ? 'Available' : 'Not available' }}
              </h3>
            </div>

            @if (s.enabled && s.internalHostTemplate) {
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Internal apps reachable at
                <span class="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{{ s.internalHostTemplate }}</span>
              </p>
            } @else {
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Internal apps require the same DNS setup as public hosting — once configured,
                you can deploy apps with <span class="font-mono">exposure: internal</span> from the install wizard.
              </p>
            }

            <!-- Requirements checklist -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                Requirements
              </h4>
              <ul class="space-y-1.5 text-sm">
                @for (req of requirementChecklist(); track req.key) {
                  <li class="flex items-center gap-2 flex-wrap">
                    @if (req.met) {
                      <ng-icon name="lucideCircleCheck" class="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span class="text-gray-700 dark:text-gray-300">{{ req.label }}</span>
                    } @else {
                      <ng-icon name="lucideCircleX" class="h-4 w-4 text-red-500 dark:text-red-400 flex-shrink-0" />
                      <span class="text-gray-700 dark:text-gray-300">{{ req.label }}</span>
                      @if (req.hint; as hint) {
                        <a
                          [routerLink]="hint.route"
                          class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >{{ hint.label }}</a>
                      }
                    }
                  </li>
                }
              </ul>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class DnsInternalHostingTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly clusterDnsZone = inject(ClusterDnsZoneService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected clusters = this.clusterService.clusters;
  protected clustersLoading = signal(false);

  protected selectedClusterId = signal('');
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
          ? { label: 'Configure →', route: ['/infrastructure/domains/zones'] }
          : null,
      },
      {
        key: 'wildcard_issuer' as const,
        label: 'Wildcard TLS issuer ready',
        met: !missing.has('wildcard_issuer'),
        hint: missing.has('wildcard_issuer')
          ? { label: 'Configure →', route: ['/infrastructure/domains/issuers'] }
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
      if (queryId && list.some(c => c.id === queryId)) {
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
