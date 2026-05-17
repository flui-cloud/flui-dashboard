import { Component, inject, signal, effect, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideServer, lucideInfo, lucideRefreshCw } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { DnsRefreshService } from '../../service/dns-refresh.service';
import { ClusterCertificateIssuersComponent } from '../cluster/cluster-certificate-issuers.component';
import { ClusterIssuerSetupComponent } from '../cluster/cluster-issuer-setup.component';

@Component({
  selector: 'app-dns-issuers-tab',
  standalone: true,
  imports: [NgIconComponent, FormsModule, ClusterCertificateIssuersComponent, ClusterIssuerSetupComponent],
  providers: [provideIcons({ lucideServer, lucideInfo, lucideRefreshCw })],
  template: `
    <div class="space-y-4">

      @if (loading()) {
        <!-- Skeleton loader -->
        <div class="animate-pulse space-y-4">
          <!-- Cluster selector skeleton -->
          <div class="flex items-center gap-3">
            <div class="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
            <div class="h-8 w-64 rounded-md bg-gray-200 dark:bg-gray-700"></div>
          </div>
          <!-- Content card skeleton -->
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
            <div class="h-5 w-40 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="space-y-3">
              @for (i of [1, 2, 3]; track i) {
                <div class="flex items-center gap-3">
                  <div class="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
                  <div class="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
                  <div class="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                </div>
              }
            </div>
          </div>
        </div>
      } @else if (clusters().length === 0) {
        <div class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <ng-icon name="lucideInfo" class="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p class="text-sm text-gray-600 dark:text-gray-400">No clusters available. Create a cluster to configure certificate issuers.</p>
        </div>
      } @else {

        <!-- Cluster selector -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <ng-icon name="lucideServer" class="h-4 w-4 text-gray-400 flex-shrink-0" />
            <select
              [(ngModel)]="selectedClusterId"
              class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a cluster...</option>
              @for (cluster of clusters(); track cluster.id) {
                <option [value]="cluster.id">{{ cluster.name }}</option>
              }
            </select>
          </div>
          <button
            (click)="refresh()"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        @if (selectedClusterId) {
          <div class="space-y-4">
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
              <app-cluster-certificate-issuers [clusterId]="selectedClusterId" [refreshTrigger]="issuersRefreshTrigger()" />
            </div>
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
              <app-cluster-issuer-setup [clusterId]="selectedClusterId" [refreshTrigger]="issuersRefreshTrigger()" />
            </div>
          </div>
        } @else {
          <p class="text-sm text-gray-500 dark:text-gray-400">Select a cluster to view and configure its certificate issuers.</p>
        }
      }
    </div>
  `,
})
export class DnsIssuersTabComponent implements OnInit {
  private readonly clusterService = inject(ClusterService);
  private readonly refreshService = inject(DnsRefreshService);

  protected clusters = this.clusterService.clusters;
  protected loading = signal(false);
  protected selectedClusterId = '';
  protected issuersRefreshTrigger = signal(0);

  constructor() {
    effect(() => {
      const trigger = this.refreshService.trigger();
      if (trigger > 0) {
        this.issuersRefreshTrigger.update(n => n + 1);
      }
    });
  }

  refresh(): void {
    this.issuersRefreshTrigger.update(n => n + 1);
  }

  ngOnInit(): void {
    void (async () => {
      this.loading.set(true);
      await this.clusterService.loadClusters();
      this.loading.set(false);
      // Auto-select the first cluster if only one available
      const list = this.clusters();
      if (list.length === 1 && list[0].id) {
        this.selectedClusterId = list[0].id;
      }
    })();
  }
}
